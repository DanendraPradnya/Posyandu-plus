/**
 * Data Referensi KBM & Garis KMS Buku KIA (Fase 3 - B6)
 * Sumber: ref/ref_kbm.csv dan ref/ref_kms_line.csv (Permenkes 2/2020 & Buku KIA 2024/2025).
 */

import type { Sex } from "../types";

export interface KbmEntry {
  sex: Sex;
  ageMonthMin: number;
  ageMonthMax: number;
  kbmGram: number;
}

export interface KmsLinePoint {
  sex: Sex;
  chart: "0-2" | "2-5";
  ageMonth: number;
  redLineKg: number;
  orangeLineKg: number;
}

export const REF_KBM: KbmEntry[] = [
  { sex: "M", ageMonthMin: 1, ageMonthMax: 1, kbmGram: 800 },
  { sex: "M", ageMonthMin: 2, ageMonthMax: 2, kbmGram: 900 },
  { sex: "M", ageMonthMin: 3, ageMonthMax: 3, kbmGram: 800 },
  { sex: "M", ageMonthMin: 4, ageMonthMax: 4, kbmGram: 600 },
  { sex: "M", ageMonthMin: 5, ageMonthMax: 5, kbmGram: 500 },
  { sex: "M", ageMonthMin: 6, ageMonthMax: 6, kbmGram: 400 },
  { sex: "M", ageMonthMin: 7, ageMonthMax: 7, kbmGram: 400 },
  { sex: "M", ageMonthMin: 8, ageMonthMax: 10, kbmGram: 300 },
  { sex: "M", ageMonthMin: 11, ageMonthMax: 11, kbmGram: 300 },
  { sex: "M", ageMonthMin: 12, ageMonthMax: 24, kbmGram: 200 },
  { sex: "M", ageMonthMin: 25, ageMonthMax: 60, kbmGram: 200 },
  { sex: "F", ageMonthMin: 1, ageMonthMax: 1, kbmGram: 800 },
  { sex: "F", ageMonthMin: 2, ageMonthMax: 2, kbmGram: 900 },
  { sex: "F", ageMonthMin: 3, ageMonthMax: 3, kbmGram: 800 },
  { sex: "F", ageMonthMin: 4, ageMonthMax: 4, kbmGram: 600 },
  { sex: "F", ageMonthMin: 5, ageMonthMax: 5, kbmGram: 500 },
  { sex: "F", ageMonthMin: 6, ageMonthMax: 6, kbmGram: 400 },
  { sex: "F", ageMonthMin: 7, ageMonthMax: 7, kbmGram: 300 },
  { sex: "F", ageMonthMin: 8, ageMonthMax: 10, kbmGram: 300 },
  { sex: "F", ageMonthMin: 11, ageMonthMax: 11, kbmGram: 200 },
  { sex: "F", ageMonthMin: 12, ageMonthMax: 24, kbmGram: 200 },
  { sex: "F", ageMonthMin: 25, ageMonthMax: 60, kbmGram: 200 },
];

export const REF_KMS_LINE: KmsLinePoint[] = [
  // Laki-laki 0-2 tahun (0-24 bulan)
  { sex: "M", chart: "0-2", ageMonth: 0, redLineKg: 2.5, orangeLineKg: 3.9 },
  { sex: "M", chart: "0-2", ageMonth: 1, redLineKg: 3.4, orangeLineKg: 5.1 },
  { sex: "M", chart: "0-2", ageMonth: 2, redLineKg: 4.3, orangeLineKg: 6.3 },
  { sex: "M", chart: "0-2", ageMonth: 3, redLineKg: 5.0, orangeLineKg: 7.2 },
  { sex: "M", chart: "0-2", ageMonth: 4, redLineKg: 5.6, orangeLineKg: 7.9 },
  { sex: "M", chart: "0-2", ageMonth: 5, redLineKg: 6.0, orangeLineKg: 8.4 },
  { sex: "M", chart: "0-2", ageMonth: 6, redLineKg: 6.4, orangeLineKg: 8.9 },
  { sex: "M", chart: "0-2", ageMonth: 7, redLineKg: 6.7, orangeLineKg: 9.2 },
  { sex: "M", chart: "0-2", ageMonth: 8, redLineKg: 6.9, orangeLineKg: 9.6 },
  { sex: "M", chart: "0-2", ageMonth: 9, redLineKg: 7.1, orangeLineKg: 9.9 },
  { sex: "M", chart: "0-2", ageMonth: 10, redLineKg: 7.4, orangeLineKg: 10.2 },
  { sex: "M", chart: "0-2", ageMonth: 11, redLineKg: 7.6, orangeLineKg: 10.5 },
  { sex: "M", chart: "0-2", ageMonth: 12, redLineKg: 7.8, orangeLineKg: 10.8 },
  { sex: "M", chart: "0-2", ageMonth: 13, redLineKg: 7.9, orangeLineKg: 11.0 },
  { sex: "M", chart: "0-2", ageMonth: 14, redLineKg: 8.1, orangeLineKg: 11.3 },
  { sex: "M", chart: "0-2", ageMonth: 15, redLineKg: 8.3, orangeLineKg: 11.5 },
  { sex: "M", chart: "0-2", ageMonth: 16, redLineKg: 8.4, orangeLineKg: 11.8 },
  { sex: "M", chart: "0-2", ageMonth: 17, redLineKg: 8.6, orangeLineKg: 12.0 },
  { sex: "M", chart: "0-2", ageMonth: 18, redLineKg: 8.8, orangeLineKg: 12.2 },
  { sex: "M", chart: "0-2", ageMonth: 19, redLineKg: 8.9, orangeLineKg: 12.5 },
  { sex: "M", chart: "0-2", ageMonth: 20, redLineKg: 9.1, orangeLineKg: 12.7 },
  { sex: "M", chart: "0-2", ageMonth: 21, redLineKg: 9.2, orangeLineKg: 12.9 },
  { sex: "M", chart: "0-2", ageMonth: 22, redLineKg: 9.4, orangeLineKg: 13.2 },
  { sex: "M", chart: "0-2", ageMonth: 23, redLineKg: 9.6, orangeLineKg: 13.4 },
  { sex: "M", chart: "0-2", ageMonth: 24, redLineKg: 9.7, orangeLineKg: 13.6 },
  // Laki-laki 2-5 tahun (25-60 bulan)
  { sex: "M", chart: "2-5", ageMonth: 25, redLineKg: 9.8, orangeLineKg: 13.9 },
  { sex: "M", chart: "2-5", ageMonth: 26, redLineKg: 10.0, orangeLineKg: 14.1 },
  { sex: "M", chart: "2-5", ageMonth: 27, redLineKg: 10.1, orangeLineKg: 14.4 },
  { sex: "M", chart: "2-5", ageMonth: 28, redLineKg: 10.2, orangeLineKg: 14.6 },
  { sex: "M", chart: "2-5", ageMonth: 29, redLineKg: 10.4, orangeLineKg: 14.8 },
  { sex: "M", chart: "2-5", ageMonth: 30, redLineKg: 10.5, orangeLineKg: 15.0 },
  { sex: "M", chart: "2-5", ageMonth: 31, redLineKg: 10.7, orangeLineKg: 15.2 },
  { sex: "M", chart: "2-5", ageMonth: 32, redLineKg: 10.8, orangeLineKg: 15.5 },
  { sex: "M", chart: "2-5", ageMonth: 33, redLineKg: 10.9, orangeLineKg: 15.7 },
  { sex: "M", chart: "2-5", ageMonth: 34, redLineKg: 11.0, orangeLineKg: 15.9 },
  { sex: "M", chart: "2-5", ageMonth: 35, redLineKg: 11.2, orangeLineKg: 16.1 },
  { sex: "M", chart: "2-5", ageMonth: 36, redLineKg: 11.3, orangeLineKg: 16.3 },
  { sex: "M", chart: "2-5", ageMonth: 37, redLineKg: 11.4, orangeLineKg: 16.5 },
  { sex: "M", chart: "2-5", ageMonth: 38, redLineKg: 11.5, orangeLineKg: 16.7 },
  { sex: "M", chart: "2-5", ageMonth: 39, redLineKg: 11.6, orangeLineKg: 16.9 },
  { sex: "M", chart: "2-5", ageMonth: 40, redLineKg: 11.8, orangeLineKg: 17.1 },
  { sex: "M", chart: "2-5", ageMonth: 41, redLineKg: 11.9, orangeLineKg: 17.3 },
  { sex: "M", chart: "2-5", ageMonth: 42, redLineKg: 12.0, orangeLineKg: 17.5 },
  { sex: "M", chart: "2-5", ageMonth: 43, redLineKg: 12.1, orangeLineKg: 17.7 },
  { sex: "M", chart: "2-5", ageMonth: 44, redLineKg: 12.2, orangeLineKg: 17.9 },
  { sex: "M", chart: "2-5", ageMonth: 45, redLineKg: 12.4, orangeLineKg: 18.1 },
  { sex: "M", chart: "2-5", ageMonth: 46, redLineKg: 12.5, orangeLineKg: 18.3 },
  { sex: "M", chart: "2-5", ageMonth: 47, redLineKg: 12.6, orangeLineKg: 18.5 },
  { sex: "M", chart: "2-5", ageMonth: 48, redLineKg: 12.7, orangeLineKg: 18.7 },
  { sex: "M", chart: "2-5", ageMonth: 49, redLineKg: 12.8, orangeLineKg: 18.9 },
  { sex: "M", chart: "2-5", ageMonth: 50, redLineKg: 12.9, orangeLineKg: 19.1 },
  { sex: "M", chart: "2-5", ageMonth: 51, redLineKg: 13.1, orangeLineKg: 19.3 },
  { sex: "M", chart: "2-5", ageMonth: 52, redLineKg: 13.2, orangeLineKg: 19.5 },
  { sex: "M", chart: "2-5", ageMonth: 53, redLineKg: 13.3, orangeLineKg: 19.7 },
  { sex: "M", chart: "2-5", ageMonth: 54, redLineKg: 13.4, orangeLineKg: 19.9 },
  { sex: "M", chart: "2-5", ageMonth: 55, redLineKg: 13.5, orangeLineKg: 20.1 },
  { sex: "M", chart: "2-5", ageMonth: 56, redLineKg: 13.6, orangeLineKg: 20.3 },
  { sex: "M", chart: "2-5", ageMonth: 57, redLineKg: 13.7, orangeLineKg: 20.5 },
  { sex: "M", chart: "2-5", ageMonth: 58, redLineKg: 13.8, orangeLineKg: 20.7 },
  { sex: "M", chart: "2-5", ageMonth: 59, redLineKg: 14.0, orangeLineKg: 20.9 },
  { sex: "M", chart: "2-5", ageMonth: 60, redLineKg: 14.1, orangeLineKg: 21.1 },
  // Perempuan 0-2 tahun (0-24 bulan)
  { sex: "F", chart: "0-2", ageMonth: 0, redLineKg: 2.4, orangeLineKg: 3.7 },
  { sex: "F", chart: "0-2", ageMonth: 1, redLineKg: 3.2, orangeLineKg: 4.8 },
  { sex: "F", chart: "0-2", ageMonth: 2, redLineKg: 3.9, orangeLineKg: 5.8 },
  { sex: "F", chart: "0-2", ageMonth: 3, redLineKg: 4.5, orangeLineKg: 6.6 },
  { sex: "F", chart: "0-2", ageMonth: 4, redLineKg: 5.0, orangeLineKg: 7.3 },
  { sex: "F", chart: "0-2", ageMonth: 5, redLineKg: 5.4, orangeLineKg: 7.8 },
  { sex: "F", chart: "0-2", ageMonth: 6, redLineKg: 5.7, orangeLineKg: 8.3 },
  { sex: "F", chart: "0-2", ageMonth: 7, redLineKg: 6.0, orangeLineKg: 8.7 },
  { sex: "F", chart: "0-2", ageMonth: 8, redLineKg: 6.3, orangeLineKg: 9.0 },
  { sex: "F", chart: "0-2", ageMonth: 9, redLineKg: 6.5, orangeLineKg: 9.3 },
  { sex: "F", chart: "0-2", ageMonth: 10, redLineKg: 6.7, orangeLineKg: 9.6 },
  { sex: "F", chart: "0-2", ageMonth: 11, redLineKg: 6.9, orangeLineKg: 9.9 },
  { sex: "F", chart: "0-2", ageMonth: 12, redLineKg: 7.0, orangeLineKg: 10.2 },
  { sex: "F", chart: "0-2", ageMonth: 13, redLineKg: 7.2, orangeLineKg: 10.4 },
  { sex: "F", chart: "0-2", ageMonth: 14, redLineKg: 7.4, orangeLineKg: 10.7 },
  { sex: "F", chart: "0-2", ageMonth: 15, redLineKg: 7.6, orangeLineKg: 10.9 },
  { sex: "F", chart: "0-2", ageMonth: 16, redLineKg: 7.7, orangeLineKg: 11.2 },
  { sex: "F", chart: "0-2", ageMonth: 17, redLineKg: 7.9, orangeLineKg: 11.4 },
  { sex: "F", chart: "0-2", ageMonth: 18, redLineKg: 8.1, orangeLineKg: 11.7 },
  { sex: "F", chart: "0-2", ageMonth: 19, redLineKg: 8.2, orangeLineKg: 11.9 },
  { sex: "F", chart: "0-2", ageMonth: 20, redLineKg: 8.4, orangeLineKg: 12.1 },
  { sex: "F", chart: "0-2", ageMonth: 21, redLineKg: 8.6, orangeLineKg: 12.4 },
  { sex: "F", chart: "0-2", ageMonth: 22, redLineKg: 8.7, orangeLineKg: 12.6 },
  { sex: "F", chart: "0-2", ageMonth: 23, redLineKg: 8.9, orangeLineKg: 12.8 },
  { sex: "F", chart: "0-2", ageMonth: 24, redLineKg: 9.0, orangeLineKg: 13.0 },
  // Perempuan 2-5 tahun (25-60 bulan)
  { sex: "F", chart: "2-5", ageMonth: 25, redLineKg: 9.2, orangeLineKg: 13.3 },
  { sex: "F", chart: "2-5", ageMonth: 26, redLineKg: 9.4, orangeLineKg: 13.6 },
  { sex: "F", chart: "2-5", ageMonth: 27, redLineKg: 9.5, orangeLineKg: 13.8 },
  { sex: "F", chart: "2-5", ageMonth: 28, redLineKg: 9.7, orangeLineKg: 14.0 },
  { sex: "F", chart: "2-5", ageMonth: 29, redLineKg: 9.8, orangeLineKg: 14.3 },
  { sex: "F", chart: "2-5", ageMonth: 30, redLineKg: 10.0, orangeLineKg: 14.5 },
  { sex: "F", chart: "2-5", ageMonth: 31, redLineKg: 10.1, orangeLineKg: 14.7 },
  { sex: "F", chart: "2-5", ageMonth: 32, redLineKg: 10.3, orangeLineKg: 15.0 },
  { sex: "F", chart: "2-5", ageMonth: 33, redLineKg: 10.4, orangeLineKg: 15.2 },
  { sex: "F", chart: "2-5", ageMonth: 34, redLineKg: 10.5, orangeLineKg: 15.4 },
  { sex: "F", chart: "2-5", ageMonth: 35, redLineKg: 10.7, orangeLineKg: 15.7 },
  { sex: "F", chart: "2-5", ageMonth: 36, redLineKg: 10.8, orangeLineKg: 15.9 },
  { sex: "F", chart: "2-5", ageMonth: 37, redLineKg: 10.9, orangeLineKg: 16.1 },
  { sex: "F", chart: "2-5", ageMonth: 38, redLineKg: 11.1, orangeLineKg: 16.3 },
  { sex: "F", chart: "2-5", ageMonth: 39, redLineKg: 11.2, orangeLineKg: 16.6 },
  { sex: "F", chart: "2-5", ageMonth: 40, redLineKg: 11.3, orangeLineKg: 16.8 },
  { sex: "F", chart: "2-5", ageMonth: 41, redLineKg: 11.5, orangeLineKg: 17.0 },
  { sex: "F", chart: "2-5", ageMonth: 42, redLineKg: 11.6, orangeLineKg: 17.2 },
  { sex: "F", chart: "2-5", ageMonth: 43, redLineKg: 11.7, orangeLineKg: 17.5 },
  { sex: "F", chart: "2-5", ageMonth: 44, redLineKg: 11.8, orangeLineKg: 17.7 },
  { sex: "F", chart: "2-5", ageMonth: 45, redLineKg: 12.0, orangeLineKg: 17.9 },
  { sex: "F", chart: "2-5", ageMonth: 46, redLineKg: 12.1, orangeLineKg: 18.2 },
  { sex: "F", chart: "2-5", ageMonth: 47, redLineKg: 12.2, orangeLineKg: 18.4 },
  { sex: "F", chart: "2-5", ageMonth: 48, redLineKg: 12.3, orangeLineKg: 18.6 },
  { sex: "F", chart: "2-5", ageMonth: 49, redLineKg: 12.4, orangeLineKg: 18.9 },
  { sex: "F", chart: "2-5", ageMonth: 50, redLineKg: 12.6, orangeLineKg: 19.1 },
  { sex: "F", chart: "2-5", ageMonth: 51, redLineKg: 12.7, orangeLineKg: 19.3 },
  { sex: "F", chart: "2-5", ageMonth: 52, redLineKg: 12.8, orangeLineKg: 19.6 },
  { sex: "F", chart: "2-5", ageMonth: 53, redLineKg: 12.9, orangeLineKg: 19.8 },
  { sex: "F", chart: "2-5", ageMonth: 54, redLineKg: 13.0, orangeLineKg: 20.0 },
  { sex: "F", chart: "2-5", ageMonth: 55, redLineKg: 13.2, orangeLineKg: 20.3 },
  { sex: "F", chart: "2-5", ageMonth: 56, redLineKg: 13.3, orangeLineKg: 20.5 },
  { sex: "F", chart: "2-5", ageMonth: 57, redLineKg: 13.4, orangeLineKg: 20.7 },
  { sex: "F", chart: "2-5", ageMonth: 58, redLineKg: 13.5, orangeLineKg: 21.0 },
  { sex: "F", chart: "2-5", ageMonth: 59, redLineKg: 13.6, orangeLineKg: 21.2 },
  { sex: "F", chart: "2-5", ageMonth: 60, redLineKg: 13.7, orangeLineKg: 21.5 },
];

export function getKbmForAgeMonth(sex: Sex, ageMonth: number): number {
  if (ageMonth <= 0) return 0;
  const entry = REF_KBM.find(
    (e) => e.sex === sex && ageMonth >= e.ageMonthMin && ageMonth <= e.ageMonthMax
  );
  return entry?.kbmGram ?? 200;
}

/**
 * Menghitung KBM akumulatif (gram) antara kunjungan sebelumnya dan kunjungan saat ini.
 * Jika jarak kunjungan > 1 bulan, menjumlahkan KBM setiap bulan yang terlewati.
 */
export function getAccumulativeKbmGrams(
  sex: Sex,
  prevAgeMonth: number,
  currAgeMonth: number
): number {
  if (currAgeMonth <= prevAgeMonth) {
    return getKbmForAgeMonth(sex, currAgeMonth);
  }
  let totalGrams = 0;
  for (let m = prevAgeMonth + 1; m <= currAgeMonth; m++) {
    totalGrams += getKbmForAgeMonth(sex, m);
  }
  return totalGrams;
}

export function getKmsLinePoint(sex: Sex, ageMonth: number): KmsLinePoint | null {
  const clamped = Math.max(0, Math.min(60, ageMonth));
  return REF_KMS_LINE.find((p) => p.sex === sex && p.ageMonth === clamped) ?? null;
}

