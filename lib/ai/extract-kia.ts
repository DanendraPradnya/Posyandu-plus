/**
 * Klien Utama Pipeline Ekstraksi Foto Buku KIA via OpenAI Vision (F2-01 & F2-03)
 * Menggunakan OpenAI Structured Outputs (`strict: true`), retry terbatas, timeout,
 * fallback model cadangan OpenAI (`gpt-4o`), serta peralihan aman ke mode input manual.
 */

import type { KiaExtractionOutput } from "../types";
import {
  kiaExtractionOutputSchema,
  OPENAI_KIA_RESPONSE_FORMAT,
} from "./extraction-schema";
import {
  buildKiaExtractionUserPrompt,
  EXTRACTION_PROMPT_VERSION,
  KIA_EXTRACTION_SYSTEM_PROMPT,
  type KiaUserPromptOptions,
} from "./prompts";
import {
  calibrateExtractionOutput,
  summarizeFieldConfidences,
  type CalibratedExtractionOutput,
} from "./confidence";
import {
  checkLlmBudgetAndRateLimit,
  estimateOpenAiCostUsd,
  getCurrentYearMonthUtc,
  type LlmBudgetConfig,
  type OpenAiTokenUsage,
  type UsageStore,
} from "./cost-tracker";
import {
  logExtractionAttempt,
  type SupabaseLikeInsertClient,
} from "./extraction-logger";

export interface ExtractKiaInput {
  /** URL gambar bertanda tangan atau data URI base64 (mis. data:image/jpeg;base64,...) */
  imageUrl: string;
  imageDetail?: "low" | "high" | "auto";
  userId?: string;
  extractionJobId?: string;
  promptOptions?: KiaUserPromptOptions;
  referenceDate?: string;
}

export interface ModelAttemptRecord {
  model: string;
  attemptNumber: number;
  success: boolean;
  latencyMs: number;
  estimatedCostUsd: number;
  errorMessage?: string;
}

export interface ExtractKiaSuccessResult {
  ok: true;
  status: "siap_verifikasi";
  fallbackToManual: false;
  usedFallbackModel: boolean;
  modelUsed: string;
  promptVersion: string;
  data: CalibratedExtractionOutput;
  latencyMs: number;
  estimatedCostUsd: number;
  budgetWarning: boolean;
  attempts: ModelAttemptRecord[];
}

export interface ExtractKiaFailureResult {
  ok: false;
  status: "gagal";
  fallbackToManual: true;
  budgetExceeded: boolean;
  rateLimited: boolean;
  modelUsed: string | null;
  promptVersion: string;
  errorMessage: string;
  latencyMs: number;
  estimatedCostUsd: number;
  attempts: ModelAttemptRecord[];
}

export type ExtractKiaResult = ExtractKiaSuccessResult | ExtractKiaFailureResult;

export interface ExtractKiaDeps {
  apiKey?: string;
  primaryModel?: string;
  fallbackModel?: string;
  openAiEndpoint?: string;
  timeoutMs?: number;
  maxRetriesPerModel?: number;
  fetcher?: typeof fetch;
  usageStore?: UsageStore;
  budgetConfig?: Partial<LlmBudgetConfig>;
  currentMonthlySpendUsd?: number;
  userCallsLastHour?: number;
  supabaseClient?: SupabaseLikeInsertClient;
  skipDbLogging?: boolean;
}

interface OpenAiChatCompletionResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
      refusal?: string | null;
    };
  }>;
  usage?: OpenAiTokenUsage;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

function getDefaultPrimaryModel(): string {
  return process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
}

function getDefaultFallbackModel(): string {
  return process.env.OPENAI_VISION_FALLBACK_MODEL || "gpt-4o";
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

async function callOpenAiVisionOnce(params: {
  endpoint: string;
  apiKey: string;
  model: string;
  imageUrl: string;
  imageDetail: "low" | "high" | "auto";
  userPrompt: string;
  timeoutMs: number;
  fetcher: typeof fetch;
}): Promise<{
  parsed?: KiaExtractionOutput;
  usage?: OpenAiTokenUsage;
  retryable: boolean;
  errorMessage?: string;
}> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const response = await params.fetcher(params.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: params.model,
        temperature: 0,
        messages: [
          { role: "system", content: KIA_EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: params.userPrompt },
              {
                type: "image_url",
                image_url: {
                  url: params.imageUrl,
                  detail: params.imageDetail,
                },
              },
            ],
          },
        ],
        response_format: OPENAI_KIA_RESPONSE_FORMAT,
      }),
    });

    if (!response.ok) {
      let apiErrMsg = `HTTP ${response.status}`;
      try {
        const errBody = (await response.json()) as OpenAiChatCompletionResponse;
        if (errBody?.error?.message) {
          apiErrMsg = `${apiErrMsg}: ${errBody.error.message}`;
        }
      } catch {
        // Abaikan jika body error bukan JSON
      }
      return {
        retryable: isRetryableStatus(response.status),
        errorMessage: apiErrMsg,
      };
    }

    const body = (await response.json()) as OpenAiChatCompletionResponse;
    const firstChoice = body.choices?.[0];
    const refusal = firstChoice?.message?.refusal;
    if (refusal) {
      return {
        usage: body.usage,
        retryable: false,
        errorMessage: `Model menolak memproses gambar: ${refusal}`,
      };
    }

    const rawContent = firstChoice?.message?.content;
    if (!rawContent || typeof rawContent !== "string") {
      return {
        usage: body.usage,
        retryable: true,
        errorMessage: "Respons OpenAI tidak menyertakan konten JSON.",
      };
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawContent);
    } catch {
      return {
        usage: body.usage,
        retryable: true,
        errorMessage: "Keluaran OpenAI bukan JSON yang valid.",
      };
    }

    const validated = kiaExtractionOutputSchema.safeParse(rawJson);
    if (!validated.success) {
      return {
        usage: body.usage,
        retryable: false,
        errorMessage: `Keluaran JSON tidak sesuai skema KIA: ${validated.error.issues[0]?.message ?? "invalid schema"}`,
      };
    }

    return {
      parsed: validated.data as KiaExtractionOutput,
      usage: body.usage,
      retryable: false,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        retryable: true,
        errorMessage: `Timeout setelah ${params.timeoutMs} ms saat memanggil ${params.model}.`,
      };
    }
    return {
      retryable: true,
      errorMessage:
        err instanceof Error
          ? err.message
          : "Kesalahan jaringan saat menghubungi OpenAI API.",
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Mengekstrak baris kunjungan Buku KIA dari foto secara deterministik dengan:
 * 1. Pengecekan anggaran bulanan & rate limit (F2-05).
 * 2. Pemanggilan OpenAI Vision utama (`gpt-4o-mini`) dengan Structured Outputs (`strict: true`).
 * 3. Retry terbatas & fallback otomatis ke model cadangan OpenAI (`gpt-4o`) bila gagal/timeout (F2-03).
 * 4. Kalibrasi skor keyakinan & validasi plausibilitas (F2-02).
 * 5. Pencatatan metadata ke `extraction_logs` (F2-04).
 */
export async function extractKiaFromImage(
  input: ExtractKiaInput,
  deps: ExtractKiaDeps = {}
): Promise<ExtractKiaResult> {
  const startMs = Date.now();
  const primaryModel = deps.primaryModel ?? getDefaultPrimaryModel();
  const fallbackModel = deps.fallbackModel ?? getDefaultFallbackModel();
  const endpoint =
    deps.openAiEndpoint ?? "https://api.openai.com/v1/chat/completions";
  const timeoutMs = deps.timeoutMs ?? 12_000;
  const maxRetries = Math.max(0, deps.maxRetriesPerModel ?? 1);
  const fetcher = deps.fetcher ?? fetch;
  const apiKey = deps.apiKey ?? process.env.OPENAI_API_KEY;

  // 1. Evaluasi anggaran dan batas laju pengguna
  const currentYm = getCurrentYearMonthUtc();
  const currentMonthlySpendUsd =
    deps.currentMonthlySpendUsd ??
    (deps.usageStore ? await deps.usageStore.getMonthlySpendUsd(currentYm) : 0);
  const userCallsLastHour =
    deps.userCallsLastHour ??
    (deps.usageStore && input.userId
      ? await deps.usageStore.getUserCallsLastHour(input.userId)
      : 0);

  const budgetCheck = checkLlmBudgetAndRateLimit({
    userId: input.userId,
    currentMonthlySpendUsd,
    userCallsLastHour,
    config: deps.budgetConfig,
  });

  if (!budgetCheck.allowed) {
    return {
      ok: false,
      status: "gagal",
      fallbackToManual: true,
      budgetExceeded: budgetCheck.budgetExceeded,
      rateLimited: budgetCheck.rateLimited,
      modelUsed: null,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      errorMessage:
        budgetCheck.reason ??
        "Batas anggaran atau laju penggunaan LLM tercapai.",
      latencyMs: Date.now() - startMs,
      estimatedCostUsd: 0,
      attempts: [],
    };
  }

  if (!apiKey || apiKey === "your-openai-api-key") {
    return {
      ok: false,
      status: "gagal",
      fallbackToManual: true,
      budgetExceeded: false,
      rateLimited: false,
      modelUsed: null,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      errorMessage:
        "OPENAI_API_KEY belum dikonfigurasi. Silakan gunakan mode input manual.",
      latencyMs: Date.now() - startMs,
      estimatedCostUsd: 0,
      attempts: [],
    };
  }

  const userPrompt = buildKiaExtractionUserPrompt(input.promptOptions);
  const modelsToTry =
    fallbackModel && fallbackModel !== primaryModel
      ? [primaryModel, fallbackModel]
      : [primaryModel];

  const attempts: ModelAttemptRecord[] = [];
  let totalCostUsd = 0;

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const modelName = modelsToTry[mIdx];
    if (!modelName) continue;

    for (let retry = 0; retry <= maxRetries; retry++) {
      const attemptStart = Date.now();
      const outcome = await callOpenAiVisionOnce({
        endpoint,
        apiKey,
        model: modelName,
        imageUrl: input.imageUrl,
        imageDetail: input.imageDetail ?? "high",
        userPrompt,
        timeoutMs,
        fetcher,
      });

      const attemptLatency = Date.now() - attemptStart;
      const attemptCost = estimateOpenAiCostUsd(modelName, outcome.usage);
      totalCostUsd = Number((totalCostUsd + attemptCost).toFixed(6));

      if (outcome.parsed) {
        attempts.push({
          model: modelName,
          attemptNumber: retry + 1,
          success: true,
          latencyMs: attemptLatency,
          estimatedCostUsd: attemptCost,
        });

        const calibrated = calibrateExtractionOutput(outcome.parsed, {
          referenceDate: input.referenceDate,
        });
        const totalLatency = Date.now() - startMs;

        if (deps.usageStore) {
          await deps.usageStore.recordCall({
            userId: input.userId,
            costUsd: totalCostUsd,
          });
        }

        if (!deps.skipDbLogging) {
          await logExtractionAttempt(
            {
              extraction_job_id: input.extractionJobId ?? null,
              model: modelName,
              versi_prompt: EXTRACTION_PROMPT_VERSION,
              keyakinan: summarizeFieldConfidences(
                calibrated.baris_kunjungan
              ),
              latensi_ms: totalLatency,
              estimasi_biaya_usd: totalCostUsd,
            },
            { supabaseClient: deps.supabaseClient }
          );
        }

        return {
          ok: true,
          status: "siap_verifikasi",
          fallbackToManual: false,
          usedFallbackModel: mIdx > 0,
          modelUsed: modelName,
          promptVersion: EXTRACTION_PROMPT_VERSION,
          data: calibrated,
          latencyMs: totalLatency,
          estimatedCostUsd: totalCostUsd,
          budgetWarning: budgetCheck.warningTriggered,
          attempts,
        };
      }

      attempts.push({
        model: modelName,
        attemptNumber: retry + 1,
        success: false,
        latencyMs: attemptLatency,
        estimatedCostUsd: attemptCost,
        errorMessage: outcome.errorMessage,
      });

      if (!outcome.retryable) {
        break;
      }
    }
  }

  const totalLatency = Date.now() - startMs;
  const lastError =
    attempts[attempts.length - 1]?.errorMessage ??
    "Ekstraksi gagal setelah percobaan utama dan cadangan.";

  if (deps.usageStore && totalCostUsd > 0) {
    await deps.usageStore.recordCall({
      userId: input.userId,
      costUsd: totalCostUsd,
    });
  }

  if (!deps.skipDbLogging) {
    await logExtractionAttempt(
      {
        extraction_job_id: input.extractionJobId ?? null,
        model: attempts[attempts.length - 1]?.model ?? primaryModel,
        versi_prompt: EXTRACTION_PROMPT_VERSION,
        keyakinan: null,
        latensi_ms: totalLatency,
        estimasi_biaya_usd: totalCostUsd,
      },
      { supabaseClient: deps.supabaseClient }
    );
  }

  return {
    ok: false,
    status: "gagal",
    fallbackToManual: true,
    budgetExceeded: false,
    rateLimited: false,
    modelUsed: attempts[attempts.length - 1]?.model ?? null,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    errorMessage: lastError,
    latencyMs: totalLatency,
    estimatedCostUsd: totalCostUsd,
    attempts,
  };
}
