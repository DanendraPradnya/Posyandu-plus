/**
 * Mesin Rumus LMS WHO 2006 & Interpolasi Tabel Referensi (F1-13)
 * Mengacu pada PRD Posyandu+ v2.2 Bab 5 (FR5, Keputusan #8).
 */

import { IndicatorType, Sex } from "../types";
import { LMS_TABLE, LmsPoint } from "./lms-data";

export interface LmsParams {
  L: number;
  M: number;
  S: number;
}

export interface CalculatedZScore {
  zScore: number | null;
  isOutOfRange: boolean;
  lms: LmsParams | null;
}

/**
 * Mencari parameter L, M, dan S berdasarkan indikator, jenis kelamin, dan nilai x.
 * Menerapkan interpolasi linear jika nilai x berada di antara dua titik tabel.
 * Mengembalikan null jika x berada di luar rentang tabel referensi.
 */
export function getLmsParameters(
  indicator: IndicatorType,
  sex: Sex,
  x: number
): LmsParams | null {
  const key = `${indicator}_${sex}`;
  const points: LmsPoint[] | undefined = LMS_TABLE[key];

  if (!points || points.length === 0) {
    return null;
  }

  const minX = points[0]!.x;
  const maxX = points[points.length - 1]!.x;

  // Nilai x berada di luar rentang tabel referensi
  if (x < minX || x > maxX) {
    return null;
  }

  // Cari titik eksak
  const exact = points.find((p) => Math.abs(p.x - x) < 1e-6);
  if (exact) {
    return { L: exact.L, M: exact.M, S: exact.S };
  }

  // Lakukan interpolasi linear jika x berada di antara dua titik berurutan
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;

    if (x >= p0.x && x <= p1.x) {
      const t = (x - p0.x) / (p1.x - p0.x);
      return {
        L: p0.L + t * (p1.L - p0.L),
        M: p0.M + t * (p1.M - p0.M),
        S: p0.S + t * (p1.S - p0.S),
      };
    }
  }

  return null;
}

/**
 * Menghitung nilai Z-Score standar WHO 2006 dari nilai pengukuran y dan parameter (L, M, S).
 * Menyertakan penyesuaian khusus WHO di luar rentang ±3 SD untuk indikator
 * BB/U, BB/PB, BB/TB, dan IMT/U.
 */
export function calculateZScore(
  indicator: IndicatorType,
  sex: Sex,
  x: number,
  y: number | null
): CalculatedZScore {
  if (y === null || Number.isNaN(y) || y <= 0) {
    return { zScore: null, isOutOfRange: false, lms: null };
  }

  const lms = getLmsParameters(indicator, sex, x);
  if (!lms) {
    return { zScore: null, isOutOfRange: true, lms: null };
  }

  const { L, M, S } = lms;

  // Rumus Z-Score dasar Box-Cox power exponential LMS
  let z: number;
  if (Math.abs(L) < 1e-7) {
    z = Math.log(y / M) / S;
  } else {
    z = (Math.pow(y / M, L) - 1.0) / (L * S);
  }

  // Penyesuaian khusus WHO di luar rentang ±3 SD untuk indikator asimetris
  const hasWhoAdjustment =
    indicator === "BB/U" ||
    indicator === "BB/PB" ||
    indicator === "BB/TB" ||
    indicator === "IMT/U";

  if (hasWhoAdjustment) {
    if (z > 3.0) {
      const sd3pos = M * Math.pow(1.0 + L * S * 3.0, 1.0 / L);
      const sd2pos = M * Math.pow(1.0 + L * S * 2.0, 1.0 / L);
      const sd23pos = sd3pos - sd2pos;
      z = 3.0 + (y - sd3pos) / sd23pos;
    } else if (z < -3.0) {
      const sd3neg = M * Math.pow(1.0 + L * S * -3.0, 1.0 / L);
      const sd2neg = M * Math.pow(1.0 + L * S * -2.0, 1.0 / L);
      const sd23neg = sd2neg - sd3neg;
      z = -3.0 + (y - sd3neg) / sd23neg;
    }
  }

  return {
    zScore: Math.round(z * 1000) / 1000, // Presisi 3 angka desimal
    isOutOfRange: false,
    lms,
  };
}

