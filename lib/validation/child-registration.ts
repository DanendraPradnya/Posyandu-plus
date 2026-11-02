import { calculateAgeInMonths, validateAgeInMonths } from "../zscore/age";
import type { Sex } from "../types";

export interface ChildRegistrationInput {
  nama: string;
  tgl_lahir: string;
  jenis_kelamin: Sex | "";
  nik_no_kia?: string;
  nama_ortu: string;
  kontak_ortu?: string;
  posyandu_id: string;
  banjar: string;
  consent_given: boolean;
  referenceDate?: string; // YYYY-MM-DD (default: hari ini)
}

export interface ChildRegistrationValidationResult {
  isValid: boolean;
  ageMonths: number | null;
  errors: Partial<Record<keyof ChildRegistrationInput, string>>;
}

export interface ExistingChildSummary {
  id: string;
  nama: string;
  tgl_lahir: string;
  nama_ortu: string;
  banjar: string;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Memvalidasi input form registrasi balita baru (F1-24, FR2, dan UU PDP No. 27/2022).
 */
export function validateChildRegistration(
  input: ChildRegistrationInput
): ChildRegistrationValidationResult {
  const errors: Partial<Record<keyof ChildRegistrationInput, string>> = {};
  let ageMonths: number | null = null;

  if (!input.nama || input.nama.trim().length < 2) {
    errors.nama = "Nama lengkap balita wajib diisi (minimal 2 karakter).";
  }

  const refDate = input.referenceDate ?? getTodayIsoDate();

  if (!input.tgl_lahir) {
    errors.tgl_lahir = "Tanggal lahir wajib diisi.";
  } else {
    try {
      const calculatedAge = calculateAgeInMonths(input.tgl_lahir, refDate);
      ageMonths = calculatedAge;
      const ageValidation = validateAgeInMonths(calculatedAge);
      if (!ageValidation.isValid) {
        errors.tgl_lahir =
          ageValidation.errorMessage ??
          "Usia balita harus berada dalam rentang 0-59 bulan.";
      }
    } catch {
      errors.tgl_lahir = "Format tanggal lahir tidak valid (gunakan YYYY-MM-DD).";
    }
  }

  if (input.jenis_kelamin !== "M" && input.jenis_kelamin !== "F") {
    errors.jenis_kelamin = "Jenis kelamin balita wajib dipilih.";
  }

  if (!input.nama_ortu || input.nama_ortu.trim().length < 2) {
    errors.nama_ortu = "Nama orang tua atau wali wajib diisi.";
  }

  if (!input.posyandu_id || input.posyandu_id.trim().length === 0) {
    errors.posyandu_id = "Posyandu wajib dipilih.";
  }

  if (!input.banjar || input.banjar.trim().length < 2) {
    errors.banjar = "Nama Banjar atau Dusun wajib diisi.";
  }

  if (!input.consent_given) {
    errors.consent_given =
      "Persetujuan eksplisit orang tua/wali (UU PDP) wajib dicentang sebelum menyimpan.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    ageMonths,
    errors,
  };
}

/**
 * Mencari potensi duplikat berdasarkan kesamaan nama (case-insensitive) dan tanggal lahir.
 */
export function findPotentialDuplicates(
  nama: string,
  tglLahir: string,
  existingChildren: ExistingChildSummary[]
): ExistingChildSummary[] {
  const normalizedName = nama.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedDob = tglLahir.trim();

  if (normalizedName.length < 2 || !normalizedDob) {
    return [];
  }

  return existingChildren.filter((child) => {
    const childName = child.nama.trim().toLowerCase().replace(/\s+/g, " ");
    return childName === normalizedName && child.tgl_lahir === normalizedDob;
  });
}

