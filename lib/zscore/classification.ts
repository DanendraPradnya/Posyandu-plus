/**
 * Klasifikasi Status Gizi Permenkes No. 2 Tahun 2020 & Skrining Tambahan (F1-16 & F1-17)
 * Mengacu pada PRD Posyandu+ v2.2 Bab 5 (FR5).
 */

import { IndicatorType } from "../types";

/**
 * Memeriksa apakah nilai Z-Score berada di luar batas biologis yang mungkin (WHO Extremes).
 */
export function checkBiologicalImpossibility(
  indicator: IndicatorType,
  z: number | null
): boolean {
  if (z === null || Number.isNaN(z)) {
    return false;
  }

  switch (indicator) {
    case "BB/U":
      return z < -6.0 || z > 5.0;
    case "PB/U":
    case "TB/U":
      return z < -6.0 || z > 6.0;
    case "BB/PB":
    case "BB/TB":
    case "IMT/U":
      return z < -5.0 || z > 5.0;
    case "LK/U":
      return z < -5.0 || z > 5.0;
    default:
      return false;
  }
}

/**
 * Mengklasifikasikan Z-Score berdasarkan ambang Permenkes No. 2 Tahun 2020.
 */
export function classifyZScore(
  indicator: IndicatorType,
  z: number | null,
  flagBiological = false
): string {
  if (z === null || Number.isNaN(z)) {
    return "Tidak dapat dihitung";
  }

  if (flagBiological) {
    return "Perlu pengukuran ulang";
  }

  switch (indicator) {
    case "BB/U":
      if (z < -3.0) return "Berat badan sangat kurang (severely underweight)";
      if (z < -2.0) return "Berat badan kurang (underweight)";
      if (z <= 1.0) return "Berat badan normal";
      return "Risiko berat badan lebih";

    case "PB/U":
    case "TB/U":
      if (z < -3.0) return "Sangat pendek (severely stunted)";
      if (z < -2.0) return "Pendek (stunted)";
      if (z <= 3.0) return "Normal";
      return "Tinggi";

    case "BB/PB":
    case "BB/TB":
    case "IMT/U":
      if (z < -3.0) return "Gizi buruk (severely wasted)";
      if (z < -2.0) return "Gizi kurang (wasted)";
      if (z <= 1.0) return "Gizi baik (normal)";
      if (z <= 2.0) return "Berisiko gizi lebih (possible risk of overweight)";
      if (z <= 3.0) return "Gizi lebih (overweight)";
      return "Obesitas (obese)";

    case "LK/U":
      if (z < -2.0) return "Mikrosefali";
      if (z <= 2.0) return "Normal";
      return "Makrosefali";

    default:
      return "Tidak dapat dihitung";
  }
}

/**
 * Skrining Lingkar Lengan Atas (LiLA) balita dan bayi (F1-17 & FR5).
 * - Usia 6-59 bulan: <11.5 cm (gizi buruk), 11.5-12.4 cm (gizi kurang), >=12.5 cm (gizi baik).
 * - Bayi 6 minggu - <6 bulan (atau usia 1-5 bulan): <11.0 cm (berisiko / rujuk), >=11.0 cm (normal).
 */
export function classifyLila(
  lilaCm: number | null,
  ageMonths: number
): string | null {
  if (lilaCm === null || Number.isNaN(lilaCm) || lilaCm <= 0) {
    return null;
  }

  if (ageMonths >= 6 && ageMonths <= 59) {
    if (lilaCm < 11.5) return "Gizi buruk";
    if (lilaCm < 12.5) return "Gizi kurang";
    return "Gizi baik";
  }

  if (ageMonths >= 1 && ageMonths < 6) {
    if (lilaCm < 11.0) return "Berisiko (rujuk)";
    return "Normal";
  }

  return null;
}
