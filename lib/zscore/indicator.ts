/**
 * Pemilihan Indikator, Koreksi Cara Ukur, dan Kasus Tepi (F1-14 & F1-15)
 * Mengacu pada PRD Posyandu+ v2.2 Bab 5 (FR5).
 */

import { IndicatorType, MeasurementMethod, Sex, ZScoreResult } from "../types";
import { checkBiologicalImpossibility, classifyZScore } from "./classification";
import { calculateZScore } from "./lms";

export const ZSCORE_TABLE_VERSION = "WHO-2006-Permenkes-2-2020-v1" as const;

export interface IndicatorSelection {
  lengthHeightIndicator: "PB/U" | "TB/U";
  weightLengthHeightIndicator: "BB/PB" | "BB/TB";
  standardMethod: MeasurementMethod;
}

/**
 * Menentukan indikator antropometri yang berlaku berdasarkan usia balita.
 * - Usia < 24 bulan: PB/U dan BB/PB (standar ukur: berbaring)
 * - Usia >= 24 bulan: TB/U dan BB/TB (standar ukur: berdiri)
 */
export function determineIndicators(ageMonths: number): IndicatorSelection {
  if (ageMonths < 24) {
    return {
      lengthHeightIndicator: "PB/U",
      weightLengthHeightIndicator: "BB/PB",
      standardMethod: "berbaring",
    };
  }

  return {
    lengthHeightIndicator: "TB/U",
    weightLengthHeightIndicator: "BB/TB",
    standardMethod: "berdiri",
  };
}

/**
 * Koreksi cara ukur 0,7 cm (F1-14 & FR5):
 * - Usia < 24 bulan tetapi diukur berdiri -> tambah +0,7 cm (dikonversi ke panjang berbaring).
 * - Usia >= 24 bulan tetapi diukur berbaring -> kurangi -0,7 cm (dikonversi ke tinggi berdiri).
 * - Jika sesuai usia atau cara ukur tidak diisi -> koreksi 0 cm.
 */
export function applyMeasurementMethodCorrection(
  method: MeasurementMethod | null | undefined,
  ageMonths: number,
  pbTbCm: number | null
): { correctedPbTbCm: number | null; correctionCm: number } {
  if (pbTbCm === null || Number.isNaN(pbTbCm) || pbTbCm <= 0) {
    return { correctedPbTbCm: null, correctionCm: 0 };
  }

  let correctionCm = 0;

  if (ageMonths < 24 && method === "berdiri") {
    correctionCm = 0.7;
  } else if (ageMonths >= 24 && method === "berbaring") {
    correctionCm = -0.7;
  }

  const correctedPbTbCm = Math.round((pbTbCm + correctionCm) * 10) / 10;
  return { correctedPbTbCm, correctionCm };
}

/**
 * Menghitung Indeks Massa Tubuh (IMT / BMI):
 * IMT = BB (kg) / (Tinggi (m))^2
 */
export function calculateBmi(
  weightKg: number | null,
  heightCm: number | null
): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    return null;
  }

  const heightM = heightCm / 100.0;
  const bmi = weightKg / (heightM * heightM);
  return Math.round((bmi + Number.EPSILON) * 100) / 100;
}

/**
 * Helper untuk menghitung satu hasil ZScoreResult lengkap dengan klasifikasi,
 * penanganan kasus tepi, flag biologis tidak mungkin, dan versi tabel (F1-15, F1-18).
 */
export function buildZScoreResult(
  indicator: IndicatorType,
  sex: Sex,
  x: number,
  y: number | null,
  correctionCm = 0
): ZScoreResult {
  // Jika nilai input kosong
  if (y === null || Number.isNaN(y) || y <= 0) {
    return {
      indikator: indicator,
      nilai_z: null,
      klasifikasi: "Tidak dapat dihitung",
      flag_biologis_tidak_mungkin: false,
      koreksi_cara_ukur_cm: correctionCm,
      versi_tabel: ZSCORE_TABLE_VERSION,
    };
  }

  const { zScore, isOutOfRange } = calculateZScore(indicator, sex, x, y);

  // Jika nilai di luar rentang tabel referensi
  if (isOutOfRange || zScore === null) {
    return {
      indikator: indicator,
      nilai_z: null,
      klasifikasi: "Tidak dapat dihitung",
      flag_biologis_tidak_mungkin: false,
      koreksi_cara_ukur_cm: correctionCm,
      versi_tabel: ZSCORE_TABLE_VERSION,
    };
  }

  // Periksa apakah ekstrem biologis
  const flagBio = checkBiologicalImpossibility(indicator, zScore);
  const klasifikasi = classifyZScore(indicator, zScore, flagBio);

  return {
    indikator: indicator,
    nilai_z: zScore,
    klasifikasi,
    flag_biologis_tidak_mungkin: flagBio,
    koreksi_cara_ukur_cm: correctionCm,
    versi_tabel: ZSCORE_TABLE_VERSION,
  };
}