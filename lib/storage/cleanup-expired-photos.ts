import { createAdminClient } from "../supabase/server";

export interface CleanupResult {
  totalDitemukan: number;
  totalDihapus: number;
  galat: string[];
}

/**
 * Pembersih otomatis foto KIA privat yang telah melewati masa retensi 30 hari pasca-verifikasi (F1-09 & NFR2).
 * Sesuai PRD Bab 6: "Foto asli dihapus otomatis setelah verifikasi + 30 hari (data terstruktur tetap)."
 */
export async function cleanupExpiredPhotos(retentionDays = 30): Promise<CleanupResult> {
  const supabase = createAdminClient();
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET_KIA || "kia-photos";

  const batasTanggal = new Date();
  batasTanggal.setDate(batasTanggal.getDate() - retentionDays);
  const cutoffIso = batasTanggal.toISOString();

  const result: CleanupResult = {
    totalDitemukan: 0,
    totalDihapus: 0,
    galat: [],
  };

  // Cari job ekstraksi yang sudah terverifikasi melewati batas retensi dan masih memiliki foto_ref
  const { data: jobs, error: fetchError } = await supabase
    .from("extraction_jobs")
    .select("id, foto_ref, verified_at")
    .not("foto_ref", "is", null)
    .lte("verified_at", cutoffIso);

  if (fetchError) {
    result.galat.push(`Gagal mengambil data extraction_jobs kedaluwarsa: ${fetchError.message}`);
    return result;
  }

  if (!jobs || jobs.length === 0) {
    return result;
  }

  result.totalDitemukan = jobs.length;

  for (const job of jobs) {
    try {
      const filePath = job.foto_ref;
      if (!filePath) continue;

      // 1. Hapus berkas fisik dari Supabase Storage
      const { error: deleteStorageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (deleteStorageError) {
        result.galat.push(`Gagal hapus berkas storage ${filePath}: ${deleteStorageError.message}`);
        continue;
      }

      // 2. Kosongkan referensi foto di extraction_jobs
      await supabase
        .from("extraction_jobs")
        .update({ foto_ref: null })
        .eq("id", job.id);

      // 3. Kosongkan referensi foto di measurements yang terkait
      await supabase
        .from("measurements")
        .update({ foto_ref: null })
        .eq("foto_ref", filePath);

      result.totalDihapus++;
    } catch (err: unknown) {
      result.galat.push(
        `Kesalahan saat memproses job ${job.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
}
