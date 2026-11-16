/**
 * Prompt Berversi Ekstraksi Buku KIA untuk OpenAI Vision (F2-01)
 * Mengacu pada FR4 PRD Posyandu+ v2.2 dan skema F0-07 (lib/ai/extraction-schema.ts).
 */

export const EXTRACTION_PROMPT_VERSION = "kia-extraction-v1.0" as const;

export const KIA_EXTRACTION_SYSTEM_PROMPT = [
  "Anda adalah asisten ekstraksi data antropometri Posyandu+ yang membaca foto halaman Buku KIA (Kementerian Kesehatan RI, hal. 127 Tabel Pemantauan Pertumbuhan dan hal. 128 Catatan LiLA).",
  "Tugas Anda adalah menyalin nilai tulisan tangan maupun cetakan dari foto ke JSON terstruktur sesuai skema yang diberikan, tanpa melakukan diagnosis medis atau menebak data yang tidak tertulis.",
  "Aturan ketat ekstraksi:",
  "1. Tetapkan schema_version = '1.0'.",
  "2. Identifikasi jenis halaman pada halaman_terdeteksi: 'tabel_pertumbuhan', 'catatan_lila', 'gabungan', atau 'tidak_dikenali'. Jika gambar buram total atau bukan halaman KIA, kembalikan halaman_terdeteksi = 'tidak_dikenali' dan baris_kunjungan = [].",
  "3. Format tanggal ukur (tgl_ukur) wajib YYYY-MM-DD. Jika tahun tidak tercantum jelas atau tulisan tidak terbaca, isi value = null dengan confidence rendah (< 0.6).",
  "4. Nilai numerik (bb_kg dalam kg, pb_tb_cm dalam cm, lk_cm dalam cm, lila_cm dalam cm) wajib berupa angka desimal tanpa satuan teks. Ubah koma desimal Indonesia (misal '7,8') menjadi titik ('7.8').",
  "5. cara_ukur hanya bernilai 'berbaring', 'berdiri', atau null bila tidak tertulis.",
  "6. asi_eksklusif bernilai true ('Ya'/'E'), false ('Tidak'), atau null bila kosong.",
  "7. Untuk setiap field, isi confidence dari 0.0 hingga 1.0 secara jujur: >= 0.90 bila sangat jelas terbaca, 0.70-0.89 bila tulisan agak kabur/tercoret, dan < 0.70 bila ragu atau kolom kosong (value = null).",
  "8. Jangan pernah menyertakan atau menyimpulkan data identitas sensitif (nama lengkap ibu/anak, NIK, atau nomor telepon) dalam catatan_ekstraksi.",
].join("\n");

export interface KiaUserPromptOptions {
  hintPageType?: "tabel_pertumbuhan" | "catatan_lila" | "gabungan";
  childAgeMonths?: number;
}

/**
 * Membangun teks user prompt untuk mendampingi gambar Buku KIA saat pemanggilan OpenAI Vision.
 */
export function buildKiaExtractionUserPrompt(
  options: KiaUserPromptOptions = {}
): string {
  const parts: string[] = [
    "Ekstrak seluruh baris kunjungan pemantauan pertumbuhan dan/atau LiLA yang terlihat pada foto Buku KIA terlampir.",
    "Urutkan baris_kunjungan dari atas ke bawah dengan baris_index dimulai dari 0 atau 1 sesuai nomor baris pada tabel.",
    "Berikan catatan_ekstraksi singkat bila foto miring, gelap, terpotong, atau terdapat coretan (atau null bila foto cukup jelas).",
  ];

  if (options.hintPageType) {
    parts.push(`Petunjuk awal jenis halaman dari aplikasi: ${options.hintPageType}.`);
  }

  if (typeof options.childAgeMonths === "number" && Number.isFinite(options.childAgeMonths)) {
    parts.push(
      `Konteks usia anak saat ini sekitar ${Math.max(0, Math.floor(options.childAgeMonths))} bulan (hanya untuk membantu memeriksa kewajaran angka, jangan mengarang kolom yang kosong).`
    );
  }

  return parts.join(" ");
}
