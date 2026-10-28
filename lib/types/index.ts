/**
 * Kontrak API & Tipe Data Bersama - Posyandu+ (F0-09)
 * Mengacu pada PRD Posyandu+ v2.2 Bab 5 & Bab 7.
 * Versi Kontrak: 1.0.0
 */

export type UserRole = "kader" | "bidan";
export type Sex = "M" | "F";
export type MeasurementMethod = "berbaring" | "berdiri";
export type DataSource = "AI" | "manual";

export type ExtractionJobStatus =
  | "diunggah"
  | "diproses"
  | "siap_verifikasi"
  | "disimpan"
  | "gagal"
  | "ditolak_validasi";

export type IndicatorType =
  | "BB/U"
  | "PB/U"
  | "TB/U"
  | "BB/PB"
  | "BB/TB"
  | "IMT/U"
  | "LK/U";

export type OverallHealthStatus = "Normal" | "Waspada" | "Berisiko" | "Kritis";

export type AlertRuleCode =
  | "R1"
  | "R2"
  | "R3a"
  | "R3b"
  | "R4"
  | "R5"
  | "R6"
  | "R7"
  | "R8";

export type EducationReviewStatus = "aktif" | "dinonaktifkan" | "ditinjau";

// ============================================================================
// 1. Entitas Basis Data Utama (Bab 7 PRD)
// ============================================================================

export interface Posyandu {
  id: string;
  nama: string;
  dusun_banjar: string;
  wilayah_puskesmas: string;
}

export interface UserProfile {
  id: string;
  peran: UserRole;
  nama: string;
  email: string;
  status_aktif: boolean;
  posyandu_ditugaskan: string | null; // null untuk Bidan (akses seluruh wilayah)
}

export interface Child {
  id: string;
  nama: string;
  tgl_lahir: string; // ISO date YYYY-MM-DD
  jenis_kelamin: Sex;
  nik_no_kia?: string | null;
  nama_ortu: string;
  kontak_ortu?: string | null;
  posyandu_id: string;
  banjar: string;
  consent_at: string; // ISO timestamp
  created_at: string;
}

export interface Measurement {
  id: string;
  child_id: string;
  tgl_ukur: string; // YYYY-MM-DD
  usia_bulan: number; // 0-59 (dibulatkan ke bawah)
  bb_kg: number;
  pb_tb_cm: number | null;
  cara_ukur: MeasurementMethod | null;
  lk_cm: number | null;
  lila_cm: number | null;
  imunisasi: string | null;
  asi_eksklusif: boolean | null;
  sumber: DataSource;
  verified_by: string; // user_id Kader/Bidan (WAJIB dikonfirmasi manusia)
  verified_at: string; // ISO timestamp
  foto_ref: string | null;
}

export interface ZScoreResult {
  id?: string;
  measurement_id?: string;
  indikator: IndicatorType;
  nilai_z: number | null; // null bila tidak dapat dihitung
  klasifikasi: string; // mis. "Pendek (stunted)", "Gizi baik", "Tidak dapat dihitung", "Perlu pengukuran ulang"
  flag_biologis_tidak_mungkin: boolean;
  koreksi_cara_ukur_cm: number; // -0.7, 0, atau +0.7
  versi_tabel: string; // mis. "WHO-2006-Permenkes-2-2020-v1"
}

export interface TriggeredRule {
  kode: AlertRuleCode;
  tingkat: Exclude<OverallHealthStatus, "Normal">;
  alasan_awam: string; // Penjelasan bahasa awam untuk Kader/Orang Tua
}

export interface HealthProfile {
  id: string;
  child_id: string;
  measurement_id: string;
  status_keseluruhan: OverallHealthStatus;
  status_per_indikator: Record<IndicatorType, ZScoreResult | undefined>;
  status_lila?: string | null;
  aturan_terpicu: TriggeredRule[];
  tren_bb?: "Naik (N)" | "Tidak Naik (T)" | "Kunjungan Pertama";
  dihitung_pada: string;
}

export interface AlertRecord {
  id: string;
  child_id: string;
  measurement_id: string;
  kode_aturan: AlertRuleCode;
  tingkat: Exclude<OverallHealthStatus, "Normal">;
  pesan_awam: string;
  status_kirim: "ditampilkan_aplikasi";
  created_at: string;
}

export interface EducationRecord {
  id: string;
  child_id: string;
  measurement_id: string;
  tips: [string, string, string]; // 3 tips spesifik, praktis, terjangkau
  anjuran_kritis_tetap: string | null; // Terisi template tetap bila status Kritis (R5)
  disclaimer: string;
  versi_prompt: string;
  is_fallback_statis: boolean;
  status_review: EducationReviewStatus;
  created_at: string;
}

export interface ShareLink {
  id: string;
  child_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_by: string;
}

export interface AuditLog {
  id: string;
  aktor: string;
  aksi: string;
  entitas: string;
  entitas_id: string;
  nilai_lama: unknown;
  nilai_baru: unknown;
  alasan: string; // Wajib untuk koreksi data oleh Bidan
  waktu: string;
}

// ============================================================================
// 2. Kontrak Ekstraksi AI & Verifikasi Kader (F0-07 & FR4)
// ============================================================================

export interface FieldWithConfidence<T> {
  value: T | null;
  confidence: number; // 0.0 - 1.0
}

export interface ExtractedVisitRow {
  baris_index: number;
  tgl_ukur: FieldWithConfidence<string>; // YYYY-MM-DD
  bb_kg: FieldWithConfidence<number>;
  pb_tb_cm: FieldWithConfidence<number>;
  cara_ukur: FieldWithConfidence<MeasurementMethod>;
  lk_cm: FieldWithConfidence<number>;
  lila_cm: FieldWithConfidence<number>;
  imunisasi: FieldWithConfidence<string>;
  asi_eksklusif: FieldWithConfidence<boolean>;
  // Ditambahkan oleh backend saat validasi plausibilitas & cek duplikat:
  is_duplicate?: boolean;
  plausibility_warnings?: string[];
}

export interface KiaExtractionOutput {
  schema_version: "1.0";
  halaman_terdeteksi: "tabel_pertumbuhan" | "catatan_lila" | "gabungan" | "tidak_dikenali";
  baris_kunjungan: ExtractedVisitRow[];
  catatan_ekstraksi?: string;
}

export interface ExtractionJob {
  id: string;
  child_id: string;
  foto_ref: string;
  status: ExtractionJobStatus;
  idempotency_key: string;
  hasil_ekstraksi: KiaExtractionOutput | null;
  pesan_galat: string | null;
  dibuat_pada: string;
}

// ============================================================================
// 3. Kontrak Halaman Hasil Publik Read-Only (FR13 - Tanpa PII)
// ============================================================================

export interface PublicChildResultView {
  inisial_atau_panggilan: string; // Tanpa nama lengkap, NIK, atau kontak
  usia_bulan: number;
  jenis_kelamin: Sex;
  profil_kesehatan: HealthProfile;
  edukasi: EducationRecord | null;
  riwayat_kms: {
    usia_bulan: number;
    bb_kg: number;
    pb_tb_cm: number | null;
    status_naik: "N" | "T" | "-";
  }[];
}
