/**
 * Validasi Plausibilitas & Anotasi Baris Pengukuran Antropometri (FR4, Fase 2)
 * Memastikan data hasil ekstraksi AI maupun input manual berada dalam rentang biologis
 * yang masuk akal dan usia balita 0-59 bulan sebelum disimpan ke basis data.
 */

import { PLAUSIBILITY_LIMITS } from "../ai/extraction-schema";
import type { ExtractedVisitRow, Measurement, MeasurementMethod, Sex } from "../types";
import { calculateAllZScores } from "../zscore";
import { calculateAgeInMonths, validateAgeInMonths } from "../zscore/age";

export interface MeasurementRowInput {
  tgl_ukur: string;
  bb_kg: number | null;
  pb_tb_cm: number | null;
  cara_ukur: MeasurementMethod | null;
  lk_cm: number | null;
  lila_cm: number | null;
  imunisasi: string | null;
  asi_eksklusif: boolean | null;
}

export interface MeasurementValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  ageMonths: number | null;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getTodayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Memvalidasi satu baris pengukuran sebelum disimpan ke tabel `measurements`.
 */
export function validateMeasurementRow(
  row: MeasurementRowInput,
  childBirthDate: string,
  referenceDate: string = getTodayIsoUtc()
): MeasurementValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let ageMonths: number | null = null;

  // 1. Validasi tanggal pengukuran
  if (!row.tgl_ukur || !ISO_DATE_REGEX.test(row.tgl_ukur)) {
    errors.push("Tanggal pengukuran wajib berformat YYYY-MM-DD.");
  } else {
    if (row.tgl_ukur > referenceDate) {
      errors.push("Tanggal pengukuran tidak boleh berada di masa depan.");
    }
    if (row.tgl_ukur < childBirthDate) {
      errors.push("Tanggal pengukuran tidak boleh lebih awal dari tanggal lahir balita.");
    }

    ageMonths = calculateAgeInMonths(childBirthDate, row.tgl_ukur);
    const ageCheck = validateAgeInMonths(ageMonths);
    if (!ageCheck.isValid) {
      errors.push(
        ageCheck.errorMessage ?? "Usia balita saat pengukuran harus 0-59 bulan."
      );
    }
  }

  // 2. Berat badan wajib diisi dan dalam rentang plausibilitas (1-30 kg)
  if (row.bb_kg === null || Number.isNaN(row.bb_kg)) {
    errors.push("Berat badan (kg) wajib diisi.");
  } else if (
    row.bb_kg < PLAUSIBILITY_LIMITS.BB_KG_MIN ||
    row.bb_kg > PLAUSIBILITY_LIMITS.BB_KG_MAX
  ) {
    errors.push(
      `Berat badan (${row.bb_kg} kg) di luar rentang wajar (${PLAUSIBILITY_LIMITS.BB_KG_MIN}-${PLAUSIBILITY_LIMITS.BB_KG_MAX} kg).`
    );
  }

  // 3. Panjang / Tinggi badan opsional, jika diisi harus 40-130 cm
  if (row.pb_tb_cm !== null && !Number.isNaN(row.pb_tb_cm)) {
    if (
      row.pb_tb_cm < PLAUSIBILITY_LIMITS.PB_TB_CM_MIN ||
      row.pb_tb_cm > PLAUSIBILITY_LIMITS.PB_TB_CM_MAX
    ) {
      errors.push(
        `Panjang/tinggi badan (${row.pb_tb_cm} cm) di luar rentang wajar (${PLAUSIBILITY_LIMITS.PB_TB_CM_MIN}-${PLAUSIBILITY_LIMITS.PB_TB_CM_MAX} cm).`
      );
    }
    if (!row.cara_ukur) {
      warnings.push("Cara ukur (berbaring/berdiri) belum dipilih; sistem akan memakai standar usia.");
    }
  }

  // 4. Lingkar kepala opsional, jika diisi harus 25-60 cm
  if (row.lk_cm !== null && !Number.isNaN(row.lk_cm)) {
    if (
      row.lk_cm < PLAUSIBILITY_LIMITS.LK_CM_MIN ||
      row.lk_cm > PLAUSIBILITY_LIMITS.LK_CM_MAX
    ) {
      errors.push(
        `Lingkar kepala (${row.lk_cm} cm) di luar rentang wajar (${PLAUSIBILITY_LIMITS.LK_CM_MIN}-${PLAUSIBILITY_LIMITS.LK_CM_MAX} cm).`
      );
    }
  }

  // 5. LiLA opsional, jika diisi harus dalam rentang DB (5-30 cm) dan beri peringatan jika di luar 6-25 cm
  if (row.lila_cm !== null && !Number.isNaN(row.lila_cm)) {
    if (row.lila_cm < 5.0 || row.lila_cm > 30.0) {
      errors.push("LiLA harus berada di rentang 5.0-30.0 cm.");
    } else if (
      row.lila_cm < PLAUSIBILITY_LIMITS.LILA_CM_MIN ||
      row.lila_cm > PLAUSIBILITY_LIMITS.LILA_CM_MAX
    ) {
      warnings.push(
        `Nilai LiLA (${row.lila_cm} cm) di luar rentang umum (${PLAUSIBILITY_LIMITS.LILA_CM_MIN}-${PLAUSIBILITY_LIMITS.LILA_CM_MAX} cm). Mohon periksa kembali.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    ageMonths,
  };
}

/**
 * Menambahkan penanda duplikat tanggal dan peringatan plausibilitas pada setiap baris hasil ekstraksi AI.
 */
export function annotateExtractedRows(
  rows: ExtractedVisitRow[],
  existingMeasureDates: Set<string>,
  childBirthDate: string,
  referenceDate: string = getTodayIsoUtc()
): ExtractedVisitRow[] {
  return rows.map((row) => {
    const tgl = row.tgl_ukur.value;
    const isDuplicate = Boolean(tgl && existingMeasureDates.has(tgl));

    const validation = validateMeasurementRow(
      {
        tgl_ukur: tgl ?? "",
        bb_kg: row.bb_kg.value,
        pb_tb_cm: row.pb_tb_cm.value,
        cara_ukur: row.cara_ukur.value,
        lk_cm: row.lk_cm.value,
        lila_cm: row.lila_cm.value,
        imunisasi: row.imunisasi.value,
        asi_eksklusif: row.asi_eksklusif.value,
      },
      childBirthDate,
      referenceDate
    );

    const lowConfidenceFields: string[] = [];
    const threshold = PLAUSIBILITY_LIMITS.LOW_CONFIDENCE_THRESHOLD;
    if (row.tgl_ukur.value !== null && row.tgl_ukur.confidence < threshold) {
      lowConfidenceFields.push("Tanggal ukur");
    }
    if (row.bb_kg.value !== null && row.bb_kg.confidence < threshold) {
      lowConfidenceFields.push("Berat badan");
    }
    if (row.pb_tb_cm.value !== null && row.pb_tb_cm.confidence < threshold) {
      lowConfidenceFields.push("Panjang/tinggi badan");
    }
    if (row.lk_cm.value !== null && row.lk_cm.confidence < threshold) {
      lowConfidenceFields.push("Lingkar kepala");
    }
    if (row.lila_cm.value !== null && row.lila_cm.confidence < threshold) {
      lowConfidenceFields.push("LiLA");
    }

    const combinedWarnings = [...validation.errors, ...validation.warnings];
    if (lowConfidenceFields.length > 0) {
      combinedWarnings.push(
        `Keyakinan AI rendah pada: ${lowConfidenceFields.join(", ")}. Mohon cek ulang dengan foto.`
      );
    }

    return {
      ...row,
      is_duplicate: isDuplicate,
      plausibility_warnings: combinedWarnings,
    };
  });
}

export interface AnomalyCheckResult {
  hasAnomalies: boolean;
  anomalyWarnings: string[];
}

/**
 * Memeriksa anomali biologis WHO (Z-Score ekstrem) dan anomali tren dibanding
 * kunjungan sebelumnya agar Kader diminta mengecek ulang angka sebelum menyimpan.
 */
export function checkMeasurementAnomalies(
  row: MeasurementRowInput,
  childBirthDate: string,
  sex: Sex,
  previousMeasurements: Measurement[] = []
): AnomalyCheckResult {
  const anomalyWarnings: string[] = [];

  if (!row.tgl_ukur || row.bb_kg === null || Number.isNaN(row.bb_kg)) {
    return { hasAnomalies: false, anomalyWarnings };
  }

  // 1. Cek WHO Biological Implausibility Flagging (FR5)
  try {
    const zOutput = calculateAllZScores({
      birthDate: childBirthDate,
      measureDate: row.tgl_ukur,
      sex,
      weightKg: row.bb_kg,
      pbTbCm: row.pb_tb_cm,
      measurementMethod: row.cara_ukur,
      headCircumferenceCm: row.lk_cm,
      armCircumferenceCm: row.lila_cm,
    });

    for (const res of Object.values(zOutput.results)) {
      if (res && res.flag_biologis_tidak_mungkin && res.nilai_z !== null) {
        anomalyWarnings.push(
          `Anomali Biologis WHO pada ${res.indikator} (${res.nilai_z.toFixed(2)} SD): nilai ekstrem, perlu cek ulang / pengukuran ulang.`
        );
      }
    }
  } catch {
    // Abaikan jika tanggal belum lengkap
  }

  // 2. Cek anomali terhadap kunjungan sebelumnya yang paling dekat sebelum tgl_ukur
  const prior = previousMeasurements
    .filter((m) => m.tgl_ukur < row.tgl_ukur)
    .sort((a, b) => (a.tgl_ukur > b.tgl_ukur ? -1 : 1))[0];

  if (prior) {
    if (
      row.pb_tb_cm !== null &&
      !Number.isNaN(row.pb_tb_cm) &&
      prior.pb_tb_cm !== null &&
      prior.pb_tb_cm - row.pb_tb_cm > 1.0
    ) {
      const diff = (prior.pb_tb_cm - row.pb_tb_cm).toFixed(1);
      anomalyWarnings.push(
        `Tinggi/panjang badan menyusut ${diff} cm dibanding kunjungan ${prior.tgl_ukur} (${prior.pb_tb_cm} cm). Mohon cek ulang.`
      );
    }

    const prevTime = new Date(prior.tgl_ukur).getTime();
    const currTime = new Date(row.tgl_ukur).getTime();
    const diffDays = Math.max(1, (currTime - prevTime) / (1000 * 60 * 60 * 24));
    const bbDiff = Math.abs(row.bb_kg - prior.bb_kg);

    if (diffDays <= 40 && bbDiff > 2.5) {
      anomalyWarnings.push(
        `Perubahan berat badan drastis (${bbDiff.toFixed(1)} kg dalam ${Math.round(diffDays)} hari dibanding ${prior.bb_kg} kg pada ${prior.tgl_ukur}). Mohon cek ulang angka atau tanda koma.`
      );
    }
  }

  return {
    hasAnomalies: anomalyWarnings.length > 0,
    anomalyWarnings,
  };
}
