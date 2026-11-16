import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { extractKiaFromImage } from "@/lib/ai/extract-kia";
import { annotateExtractedRows } from "@/lib/validation/measurement";
import { calculateAgeInMonths } from "@/lib/zscore/age";
import { logger } from "@/lib/logger";
import type { ExtractionJob, KiaExtractionOutput } from "@/lib/types";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB sesuai batas bucket kia-photos
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getBucketName(): string {
  return process.env.SUPABASE_STORAGE_BUCKET_KIA || "kia-photos";
}

function getExtensionFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/**
 * POST /api/extractions (Fase 2 - B8)
 * Mengunggah foto KIA terkompresi ke bucket privat, membuat `extraction_jobs` dengan
 * `idempotency_key`, memanggil pipeline `extractKiaFromImage`, lalu melakukan validasi
 * plausibilitas dan deteksi duplikat tanggal ukur.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || !session.profile.status_aktif) {
      return NextResponse.json(
        { error: "Sesi tidak valid atau akun telah dinonaktifkan." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const childId = formData.get("child_id");
    const idempotencyKey = formData.get("idempotency_key");
    const file = formData.get("file");
    const hintPageType = formData.get("hint_page_type");

    if (typeof childId !== "string" || !childId.trim()) {
      return NextResponse.json(
        { error: "Parameter child_id wajib diisi." },
        { status: 400 }
      );
    }

    if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
      return NextResponse.json(
        { error: "Parameter idempotency_key wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();
    const bucketName = getBucketName();

    // 1. Verifikasi akses balita melalui RLS pengguna saat ini (Kader hanya posyandu tugasnya)
    const { data: child, error: childErr } = await supabase
      .from("children")
      .select("id, tgl_lahir, posyandu_id")
      .eq("id", childId)
      .maybeSingle();

    if (childErr) {
      return NextResponse.json({ error: childErr.message }, { status: 500 });
    }

    if (!child) {
      return NextResponse.json(
        { error: "Data balita tidak ditemukan atau di luar wilayah Posyandu Anda." },
        { status: 404 }
      );
    }

    // 2. Cek idempotency_key agar klik ganda tidak membuat job & panggilan LLM berulang
    const { data: existingJob } = await adminClient
      .from("extraction_jobs")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingJob) {
      let signedPhotoUrl: string | null = null;
      if (existingJob.foto_ref) {
        const { data: signedData } = await adminClient.storage
          .from(bucketName)
          .createSignedUrl(existingJob.foto_ref, 600);
        signedPhotoUrl = signedData?.signedUrl ?? null;
      }

      return NextResponse.json({
        job: existingJob as ExtractionJob,
        signedPhotoUrl,
        idempotentReplay: true,
        fallbackToManual: existingJob.status === "gagal",
      });
    }

    // 3. Validasi berkas foto
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Berkas foto KIA wajib diunggah." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Format foto harus JPEG, PNG, atau WebP." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Ukuran foto maksimal 2 MB (target kompresi <= 1 MB)." },
        { status: 400 }
      );
    }

    // 4. Unggah foto ke Supabase Storage privat
    const ext = getExtensionFromMime(file.type);
    const storagePath = `${childId}/${idempotencyKey}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await adminClient.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      logger.error("Gagal mengunggah foto KIA ke Storage", {
        childId,
        error: uploadErr.message,
      });
      return NextResponse.json(
        { error: `Gagal mengunggah foto: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    // 5. Buat record extraction_jobs berstatus 'diunggah' -> 'diproses'
    const { data: createdJob, error: jobInsertErr } = await adminClient
      .from("extraction_jobs")
      .insert({
        child_id: childId,
        foto_ref: storagePath,
        status: "diunggah",
        idempotency_key: idempotencyKey,
      })
      .select("*")
      .single();

    if (jobInsertErr || !createdJob) {
      return NextResponse.json(
        { error: jobInsertErr?.message ?? "Gagal membuat antrean ekstraksi." },
        { status: 500 }
      );
    }

    await adminClient
      .from("extraction_jobs")
      .update({ status: "diproses" })
      .eq("id", createdJob.id);

    // Buat signed URL privat (10 menit) untuk pratinjau di layar verifikasi
    const { data: signedData } = await adminClient.storage
      .from(bucketName)
      .createSignedUrl(storagePath, 600);
    const signedPhotoUrl = signedData?.signedUrl ?? null;

    // 6. Hitung total biaya LLM bulan berjalan dari extraction_logs (NFR6)
    const monthStartIso = `${new Date().toISOString().slice(0, 7)}-01T00:00:00.000Z`;
    const { data: monthlyLogs } = await adminClient
      .from("extraction_logs")
      .select("estimasi_biaya_usd")
      .gte("created_at", monthStartIso);

    const currentMonthlySpendUsd = (monthlyLogs ?? []).reduce(
      (sum, row) => sum + Number(row.estimasi_biaya_usd ?? 0),
      0
    );

    // 7. Panggil Pipeline Ekstraksi AI (mengirim data URI base64 agar handal)
    const base64Image = buffer.toString("base64");
    const dataUri = `data:${file.type};base64,${base64Image}`;
    const todayIso = new Date().toISOString().slice(0, 10);
    const childAgeMonths = Math.max(0, calculateAgeInMonths(child.tgl_lahir, todayIso));

    const validHint =
      hintPageType === "tabel_pertumbuhan" ||
      hintPageType === "catatan_lila" ||
      hintPageType === "gabungan"
        ? hintPageType
        : undefined;

    const extractionResult = await extractKiaFromImage(
      {
        imageUrl: dataUri,
        imageDetail: "high",
        userId: session.authUserId,
        extractionJobId: createdJob.id,
        promptOptions: {
          hintPageType: validHint,
          childAgeMonths,
        },
        referenceDate: todayIso,
      },
      {
        supabaseClient: adminClient,
        currentMonthlySpendUsd,
      }
    );

    // 8. Tangani kegagalan ekstraksi secara anggun (alihkan ke input manual)
    if (!extractionResult.ok) {
      const { data: failedJob } = await adminClient
        .from("extraction_jobs")
        .update({
          status: "gagal",
          pesan_galat: extractionResult.errorMessage,
        })
        .eq("id", createdJob.id)
        .select("*")
        .single();

      return NextResponse.json({
        job: (failedJob ?? { ...createdJob, status: "gagal" }) as ExtractionJob,
        signedPhotoUrl,
        fallbackToManual: true,
        budgetExceeded: extractionResult.budgetExceeded,
        rateLimited: extractionResult.rateLimited,
        errorMessage: extractionResult.errorMessage,
      });
    }

    // 9. Cek tanggal pengukuran yang sudah ada untuk deteksi duplikat (FR4)
    const { data: existingMeasurements } = await supabase
      .from("measurements")
      .select("tgl_ukur")
      .eq("child_id", childId);

    const existingDatesSet = new Set(
      (existingMeasurements ?? []).map((m) => m.tgl_ukur as string)
    );

    const annotatedRows = annotateExtractedRows(
      extractionResult.data.baris_kunjungan,
      existingDatesSet,
      child.tgl_lahir,
      todayIso
    );

    const annotatedOutput: KiaExtractionOutput = {
      ...extractionResult.data,
      baris_kunjungan: annotatedRows,
    };

    const isUnrecognizedEmpty =
      annotatedOutput.halaman_terdeteksi === "tidak_dikenali" &&
      annotatedOutput.baris_kunjungan.length === 0;

    const nextStatus = isUnrecognizedEmpty ? "ditolak_validasi" : "siap_verifikasi";
    const rejectionReason = isUnrecognizedEmpty
      ? "Foto tidak terdeteksi sebagai tabel pertumbuhan atau catatan LiLA Buku KIA. Silakan foto ulang atau gunakan input manual."
      : null;

    const { data: updatedJob } = await adminClient
      .from("extraction_jobs")
      .update({
        status: nextStatus,
        hasil_ekstraksi: annotatedOutput,
        pesan_galat: rejectionReason,
      })
      .eq("id", createdJob.id)
      .select("*")
      .single();

    return NextResponse.json({
      job: (updatedJob ?? {
        ...createdJob,
        status: nextStatus,
        hasil_ekstraksi: annotatedOutput,
        pesan_galat: rejectionReason,
      }) as ExtractionJob,
      signedPhotoUrl,
      modelUsed: extractionResult.modelUsed,
      promptVersion: extractionResult.promptVersion,
      budgetWarning: extractionResult.budgetWarning,
      fallbackToManual: isUnrecognizedEmpty,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Terjadi galat pada layanan ekstraksi KIA.";
    logger.error("Unhandled error on POST /api/extractions", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
