/**
 * Validasi Plausibilitas & Deteksi Duplikat Ekstraksi KIA (F2-13 & F2-14).
 * Memastikan tidak ada data di luar batas biologis atau duplikat tanggal ukur
 * yang dapat masuk ke rekam medis.
 */

import type { ExtractedVisitRow, KiaExtractionOutput } from "../types";
import { PLAUSIBILITY_LIMITS } from "../ai/extraction-schema";
import { calculateAgeInMonths, validateAgeInMonths } from "../zscore/age";
import type { MeasurementInputRow } from "./types";

export interface PlausibilityValidationOptions {
  childBirthDate?: string;
  referenceDate?: string; // YYYY-MM-DD
}

export interface PlausibilityValidationResult {
  isValid: boolean;
  ageMonths: number | null;
  fieldErrors: Record<string, string>;
  warnings: string[];
}

export interface AnnotatedExtractionValidationResult {
  annotatedOutput: KiaExtractionOutput;
  isValid: boolean;
  hasDuplicates: boolean;
  rowErrors: Array<{
    baris_index: number;
    fieldErrors: Record<string, string>;
    warnings: string[];
    isDuplicate: boolean;
  }>;
  summaryMessage: string | null;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidIsoCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parts = dateStr.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

/**
 * Memvalidasi satu baris pengukuran (hasil AI atau input manual) terhadap batas
 * plausibilitas WHO/DB (F2-13).
 */
export function validateMeasurementPlausibility(
  row: Partial<Record<keyof MeasurementInputRow, unknown>>,
  options: PlausibilityValidationOptions = {}
): PlausibilityValidationResult {
  const refDate = options.referenceDate ?? getTodayIsoDate();
  const fieldErrors: Record<string, string> = {};
  const warnings: string[] = [];
  let ageMonths: number | null = null;

  // 1. Tanggal ukur (wajib, kalender valid, tidak di masa depan, usia 0-59 bln)
  const rawDate = row.tgl_ukur;
  if (typeof rawDate !== "string" || !isValidIsoCalendarDate(rawDate)) {
    const msg = "Tanggal ukur wajib berformat YYYY-MM-DD yang valid.";
    fieldErrors.tgl_ukur = msg;
    warnings.push(msg);
  } else {
    if (rawDate > refDate) {
      const msg = `Tanggal ukur (${rawDate}) tidak boleh berada di masa depan (batas: ${refDate}).`;
      fieldErrors.tgl_ukur = msg;
      warnings.push(msg);
    } else if (options.childBirthDate) {
      try {
        const computedAge = calculateAgeInMonths(
          options.childBirthDate,
          rawDate
        );
        const ageCheck = validateAgeInMonths(computedAge);
        if (!ageCheck.isValid) {
          const msg =
            ageCheck.errorMessage ??
            "Usia balita pada tanggal ukur harus antara 0-59 bulan.";
          fieldErrors.tgl_ukur = msg;
          warnings.push(msg);
        } else {
          ageMonths = ageCheck.ageMonths;
        }
      } catch {
        const msg = "Gagal menghitung usia balita dari tanggal lahir.";
        fieldErrors.tgl_ukur = msg;
        warnings.push(msg);
      }
    }
  }

  // 2. Berat badan (wajib, 1.0 - 30.0 kg)
  const rawBb = row.bb_kg;
  if (typeof rawBb !== "number" || !Number.isFinite(rawBb)) {
    const msg = "Berat badan (bb_kg) wajib diisi dengan angka yang valid.";
    fieldErrors.bb_kg = msg;
    warnings.push(msg);
  } else if (
    rawBb < PLAUSIBILITY_LIMITS.BB_KG_MIN ||
    rawBb > PLAUSIBILITY_LIMITS.BB_KG_MAX
  ) {
    const msg = `Berat badan (${rawBb} kg) di luar rentang wajar (${PLAUSIBILITY_LIMITS.BB_KG_MIN}-${PLAUSIBILITY_LIMITS.BB_KG_MAX} kg).`;
    fieldErrors.bb_kg = msg;
    warnings.push(msg);
  }

  // 3. Panjang/tinggi badan (opsional, 40.0 - 130.0 cm)
  const rawPb = row.pb_tb_cm;
  if (rawPb !== undefined && rawPb !== null) {
    if (typeof rawPb !== "number" || !Number.isFinite(rawPb)) {
      const msg = "Panjang/tinggi badan (pb_tb_cm) harus berupa angka.";
      fieldErrors.pb_tb_cm = msg;
      warnings.push(msg);
    } else if (
      rawPb < PLAUSIBILITY_LIMITS.PB_TB_CM_MIN ||
      rawPb > PLAUSIBILITY_LIMITS.PB_TB_CM_MAX
    ) {
      const msg = `Panjang/tinggi badan (${rawPb} cm) di luar rentang wajar (${PLAUSIBILITY_LIMITS.PB_TB_CM_MIN}-${PLAUSIBILITY_LIMITS.PB_TB_CM_MAX} cm).`;
      fieldErrors.pb_tb_cm = msg;
      warnings.push(msg);
    }
  }

  // 4. Cara ukur (opsional, berbaring | berdiri)
  const rawCara = row.cara_ukur;
  if (rawCara !== undefined && rawCara !== null) {
    if (rawCara !== "berbaring" && rawCara !== "berdiri") {
      const msg = "Cara ukur harus bernilai 'berbaring' atau 'berdiri'.";
      fieldErrors.cara_ukur = msg;
      warnings.push(msg);
    }
  }

  // 5. Lingkar kepala (opsional, 25.0 - 60.0 cm)
  const rawLk = row.lk_cm;
  if (rawLk !== undefined && rawLk !== null) {
    if (typeof rawLk !== "number" || !Number.isFinite(rawLk)) {
      const msg = "Lingkar kepala (lk_cm) harus berupa angka.";
      fieldErrors.lk_cm = msg;
      warnings.push(msg);
    } else if (
      rawLk < PLAUSIBILITY_LIMITS.LK_CM_MIN ||
      rawLk > PLAUSIBILITY_LIMITS.LK_CM_MAX
    ) {
      const msg = `Lingkar kepala (${rawLk} cm) di luar rentang wajar (${PLAUSIBILITY_LIMITS.LK_CM_MIN}-${PLAUSIBILITY_LIMITS.LK_CM_MAX} cm).`;
      fieldErrors.lk_cm = msg;
      warnings.push(msg);
    }
  }

  // 6. Lingkar lengan atas / LiLA (opsional, 6.0 - 25.0 cm)
  const rawLila = row.lila_cm;
  if (rawLila !== undefined && rawLila !== null) {
    if (typeof rawLila !== "number" || !Number.isFinite(rawLila)) {
      const msg = "LiLA (lila_cm) harus berupa angka.";
      fieldErrors.lila_cm = msg;
      warnings.push(msg);
    } else if (
      rawLila < PLAUSIBILITY_LIMITS.LILA_CM_MIN ||
      rawLila > PLAUSIBILITY_LIMITS.LILA_CM_MAX
    ) {
      const msg = `LiLA (${rawLila} cm) di luar rentang wajar (${PLAUSIBILITY_LIMITS.LILA_CM_MIN}-${PLAUSIBILITY_LIMITS.LILA_CM_MAX} cm).`;
      fieldErrors.lila_cm = msg;
      warnings.push(msg);
    }
  }

  return {
    isValid: Object.keys(fieldErrors).length === 0,
    ageMonths,
    fieldErrors,
    warnings,
  };
}

/**
 * Menandai baris hasil ekstraksi yang tanggal ukurnya sudah tercatat di DB (F2-14).
 */
export function annotateDuplicateRows(
  rows: ExtractedVisitRow[],
  existingMeasureDates: string[]
): ExtractedVisitRow[] {
  const existingSet = new Set(existingMeasureDates);
  return rows.map((row) => {
    const dateVal = row.tgl_ukur.value;
    const isDuplicate = dateVal !== null && existingSet.has(dateVal);
    return {
      ...row,
      is_duplicate: isDuplicate,
    };
  });
}

/**
 * Memvalidasi seluruh output ekstraksi AI, menyematkan peringatan per field (F2-13),
 * serta menandai baris duplikat (F2-14).
 */
export function validateAndAnnotateExtractedOutput(
  output: KiaExtractionOutput,
  options: PlausibilityValidationOptions & {
    existingMeasureDates: string[];
  }
): AnnotatedExtractionValidationResult {
  const duplicateAnnotated = annotateDuplicateRows(
    output.baris_kunjungan,
    options.existingMeasureDates
  );

  const rowErrors: AnnotatedExtractionValidationResult["rowErrors"] = [];
  let hasDuplicates = false;
  let allRowsValid = true;

  const finalRows: ExtractedVisitRow[] = duplicateAnnotated.map((row) => {
    const validation = validateMeasurementPlausibility(
      {
        tgl_ukur: row.tgl_ukur.value,
        bb_kg: row.bb_kg.value,
        pb_tb_cm: row.pb_tb_cm.value,
        cara_ukur: row.cara_ukur.value,
        lk_cm: row.lk_cm.value,
        lila_cm: row.lila_cm.value,
      },
      {
        childBirthDate: options.childBirthDate,
        referenceDate: options.referenceDate,
      }
    );

    const isDuplicate = Boolean(row.is_duplicate);
    if (isDuplicate) {
      hasDuplicates = true;
    }

    const combinedWarnings = Array.from(
      new Set([...(row.plausibility_warnings ?? []), ...validation.warnings])
    );

    if (!validation.isValid) {
      allRowsValid = false;
    }

    rowErrors.push({
      baris_index: row.baris_index,
      fieldErrors: validation.fieldErrors,
      warnings: combinedWarnings,
      isDuplicate,
    });

    return {
      ...row,
      is_duplicate: isDuplicate,
      plausibility_warnings: combinedWarnings,
    };
  });

  const isOutputRecognized =
    output.halaman_terdeteksi !== "tidak_dikenali" && finalRows.length > 0;
  const isValid = isOutputRecognized && allRowsValid;

  let summaryMessage: string | null = null;
  if (!isOutputRecognized) {
    summaryMessage =
      output.halaman_terdeteksi === "tidak_dikenali"
        ? "Foto tidak dikenali sebagai halaman pemantauan pertumbuhan atau catatan LiLA Buku KIA."
        : "Tidak ada baris pengukuran yang berhasil diekstrak dari foto Buku KIA.";
  } else if (!allRowsValid) {
    const reasons = rowErrors
      .filter((r) => Object.keys(r.fieldErrors).length > 0)
      .map(
        (r) =>
          `Baris ${r.baris_index}: ${Object.values(r.fieldErrors).join(" ")}`
      );
    summaryMessage = reasons.join(" | ");
  }

  return {
    annotatedOutput: {
      ...output,
      baris_kunjungan: finalRows,
    },
    isValid,
    hasDuplicates,
    rowErrors,
    summaryMessage,
  };
}

