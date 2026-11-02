/**
 * Perhitungan dan Validasi Usia Balita (F1-12)
 * Mengacu pada PRD Posyandu+ v2.2 Bab 5 (FR2 & FR5).
 */

export interface AgeValidationResult {
  ageMonths: number;
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Menghitung usia balita dalam bulan penuh (dibulatkan ke bawah)
 * berdasarkan selisih tanggal lahir dan tanggal pengukuran (format YYYY-MM-DD).
 */
export function calculateAgeInMonths(birthDate: string, measureDate: string): number {
  const bParts = birthDate.split("-").map(Number);
  const mParts = measureDate.split("-").map(Number);

  const bYear = bParts[0];
  const bMonth = bParts[1];
  const bDay = bParts[2];

  const mYear = mParts[0];
  const mMonth = mParts[1];
  const mDay = mParts[2];

  if (
    bYear === undefined ||
    bMonth === undefined ||
    bDay === undefined ||
    mYear === undefined ||
    mMonth === undefined ||
    mDay === undefined ||
    Number.isNaN(bYear) ||
    Number.isNaN(bMonth) ||
    Number.isNaN(bDay) ||
    Number.isNaN(mYear) ||
    Number.isNaN(mMonth) ||
    Number.isNaN(mDay)
  ) {
    throw new Error("Format tanggal harus berupa YYYY-MM-DD yang valid.");
  }

  let months = (mYear - bYear) * 12 + (mMonth - bMonth);

  // Jika hari pada tanggal ukur belum mencapai hari pada tanggal lahir, kurangi 1 bulan
  if (mDay < bDay) {
    months -= 1;
  }

  return months;
}

/**
 * Memvalidasi apakah usia berada dalam ruang lingkup MVP (0-59 bulan).
 */
export function validateAgeInMonths(ageMonths: number): AgeValidationResult {
  if (ageMonths < 0) {
    return {
      ageMonths,
      isValid: false,
      errorMessage: "Tanggal pengukuran tidak boleh lebih awal dari tanggal lahir balita.",
    };
  }

  if (ageMonths >= 60) {
    return {
      ageMonths,
      isValid: false,
      errorMessage: `Usia balita (${ageMonths} bulan) berada di luar ruang lingkup pemantauan Posyandu+ (maksimal 59 bulan).`,
    };
  }

  return {
    ageMonths,
    isValid: true,
  };
}

/**
 * Helper terpadu untuk menghitung sekaligus memvalidasi usia.
 */
export function getAndValidateAge(birthDate: string, measureDate: string): AgeValidationResult {
  const ageMonths = calculateAgeInMonths(birthDate, measureDate);
  return validateAgeInMonths(ageMonths);
}
