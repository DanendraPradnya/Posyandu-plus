/**
 * Modul Z-Score Engine Deterministik Posyandu+ (Fase 1 - F1-12 s.d. F1-20)
 * Mengacu pada Standar Antropometri Anak Permenkes No. 2 Tahun 2020 / WHO 2006 LMS.
 */

import { IndicatorType, MeasurementMethod, Sex, ZScoreResult } from "../types";
import { calculateAgeInMonths, validateAgeInMonths } from "./age";
import { classifyLila } from "./classification";
import {
  applyMeasurementMethodCorrection,
  buildZScoreResult,
  calculateBmi,
  determineIndicators,
  ZSCORE_TABLE_VERSION,
} from "./indicator";

export * from "./age";
export * from "./classification";
export * from "./indicator";
export * from "./lms";

export interface CalculateZScoresInput {
  birthDate: string; // YYYY-MM-DD
  measureDate: string; // YYYY-MM-DD
  sex: Sex;
  weightKg: number;
  pbTbCm: number | null;
  measurementMethod?: MeasurementMethod | null;
  headCircumferenceCm?: number | null;
  armCircumferenceCm?: number | null;
}

export interface ComprehensiveZScoreOutput {
  ageMonths: number;
  isAgeValid: boolean;
  ageError?: string;
  correctedPbTbCm: number | null;
  correctionCm: number;
  bmi: number | null;
  results: Record<IndicatorType, ZScoreResult>;
  lilaClassification: string | null;
  activeLengthHeightIndicator: "PB/U" | "TB/U";
  activeWeightLengthHeightIndicator: "BB/PB" | "BB/TB";
  versiTabel: string;
}

/**
 * Menghitung seluruh Z-Score dan klasifikasi status gizi untuk satu kunjungan balita.
 */
export function calculateAllZScores(
  input: CalculateZScoresInput
): ComprehensiveZScoreOutput {
  const {
    birthDate,
    measureDate,
    sex,
    weightKg,
    pbTbCm,
    measurementMethod,
    headCircumferenceCm,
    armCircumferenceCm,
  } = input;

  // 1. Usia balita
  const ageMonths = calculateAgeInMonths(birthDate, measureDate);
  const ageValidation = validateAgeInMonths(ageMonths);

  // 2. Pemilihan indikator berdasarkan usia (< 24 bulan vs >= 24 bulan)
  const indicatorSelection = determineIndicators(ageMonths);

  // 3. Koreksi cara ukur 0,7 cm jika cara ukur tidak sesuai standar usia
  const { correctedPbTbCm, correctionCm } = applyMeasurementMethodCorrection(
    measurementMethod,
    ageMonths,
    pbTbCm
  );

  // 4. Hitung IMT jika tinggi badan tersedia
  const bmi = calculateBmi(weightKg, correctedPbTbCm);

  // 5. Hitung masing-masing indikator
  // a. BB/U (semua usia 0-59 bulan)
  const bbu = buildZScoreResult("BB/U", sex, ageMonths, weightKg, 0);

  // b. Panjang/Tinggi menurut Usia (PB/U atau TB/U)
  const pbu =
    indicatorSelection.lengthHeightIndicator === "PB/U"
      ? buildZScoreResult("PB/U", sex, ageMonths, correctedPbTbCm, correctionCm)
      : buildZScoreResult("PB/U", sex, ageMonths, null, 0);

  const tbu =
    indicatorSelection.lengthHeightIndicator === "TB/U"
      ? buildZScoreResult("TB/U", sex, ageMonths, correctedPbTbCm, correctionCm)
      : buildZScoreResult("TB/U", sex, ageMonths, null, 0);

  // c. Berat menurut Panjang/Tinggi (BB/PB atau BB/TB)
  // Catatan: sumbu x untuk BB/PB dan BB/TB adalah panjang/tinggi badan (cm)
  const bbpb =
    indicatorSelection.weightLengthHeightIndicator === "BB/PB" && correctedPbTbCm !== null
      ? buildZScoreResult("BB/PB", sex, correctedPbTbCm, weightKg, correctionCm)
      : buildZScoreResult("BB/PB", sex, 0, null, 0);

  const bbtb =
    indicatorSelection.weightLengthHeightIndicator === "BB/TB" && correctedPbTbCm !== null
      ? buildZScoreResult("BB/TB", sex, correctedPbTbCm, weightKg, correctionCm)
      : buildZScoreResult("BB/TB", sex, 0, null, 0);

  // d. IMT/U (semua usia 0-59 bulan)
  const imtu = buildZScoreResult("IMT/U", sex, ageMonths, bmi, correctionCm);

  // e. LK/U (Lingkar Kepala menurut Usia)
  const lku = buildZScoreResult(
    "LK/U",
    sex,
    ageMonths,
    headCircumferenceCm ?? null,
    0
  );

  // 6. Skrining LiLA
  const lilaClassification = classifyLila(armCircumferenceCm ?? null, ageMonths);

  return {
    ageMonths,
    isAgeValid: ageValidation.isValid,
    ageError: ageValidation.errorMessage,
    correctedPbTbCm,
    correctionCm,
    bmi,
    results: {
      "BB/U": bbu,
      "PB/U": pbu,
      "TB/U": tbu,
      "BB/PB": bbpb,
      "BB/TB": bbtb,
      "IMT/U": imtu,
      "LK/U": lku,
    },
    lilaClassification,
    activeLengthHeightIndicator: indicatorSelection.lengthHeightIndicator,
    activeWeightLengthHeightIndicator: indicatorSelection.weightLengthHeightIndicator,
    versiTabel: ZSCORE_TABLE_VERSION,
  };
}
