import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { KiaExtractionOutput } from "../lib/types";
import {
  EXTRACTION_SCHEMA_VERSION,
  OPENAI_KIA_RESPONSE_FORMAT,
  kiaExtractionOutputSchema,
} from "../lib/ai/extraction-schema";
import {
  EXTRACTION_PROMPT_VERSION,
  KIA_EXTRACTION_SYSTEM_PROMPT,
  buildKiaExtractionUserPrompt,
} from "../lib/ai/prompts";
import {
  calibrateExtractionOutput,
  calibrateRowConfidence,
  clampConfidence,
  summarizeFieldConfidences,
} from "../lib/ai/confidence";
import {
  InMemoryUsageStore,
  checkLlmBudgetAndRateLimit,
  estimateOpenAiCostUsd,
  getCurrentYearMonthUtc,
} from "../lib/ai/cost-tracker";
import {
  diffCorrectedFields,
  logExtractionAttempt,
} from "../lib/ai/extraction-logger";
import { extractKiaFromImage } from "../lib/ai/extract-kia";
import {
  buildSyntheticGoldenSet,
  createSyntheticBaselinePredictions,
} from "../eval/extraction/golden-set";
import { evaluateGoldenSet } from "../eval/extraction/evaluator";

const ROOT = path.resolve(__dirname, "..");

function buildSampleOutput(
  overrides: Partial<KiaExtractionOutput> = {}
): KiaExtractionOutput {
  return {
    schema_version: EXTRACTION_SCHEMA_VERSION,
    halaman_terdeteksi: "tabel_pertumbuhan",
    baris_kunjungan: [
      {
        baris_index: 1,
        tgl_ukur: { value: "2026-09-12", confidence: 0.96 },
        bb_kg: { value: 8.2, confidence: 0.94 },
        pb_tb_cm: { value: 73.5, confidence: 0.92 },
        cara_ukur: { value: "berbaring", confidence: 0.95 },
        lk_cm: { value: 44.5, confidence: 0.9 },
        lila_cm: { value: 13.4, confidence: 0.89 },
        imunisasi: { value: "Campak-Rubella", confidence: 0.87 },
        asi_eksklusif: { value: true, confidence: 0.97 },
      },
    ],
    catatan_ekstraksi: null,
    ...overrides,
  };
}

describe("Fase 2.1 - Pipeline AI Ekstraksi Buku KIA & Evaluasi Golden Set (F2-01 s.d. F2-10)", () => {
  it("memiliki seluruh modul Pipeline AI & Golden Set serta bebas karakter em dash", () => {
    const requiredFiles = [
      "lib/ai/prompts.ts",
      "lib/ai/confidence.ts",
      "lib/ai/cost-tracker.ts",
      "lib/ai/extraction-logger.ts",
      "lib/ai/extract-kia.ts",
      "eval/extraction/golden-set.ts",
      "eval/extraction/evaluator.ts",
      "eval/extraction/run.ts",
    ];

    for (const rel of requiredFiles) {
      const fullPath = path.join(ROOT, rel);
      expect(fs.existsSync(fullPath), `Berkas belum ada: ${rel}`).toBe(true);
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(
        content.includes("\u2014"),
        `Ditemukan karakter em dash pada berkas: ${rel}`
      ).toBe(false);
    }
  });

  describe("F2-01 & F2-02: Prompt Berversi & Kalibrasi Skor Keyakinan", () => {
    it("menyediakan prompt sistem dan user prompt berversi dengan konteks opsional", () => {
      expect(EXTRACTION_PROMPT_VERSION).toBe("kia-extraction-v1.0");
      expect(KIA_EXTRACTION_SYSTEM_PROMPT).toContain("YYYY-MM-DD");
      const userPrompt = buildKiaExtractionUserPrompt({
        hintPageType: "tabel_pertumbuhan",
        childAgeMonths: 14,
      });
      expect(userPrompt).toContain("tabel_pertumbuhan");
      expect(userPrompt).toContain("14 bulan");
    });

    it("membatasi confidence ke [0, 1] dan memberi penalti pada nilai antropometri di luar PLAUSIBILITY_LIMITS", () => {
      expect(clampConfidence(1.4)).toBe(1);
      expect(clampConfidence(-0.3)).toBe(0);
      expect(clampConfidence(Number.NaN)).toBe(0);

      const implausibleOutput = buildSampleOutput({
        baris_kunjungan: [
          {
            baris_index: 1,
            tgl_ukur: { value: "2027-01-15", confidence: 0.99 },
            bb_kg: { value: 45.0, confidence: 0.98 }, // di luar 1-30 kg
            pb_tb_cm: { value: 150.0, confidence: 0.95 }, // di luar 40-130 cm
            cara_ukur: { value: "berdiri", confidence: 0.95 },
            lk_cm: { value: 44.0, confidence: 0.92 },
            lila_cm: { value: 13.0, confidence: 0.78 }, // di bawah 0.85
            imunisasi: { value: "HB-0", confidence: 0.9 },
            asi_eksklusif: { value: true, confidence: 0.95 },
          },
        ],
      });

      const calibrated = calibrateExtractionOutput(implausibleOutput, {
        referenceDate: "2026-11-16",
      });

      const row = calibrated.baris_kunjungan[0];
      expect(row).toBeDefined();
      expect(row?.bb_kg.confidence).toBeLessThanOrEqual(0.45);
      expect(row?.pb_tb_cm.confidence).toBeLessThanOrEqual(0.45);
      expect(row?.tgl_ukur.confidence).toBeLessThanOrEqual(0.45);
      expect(row?.plausibility_warnings.length).toBeGreaterThanOrEqual(3);
      expect(row?.low_confidence_fields).toEqual(
        expect.arrayContaining(["tgl_ukur", "bb_kg", "pb_tb_cm", "lila_cm"])
      );
      expect(calibrated.has_plausibility_warnings).toBe(true);

      const singleRowCal = calibrateRowConfidence(
        implausibleOutput.baris_kunjungan[0]!,
        { referenceDate: "2026-11-16" }
      );
      expect(singleRowCal.row_average_confidence).toBeGreaterThan(0);

      const summary = summarizeFieldConfidences([singleRowCal]);
      expect(summary.overall).toBeGreaterThan(0);
    });
  });

  describe("F2-01, F2-03, F2-04: Klien OpenAI Vision, Retry, Fallback, & Logging", () => {
    it("mengekstrak gambar menggunakan model utama gpt-4o-mini dan mencatat log", async () => {
      const sample = buildSampleOutput();
      const insertedLogs: Array<Record<string, unknown>> = [];
      let capturedBody: { response_format?: unknown } | undefined;

      const mockFetch: typeof fetch = async (_url, init) => {
        capturedBody = JSON.parse(String(init?.body ?? "{}")) as {
          response_format?: unknown;
        };
        return new Response(
          JSON.stringify({
            model: "gpt-4o-mini",
            choices: [{ message: { content: JSON.stringify(sample) } }],
            usage: { prompt_tokens: 1200, completion_tokens: 300, total_tokens: 1500 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const usageStore = new InMemoryUsageStore();
      const result = await extractKiaFromImage(
        {
          imageUrl: "https://example.supabase.co/storage/v1/object/sign/kia.jpg",
          userId: "kader-1",
          extractionJobId: "job-123",
          referenceDate: "2026-11-16",
        },
        {
          apiKey: "test-openai-key",
          primaryModel: "gpt-4o-mini",
          fallbackModel: "gpt-4o",
          fetcher: mockFetch,
          usageStore,
          supabaseClient: {
            from: () => ({
              insert: async (row) => {
                insertedLogs.push(row);
                return { error: null };
              },
            }),
          },
        }
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.status).toBe("siap_verifikasi");
        expect(result.usedFallbackModel).toBe(false);
        expect(result.modelUsed).toBe("gpt-4o-mini");
        expect(result.data.baris_kunjungan.length).toBe(1);
        expect(result.estimatedCostUsd).toBeGreaterThan(0);
      }

      expect(capturedBody).toBeDefined();
      expect(capturedBody?.response_format).toEqual(OPENAI_KIA_RESPONSE_FORMAT);
      expect(insertedLogs.length).toBe(1);
      expect(insertedLogs[0]?.model).toBe("gpt-4o-mini");
      expect(insertedLogs[0]?.versi_prompt).toBe(EXTRACTION_PROMPT_VERSION);

      const spend = await usageStore.getMonthlySpendUsd(getCurrentYearMonthUtc());
      expect(spend).toBeGreaterThan(0);
    });

    it("otomatis berpindah ke model fallback gpt-4o apabila gpt-4o-mini gagal/5xx (F2-03)", async () => {
      const sample = buildSampleOutput();
      const calledModels: string[] = [];

      const mockFetch: typeof fetch = async (_url, init) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { model: string };
        calledModels.push(body.model);

        if (body.model === "gpt-4o-mini") {
          return new Response(
            JSON.stringify({ error: { message: "Temporary upstream failure" } }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            model: "gpt-4o",
            choices: [{ message: { content: JSON.stringify(sample) } }],
            usage: { prompt_tokens: 1000, completion_tokens: 250 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const result = await extractKiaFromImage(
        {
          imageUrl: "data:image/jpeg;base64,ZmFrZQ==",
          referenceDate: "2026-11-16",
        },
        {
          apiKey: "test-openai-key",
          primaryModel: "gpt-4o-mini",
          fallbackModel: "gpt-4o",
          maxRetriesPerModel: 1,
          fetcher: mockFetch,
          skipDbLogging: true,
        }
      );

      expect(calledModels).toEqual(["gpt-4o-mini", "gpt-4o-mini", "gpt-4o"]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.usedFallbackModel).toBe(true);
        expect(result.modelUsed).toBe("gpt-4o");
      }
    });

    it("mengembalikan status gagal dengan fallbackToManual=true apabila semua model gagal atau timeout", async () => {
      const mockFetch: typeof fetch = async () => {
        const abortErr = new Error("Aborted");
        abortErr.name = "AbortError";
        throw abortErr;
      };

      const result = await extractKiaFromImage(
        { imageUrl: "https://example.com/kia.jpg" },
        {
          apiKey: "test-openai-key",
          primaryModel: "gpt-4o-mini",
          fallbackModel: "gpt-4o",
          maxRetriesPerModel: 0,
          fetcher: mockFetch,
          skipDbLogging: true,
        }
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe("gagal");
        expect(result.fallbackToManual).toBe(true);
        expect(result.attempts.length).toBe(2);
        expect(result.errorMessage).toContain("Timeout");
      }
    });

    it("mencatat field yang dikoreksi manusia terhadap hasil ekstraksi AI (KPI-6)", async () => {
      const sample = buildSampleOutput();
      const row = sample.baris_kunjungan[0]!;
      const diffs = diffCorrectedFields(row, {
        bb_kg: 8.5,
        pb_tb_cm: 73.5, // tidak berubah
        imunisasi: "Campak",
      });

      expect(diffs).toEqual({
        bb_kg: { before: 8.2, after: 8.5 },
        imunisasi: { before: "Campak-Rubella", after: "Campak" },
      });

      const logRes = await logExtractionAttempt(
        {
          model: "gpt-4o-mini",
          versi_prompt: EXTRACTION_PROMPT_VERSION,
          field_dikoreksi: diffs,
          latensi_ms: 2150,
          estimasi_biaya_usd: 0.0004,
        },
        {
          supabaseClient: {
            from: () => ({
              insert: async () => ({ error: null }),
            }),
          },
        }
      );
      expect(logRes.logged).toBe(true);
    });
  });

  describe("F2-05: Pelacak Biaya LLM, Peringatan 70%, Putus 100%, & Rate Limit", () => {
    it("menghitung biaya token dan memicu peringatan 70% serta putus otomatis pada 100% batas US$4.00", async () => {
      const miniCost = estimateOpenAiCostUsd("gpt-4o-mini", {
        prompt_tokens: 1_000_000,
        completion_tokens: 1_000_000,
      });
      expect(miniCost).toBeCloseTo(0.75, 4);

      const warnCheck = checkLlmBudgetAndRateLimit({
        currentMonthlySpendUsd: 2.85, // 71.25% dari $4.00
        userCallsLastHour: 5,
      });
      expect(warnCheck.allowed).toBe(true);
      expect(warnCheck.warningTriggered).toBe(true);
      expect(warnCheck.budgetExceeded).toBe(false);

      const cutoffCheck = checkLlmBudgetAndRateLimit({
        currentMonthlySpendUsd: 4.0,
        userCallsLastHour: 1,
      });
      expect(cutoffCheck.allowed).toBe(false);
      expect(cutoffCheck.budgetExceeded).toBe(true);
      expect(cutoffCheck.fallbackToManual).toBe(true);

      const rateLimitCheck = checkLlmBudgetAndRateLimit({
        currentMonthlySpendUsd: 1.0,
        userCallsLastHour: 30,
      });
      expect(rateLimitCheck.allowed).toBe(false);
      expect(rateLimitCheck.rateLimited).toBe(true);
      expect(rateLimitCheck.fallbackToManual).toBe(true);

      // Pastikan extractKiaFromImage menolak memanggil fetch jika budget 100% habis
      let fetchCalled = false;
      const blockedResult = await extractKiaFromImage(
        { imageUrl: "https://example.com/kia.jpg", userId: "kader-1" },
        {
          apiKey: "test-openai-key",
          currentMonthlySpendUsd: 4.05,
          fetcher: async () => {
            fetchCalled = true;
            return new Response("{}");
          },
          skipDbLogging: true,
        }
      );

      expect(fetchCalled).toBe(false);
      expect(blockedResult.ok).toBe(false);
      if (!blockedResult.ok) {
        expect(blockedResult.budgetExceeded).toBe(true);
        expect(blockedResult.fallbackToManual).toBe(true);
      }
    });
  });

  describe("F2-06 s.d. F2-10: Dataset Golden Set >= 100 Halaman & Evaluasi KPI", () => {
    it("menghasilkan >= 100 halaman Golden Set sintetis valid skema F0-07 dan memenuhi KPI-1, KPI-3, serta batas kompresi <= 2 poin", () => {
      const goldenSet = buildSyntheticGoldenSet(60); // 120 sampel
      expect(goldenSet.length).toBeGreaterThanOrEqual(100);

      for (const sample of goldenSet) {
        const parsed = kiaExtractionOutputSchema.safeParse(sample.groundTruth);
        expect(
          parsed.success,
          `Ground truth tidak valid pada ${sample.sampleId}`
        ).toBe(true);
      }

      const baselinePreds = createSyntheticBaselinePredictions(goldenSet);
      const report = evaluateGoldenSet(goldenSet, baselinePreds);

      expect(report.totalSamples).toBe(120);
      expect(report.printed.accuracyPct).toBeGreaterThanOrEqual(95);
      expect(report.handwritten.accuracyPct).toBeGreaterThanOrEqual(85);
      expect(report.latencyMedianMs).toBeLessThanOrEqual(5000);
      expect(report.latencyP90Ms).toBeLessThanOrEqual(8000);
      expect(report.compressionAccuracyDropPts).toBeLessThanOrEqual(2.0);
      expect(report.kpiChecks.allPassed).toBe(true);
    });
  });
});
