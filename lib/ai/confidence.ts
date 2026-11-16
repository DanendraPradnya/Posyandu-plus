/**
 * Kalibrasi Skor Keyakinan & Heuristik Plausibilitas Ekstraksi KIA (F2-02)
 * Memastikan seluruh skor berada di rentang [0, 1] dan memberi penalti/peringatan
 * untuk nilai yang berada di luar rentang wajar PLAUSIBILITY_LIMITS.
 */

import type { ExtractedVisitRow, KiaExtractionOutput } from "../types";
import { PLAUSIBILITY_LIMITS } from "./extraction-schema";

export type VisitFieldKey =
  | "tgl_ukur"
  | "bb_kg"
  | "pb_tb_cm"
  | "cara_ukur"
  | "lk_cm"
  | "lila_cm"
  | "imunisasi"
  | "asi_eksklusif";

const ALL_VISIT_FIELDS: readonly VisitFieldKey[] = [
  "tgl_ukur",
  "bb_kg",
  "pb_tb_cm",
  "cara_ukur",
  "lk_cm",
  "lila_cm",
  "imunisasi",
  "asi_eksklusif",
] as const;

const IMPLAUSIBLE_CONFIDENCE_CAP = 0.45;

export interface CalibratedVisitRow extends ExtractedVisitRow {
  plausibility_warnings: string[];
  low_confidence_fields: VisitFieldKey[];
  row_average_confidence: number;
}

export interface CalibratedExtractionOutput
  extends Omit<KiaExtractionOutput, "baris_kunjungan"> {
  baris_kunjungan: CalibratedVisitRow[];
  overall_confidence: number;
  low_confidence_field_count: number;
  has_plausibility_warnings: boolean;
}

export interface CalibrationOptions {
  referenceDate?: string; // YYYY-MM-DD
  lowConfidenceThreshold?: number;
}

/**
 * Membatasi nilai confidence ke rentang [0, 1] dengan 4 angka desimal.
 */
export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(1, Math.max(0, value));
  return Number(clamped.toFixed(4));
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface NumericBoundRule {
  field: "bb_kg" | "pb_tb_cm" | "lk_cm" | "lila_cm";
  label: string;
  unit: string;
  min: number;
  max: number;
}

const NUMERIC_BOUND_RULES: readonly NumericBoundRule[] = [
  {
    field: "bb_kg",
    label: "Berat badan",
    unit: "kg",
    min: PLAUSIBILITY_LIMITS.BB_KG_MIN,
    max: PLAUSIBILITY_LIMITS.BB_KG_MAX,
  },
  {
    field: "pb_tb_cm",
    label: "Panjang/tinggi badan",
    unit: "cm",
    min: PLAUSIBILITY_LIMITS.PB_TB_CM_MIN,
    max: PLAUSIBILITY_LIMITS.PB_TB_CM_MAX,
  },
  {
    field: "lk_cm",
    label: "Lingkar kepala",
    unit: "cm",
    min: PLAUSIBILITY_LIMITS.LK_CM_MIN,
    max: PLAUSIBILITY_LIMITS.LK_CM_MAX,
  },
  {
    field: "lila_cm",
    label: "LiLA",
    unit: "cm",
    min: PLAUSIBILITY_LIMITS.LILA_CM_MIN,
    max: PLAUSIBILITY_LIMITS.LILA_CM_MAX,
  },
] as const;

/**
 * Mengkalibrasi satu baris hasil ekstraksi dan mengevaluasi batas kewajaran fisiologis.
 */
export function calibrateRowConfidence(
  row: ExtractedVisitRow,
  options: CalibrationOptions = {}
): CalibratedVisitRow {
  const threshold =
    options.lowConfidenceThreshold ?? PLAUSIBILITY_LIMITS.LOW_CONFIDENCE_THRESHOLD;
  const refDate = options.referenceDate ?? getTodayIsoDate();

  const calibrated: ExtractedVisitRow = {
    baris_index: row.baris_index,
    tgl_ukur: {
      value: row.tgl_ukur.value,
      confidence: clampConfidence(row.tgl_ukur.confidence),
    },
    bb_kg: {
      value: row.bb_kg.value,
      confidence: clampConfidence(row.bb_kg.confidence),
    },
    pb_tb_cm: {
      value: row.pb_tb_cm.value,
      confidence: clampConfidence(row.pb_tb_cm.confidence),
    },
    cara_ukur: {
      value: row.cara_ukur.value,
      confidence: clampConfidence(row.cara_ukur.confidence),
    },
    lk_cm: {
      value: row.lk_cm.value,
      confidence: clampConfidence(row.lk_cm.confidence),
    },
    lila_cm: {
      value: row.lila_cm.value,
      confidence: clampConfidence(row.lila_cm.confidence),
    },
    imunisasi: {
      value: row.imunisasi.value,
      confidence: clampConfidence(row.imunisasi.confidence),
    },
    asi_eksklusif: {
      value: row.asi_eksklusif.value,
      confidence: clampConfidence(row.asi_eksklusif.confidence),
    },
  };

  const warnings: string[] = [...(row.plausibility_warnings ?? [])];

  // Validasi tanggal tidak di masa depan
  if (calibrated.tgl_ukur.value !== null && calibrated.tgl_ukur.value > refDate) {
    calibrated.tgl_ukur.confidence = Math.min(
      calibrated.tgl_ukur.confidence,
      IMPLAUSIBLE_CONFIDENCE_CAP
    );
    warnings.push(
      `Tanggal ukur (${calibrated.tgl_ukur.value}) melebihi tanggal hari ini (${refDate}).`
    );
  }

  // Validasi batas numerik antropometri sesuai PLAUSIBILITY_LIMITS
  for (const rule of NUMERIC_BOUND_RULES) {
    const fieldObj = calibrated[rule.field];
    if (fieldObj.value !== null) {
      if (fieldObj.value < rule.min || fieldObj.value > rule.max) {
        fieldObj.confidence = Math.min(
          fieldObj.confidence,
          IMPLAUSIBLE_CONFIDENCE_CAP
        );
        warnings.push(
          `${rule.label} (${fieldObj.value} ${rule.unit}) di luar rentang wajar (${rule.min}-${rule.max} ${rule.unit}).`
        );
      }
    }
  }

  const lowConfidenceFields: VisitFieldKey[] = [];
  let sumConfidence = 0;

  for (const key of ALL_VISIT_FIELDS) {
    const fieldObj = calibrated[key];
    sumConfidence += fieldObj.confidence;
    if (fieldObj.value !== null && fieldObj.confidence < threshold) {
      lowConfidenceFields.push(key);
    }
  }

  const rowAverage = Number((sumConfidence / ALL_VISIT_FIELDS.length).toFixed(4));

  return {
    ...calibrated,
    is_duplicate: row.is_duplicate,
    plausibility_warnings: warnings,
    low_confidence_fields: lowConfidenceFields,
    row_average_confidence: rowAverage,
  };
}

/**
 * Mengkalibrasi seluruh output ekstraksi KIA dan menghasilkan ringkasan metrik keyakinan.
 */
export function calibrateExtractionOutput(
  output: KiaExtractionOutput,
  options: CalibrationOptions = {}
): CalibratedExtractionOutput {
  const rows = output.baris_kunjungan.map((row) =>
    calibrateRowConfidence(row, options)
  );

  const lowConfidenceCount = rows.reduce(
    (acc, r) => acc + r.low_confidence_fields.length,
    0
  );
  const hasWarnings = rows.some((r) => r.plausibility_warnings.length > 0);
  const overallConfidence =
    rows.length === 0
      ? 0
      : Number(
          (
            rows.reduce((acc, r) => acc + r.row_average_confidence, 0) /
            rows.length
          ).toFixed(4)
        );

  return {
    schema_version: output.schema_version,
    halaman_terdeteksi: output.halaman_terdeteksi,
    baris_kunjungan: rows,
    catatan_ekstraksi: output.catatan_ekstraksi,
    overall_confidence: overallConfidence,
    low_confidence_field_count: lowConfidenceCount,
    has_plausibility_warnings: hasWarnings,
  };
}

/**
 * Menghitung rata-rata confidence per field di seluruh baris untuk disimpan di extraction_logs.keyakinan.
 */
export function summarizeFieldConfidences(
  rows: ExtractedVisitRow[]
): Record<VisitFieldKey | "overall", number> {
  const summary: Record<string, number> = {};
  if (rows.length === 0) {
    for (const key of ALL_VISIT_FIELDS) {
      summary[key] = 0;
    }
    summary.overall = 0;
    return summary as Record<VisitFieldKey | "overall", number>;
  }

  let totalOverall = 0;
  for (const key of ALL_VISIT_FIELDS) {
    const avg =
      rows.reduce((sum, r) => sum + clampConfidence(r[key].confidence), 0) /
      rows.length;
    const rounded = Number(avg.toFixed(4));
    summary[key] = rounded;
    totalOverall += rounded;
  }

  summary.overall = Number((totalOverall / ALL_VISIT_FIELDS.length).toFixed(4));
  return summary as Record<VisitFieldKey | "overall", number>;
}
