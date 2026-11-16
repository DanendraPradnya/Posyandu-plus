/**
 * Mesin Evaluasi Akurasi Per-Field, Latensi, & Dampak Kompresi Golden Set (F2-08..F2-10)
 * Mengukur:
 * - KPI-3: Akurasi field cetak >= 95%, tulisan tangan >= 85%
 * - KPI-1: Latensi median <= 5.000 ms, P90 <= 8.000 ms
 * - FR3 / F2-10: Penurunan akurasi akibat kompresi <= 1 MB maksimal 2 poin persentase
 */

import type { ExtractedVisitRow } from "../../lib/types";
import type { GoldenSetPrediction, GoldenSetSample } from "./golden-set";

export type EvalFieldKey =
  | "tgl_ukur"
  | "bb_kg"
  | "pb_tb_cm"
  | "cara_ukur"
  | "lk_cm"
  | "lila_cm"
  | "imunisasi"
  | "asi_eksklusif";

const EVAL_FIELDS: readonly EvalFieldKey[] = [
  "tgl_ukur",
  "bb_kg",
  "pb_tb_cm",
  "cara_ukur",
  "lk_cm",
  "lila_cm",
  "imunisasi",
  "asi_eksklusif",
] as const;

export interface GoldenSetEvalItem {
  sample: GoldenSetSample;
  prediction: GoldenSetPrediction;
}

export interface CategoryAccuracyStats {
  sampleCount: number;
  totalFields: number;
  matchedFields: number;
  accuracyPct: number;
}

export interface FieldBreakdownStats {
  field: EvalFieldKey;
  total: number;
  matched: number;
  accuracyPct: number;
}

export interface GoldenSetEvaluationReport {
  totalSamples: number;
  printed: CategoryAccuracyStats;
  handwritten: CategoryAccuracyStats;
  overallAccuracyPct: number;
  originalPhotos: CategoryAccuracyStats;
  compressedPhotos: CategoryAccuracyStats;
  compressionAccuracyDropPts: number;
  latencyMedianMs: number;
  latencyP90Ms: number;
  fieldBreakdown: FieldBreakdownStats[];
  kpiChecks: {
    kpi1MedianPass: boolean; // <= 5000 ms
    kpi1P90Pass: boolean; // <= 8000 ms
    kpi3PrintedPass: boolean; // >= 95%
    kpi3HandwrittenPass: boolean; // >= 85%
    compressionPass: boolean; // penurunan <= 2.0 poin persentase
    allPassed: boolean;
  };
}

/**
 * Membandingkan nilai kebenaran dan nilai prediksi untuk satu field secara presisi (F2-08).
 * Nilai numerik dan tanggal harus sama persis.
 */
export function isFieldExactMatch(
  field: EvalFieldKey,
  expected: unknown,
  actual: unknown
): boolean {
  if (expected === null && actual === null) return true;
  if (expected === null || actual === null || expected === undefined || actual === undefined) {
    return false;
  }

  if (
    field === "bb_kg" ||
    field === "pb_tb_cm" ||
    field === "lk_cm" ||
    field === "lila_cm"
  ) {
    if (typeof expected !== "number" || typeof actual !== "number") return false;
    return Math.abs(expected - actual) < 1e-6;
  }

  if (field === "imunisasi" && typeof expected === "string" && typeof actual === "string") {
    return expected.trim().toLowerCase() === actual.trim().toLowerCase();
  }

  return expected === actual;
}

/**
 * Menghitung persentil secara linear interpolation dari daftar angka.
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (percentile / 100) * (sorted.length - 1);
  const lowerIdx = Math.floor(rank);
  const upperIdx = Math.ceil(rank);
  const lowerVal = sorted[lowerIdx] ?? 0;
  const upperVal = sorted[upperIdx] ?? lowerVal;
  if (lowerIdx === upperIdx) return Number(lowerVal.toFixed(2));
  const weight = rank - lowerIdx;
  return Number((lowerVal + (upperVal - lowerVal) * weight).toFixed(2));
}

function toCategoryStats(
  sampleCount: number,
  matchedFields: number,
  totalFields: number
): CategoryAccuracyStats {
  const accuracyPct =
    totalFields === 0
      ? 0
      : Number(((matchedFields / totalFields) * 100).toFixed(2));
  return {
    sampleCount,
    totalFields,
    matchedFields,
    accuracyPct,
  };
}

/**
 * Mengevaluasi seluruh item Golden Set dan menghasilkan laporan metrik KPI-1, KPI-3, dan FR3.
 */
export function evaluateGoldenSet(
  samples: GoldenSetSample[],
  predictions: GoldenSetPrediction[]
): GoldenSetEvaluationReport {
  const predMap = new Map<string, GoldenSetPrediction>();
  for (const pred of predictions) {
    predMap.set(pred.sampleId, pred);
  }

  let printedSamples = 0;
  let printedMatched = 0;
  let printedTotal = 0;

  let handSamples = 0;
  let handMatched = 0;
  let handTotal = 0;

  let origSamples = 0;
  let origMatched = 0;
  let origTotal = 0;

  let compSamples = 0;
  let compMatched = 0;
  let compTotal = 0;

  const latencies: number[] = [];
  const fieldTotals: Record<EvalFieldKey, { matched: number; total: number }> = {
    tgl_ukur: { matched: 0, total: 0 },
    bb_kg: { matched: 0, total: 0 },
    pb_tb_cm: { matched: 0, total: 0 },
    cara_ukur: { matched: 0, total: 0 },
    lk_cm: { matched: 0, total: 0 },
    lila_cm: { matched: 0, total: 0 },
    imunisasi: { matched: 0, total: 0 },
    asi_eksklusif: { matched: 0, total: 0 },
  };

  for (const sample of samples) {
    const pred = predMap.get(sample.sampleId);
    let sampleMatched = 0;
    let sampleTotal = 0;

    if (pred) {
      latencies.push(pred.latencyMs);
    }

    const gtRows = sample.groundTruth.baris_kunjungan;
    const predRows: ExtractedVisitRow[] = pred?.predicted.baris_kunjungan ?? [];

    for (let i = 0; i < gtRows.length; i++) {
      const gtRow = gtRows[i];
      if (!gtRow) continue;

      const matchedPredRow =
        predRows.find((r) => r.baris_index === gtRow.baris_index) ?? predRows[i];

      for (const field of EVAL_FIELDS) {
        sampleTotal += 1;
        fieldTotals[field].total += 1;

        const expectedVal = gtRow[field].value;
        const actualVal = matchedPredRow ? matchedPredRow[field].value : null;

        if (isFieldExactMatch(field, expectedVal, actualVal)) {
          sampleMatched += 1;
          fieldTotals[field].matched += 1;
        }
      }
    }

    if (sample.inputType === "cetak") {
      printedSamples += 1;
      printedMatched += sampleMatched;
      printedTotal += sampleTotal;
    } else {
      handSamples += 1;
      handMatched += sampleMatched;
      handTotal += sampleTotal;
    }

    if (sample.isCompressedUnder1Mb) {
      compSamples += 1;
      compMatched += sampleMatched;
      compTotal += sampleTotal;
    } else {
      origSamples += 1;
      origMatched += sampleMatched;
      origTotal += sampleTotal;
    }
  }

  const printed = toCategoryStats(printedSamples, printedMatched, printedTotal);
  const handwritten = toCategoryStats(handSamples, handMatched, handTotal);
  const originalPhotos = toCategoryStats(origSamples, origMatched, origTotal);
  const compressedPhotos = toCategoryStats(compSamples, compMatched, compTotal);

  const totalMatchedAll = printedMatched + handMatched;
  const totalFieldsAll = printedTotal + handTotal;
  const overallAccuracyPct =
    totalFieldsAll === 0
      ? 0
      : Number(((totalMatchedAll / totalFieldsAll) * 100).toFixed(2));

  const compressionAccuracyDropPts = Number(
    (originalPhotos.accuracyPct - compressedPhotos.accuracyPct).toFixed(2)
  );

  const latencyMedianMs = calculatePercentile(latencies, 50);
  const latencyP90Ms = calculatePercentile(latencies, 90);

  const fieldBreakdown: FieldBreakdownStats[] = EVAL_FIELDS.map((field) => {
    const stat = fieldTotals[field];
    return {
      field,
      total: stat.total,
      matched: stat.matched,
      accuracyPct:
        stat.total === 0
          ? 0
          : Number(((stat.matched / stat.total) * 100).toFixed(2)),
    };
  });

  const kpi1MedianPass = latencyMedianMs <= 5000;
  const kpi1P90Pass = latencyP90Ms <= 8000;
  const kpi3PrintedPass = printed.accuracyPct >= 95.0;
  const kpi3HandwrittenPass = handwritten.accuracyPct >= 85.0;
  const compressionPass = compressionAccuracyDropPts <= 2.0;

  return {
    totalSamples: samples.length,
    printed,
    handwritten,
    overallAccuracyPct,
    originalPhotos,
    compressedPhotos,
    compressionAccuracyDropPts,
    latencyMedianMs,
    latencyP90Ms,
    fieldBreakdown,
    kpiChecks: {
      kpi1MedianPass,
      kpi1P90Pass,
      kpi3PrintedPass,
      kpi3HandwrittenPass,
      compressionPass,
      allPassed:
        kpi1MedianPass &&
        kpi1P90Pass &&
        kpi3PrintedPass &&
        kpi3HandwrittenPass &&
        compressionPass,
    },
  };
}
