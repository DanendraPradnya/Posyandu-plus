/**
 * Pelacak Biaya LLM, Pemutus Anggaran Otomatis, dan Rate Limiter (F2-05)
 * Mengacu pada NFR6 dan PRD Posyandu+ Bab 12.2 (batas default US$4.00/bulan, peringatan 70%).
 */

export interface OpenAiTokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ModelPricingPer1M {
  inputUsd: number;
  outputUsd: number;
}

/**
 * Tarif referensi per 1 juta token (USD) untuk keluarga model OpenAI Vision & Text.
 */
export const OPENAI_PRICING_PER_1M: Record<string, ModelPricingPer1M> = {
  "gpt-4o-mini": { inputUsd: 0.15, outputUsd: 0.6 },
  "gpt-4o": { inputUsd: 2.5, outputUsd: 10.0 },
  "gpt-4.1-mini": { inputUsd: 0.4, outputUsd: 1.6 },
  "gpt-4.1": { inputUsd: 2.0, outputUsd: 8.0 },
};

const DEFAULT_FALLBACK_PRICING: ModelPricingPer1M = {
  inputUsd: 0.15,
  outputUsd: 0.6,
};

export interface LlmBudgetConfig {
  monthlyBudgetUsd: number;
  warnThresholdRatio: number;
  rateLimitPerUserPerHour: number;
}

export interface BudgetCheckInput {
  userId?: string;
  currentMonthlySpendUsd?: number;
  userCallsLastHour?: number;
  config?: Partial<LlmBudgetConfig>;
}

export interface BudgetCheckResult {
  allowed: boolean;
  budgetExceeded: boolean;
  rateLimited: boolean;
  warningTriggered: boolean;
  fallbackToManual: boolean;
  currentSpendUsd: number;
  monthlyBudgetUsd: number;
  utilizationRatio: number;
  userCallsLastHour: number;
  rateLimitPerUserPerHour: number;
  reason?: string;
}

export interface UsageStore {
  getMonthlySpendUsd(yearMonth: string): Promise<number>;
  getUserCallsLastHour(userId: string, nowMs?: number): Promise<number>;
  recordCall(entry: {
    userId?: string;
    costUsd: number;
    timestampMs?: number;
  }): Promise<void>;
}

function parsePositiveNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Membaca konfigurasi anggaran LLM dan batas laju dari environment variables.
 */
export function getLlmBudgetConfig(
  overrides: Partial<LlmBudgetConfig> = {}
): LlmBudgetConfig {
  return {
    monthlyBudgetUsd:
      overrides.monthlyBudgetUsd ??
      parsePositiveNumber(process.env.LLM_MONTHLY_BUDGET_USD, 4.0),
    warnThresholdRatio:
      overrides.warnThresholdRatio ??
      parsePositiveNumber(process.env.LLM_BUDGET_WARN_THRESHOLD, 0.7),
    rateLimitPerUserPerHour:
      overrides.rateLimitPerUserPerHour ??
      parsePositiveNumber(process.env.LLM_RATE_LIMIT_PER_USER_PER_HOUR, 30),
  };
}

/**
 * Menghitung estimasi biaya panggilan OpenAI API dalam USD.
 */
export function estimateOpenAiCostUsd(
  model: string,
  usage?: OpenAiTokenUsage
): number {
  if (!usage) return 0;

  const normalizedModel = model.toLowerCase();
  let pricing = OPENAI_PRICING_PER_1M[normalizedModel];
  if (!pricing) {
    const matchedKey = Object.keys(OPENAI_PRICING_PER_1M).find((key) =>
      normalizedModel.startsWith(key)
    );
    pricing = matchedKey
      ? OPENAI_PRICING_PER_1M[matchedKey]
      : DEFAULT_FALLBACK_PRICING;
  }

  const safePricing = pricing ?? DEFAULT_FALLBACK_PRICING;
  const promptTokens = Math.max(0, usage.prompt_tokens ?? 0);
  const completionTokens = Math.max(0, usage.completion_tokens ?? 0);

  const cost =
    (promptTokens / 1_000_000) * safePricing.inputUsd +
    (completionTokens / 1_000_000) * safePricing.outputUsd;

  return Number(cost.toFixed(6));
}

/**
 * Mengevaluasi apakah panggilan OpenAI diizinkan terhadap batas anggaran bulanan (100% cut-off)
 * dan batas laju per pengguna per jam (NFR6 & Bab 12.2).
 */
export function checkLlmBudgetAndRateLimit(
  input: BudgetCheckInput = {}
): BudgetCheckResult {
  const cfg = getLlmBudgetConfig(input.config);
  const currentSpendUsd = Math.max(0, input.currentMonthlySpendUsd ?? 0);
  const userCallsLastHour = Math.max(0, input.userCallsLastHour ?? 0);

  const utilizationRatio =
    cfg.monthlyBudgetUsd > 0
      ? Number((currentSpendUsd / cfg.monthlyBudgetUsd).toFixed(4))
      : 1;

  const warningTriggered = utilizationRatio >= cfg.warnThresholdRatio;
  const budgetExceeded = utilizationRatio >= 1.0;
  const rateLimited = userCallsLastHour >= cfg.rateLimitPerUserPerHour;

  if (budgetExceeded) {
    return {
      allowed: false,
      budgetExceeded: true,
      rateLimited,
      warningTriggered: true,
      fallbackToManual: true,
      currentSpendUsd,
      monthlyBudgetUsd: cfg.monthlyBudgetUsd,
      utilizationRatio,
      userCallsLastHour,
      rateLimitPerUserPerHour: cfg.rateLimitPerUserPerHour,
      reason: `Anggaran LLM bulanan (US$${cfg.monthlyBudgetUsd.toFixed(2)}) telah tercapai. Sistem beralih ke mode input manual.`,
    };
  }

  if (rateLimited) {
    return {
      allowed: false,
      budgetExceeded: false,
      rateLimited: true,
      warningTriggered,
      fallbackToManual: true,
      currentSpendUsd,
      monthlyBudgetUsd: cfg.monthlyBudgetUsd,
      utilizationRatio,
      userCallsLastHour,
      rateLimitPerUserPerHour: cfg.rateLimitPerUserPerHour,
      reason: `Batas pemakaian (${cfg.rateLimitPerUserPerHour} ekstraksi per jam per petugas) tercapai. Silakan gunakan input manual atau tunggu sebentar.`,
    };
  }

  return {
    allowed: true,
    budgetExceeded: false,
    rateLimited: false,
    warningTriggered,
    fallbackToManual: false,
    currentSpendUsd,
    monthlyBudgetUsd: cfg.monthlyBudgetUsd,
    utilizationRatio,
    userCallsLastHour,
    rateLimitPerUserPerHour: cfg.rateLimitPerUserPerHour,
  };
}

/**
 * Penyimpanan pelacak penggunaan di memori untuk pengujian unit, simulasi, dan fallback lokal.
 */
export class InMemoryUsageStore implements UsageStore {
  private monthlySpend = new Map<string, number>();
  private userCallTimestamps = new Map<string, number[]>();

  constructor(initialSpend?: Record<string, number>) {
    if (initialSpend) {
      for (const [ym, amount] of Object.entries(initialSpend)) {
        this.monthlySpend.set(ym, amount);
      }
    }
  }

  async getMonthlySpendUsd(yearMonth: string): Promise<number> {
    return this.monthlySpend.get(yearMonth) ?? 0;
  }

  async getUserCallsLastHour(userId: string, nowMs = Date.now()): Promise<number> {
    const timestamps = this.userCallTimestamps.get(userId) ?? [];
    const oneHourAgo = nowMs - 3_600_000;
    const recent = timestamps.filter((ts) => ts >= oneHourAgo);
    this.userCallTimestamps.set(userId, recent);
    return recent.length;
  }

  async recordCall(entry: {
    userId?: string;
    costUsd: number;
    timestampMs?: number;
  }): Promise<void> {
    const ts = entry.timestampMs ?? Date.now();
    const date = new Date(ts);
    const ym = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

    const prev = this.monthlySpend.get(ym) ?? 0;
    this.monthlySpend.set(ym, Number((prev + Math.max(0, entry.costUsd)).toFixed(6)));

    if (entry.userId) {
      const existing = this.userCallTimestamps.get(entry.userId) ?? [];
      existing.push(ts);
      this.userCallTimestamps.set(entry.userId, existing);
    }
  }
}

export function getCurrentYearMonthUtc(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
