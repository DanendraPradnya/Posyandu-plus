import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  ExtractionServiceError,
  createSupabaseExtractionRepository,
  createUploadExtractionJob,
  dispatchExtractionJobEvent,
  uploadKiaPhotoToStorage,
} from "@/lib/extraction";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB sesuai migrasi Storage 004
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const jsonUploadSchema = z.object({
  child_id: z.string().min(1, "child_id wajib diisi."),
  foto_ref: z.string().min(1, "foto_ref wajib diisi."),
  idempotency_key: z.string().min(1, "idempotency_key wajib diisi."),
  image_url: z.string().optional(),
  process_sync: z.boolean().optional(),
});

function getExtensionFromMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

/**
 * POST /api/extractions/upload (F2-11 & F2-12)
 * Mengunggah foto KIA ke bucket privat `kia-photos` (bila multipart) atau menerima `foto_ref`,
 * membuat `extraction_jobs` berstatus `diunggah` secara idempoten, dan memicu worker ekstraksi.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json(
        { error: "Sesi petugas tidak valid atau akun nonaktif." },
        { status: 401 }
      );
    }

    if (session.profile.peran === "orang_tua") {
      return NextResponse.json(
        { error: "Akses ditolak: Akun Orang Tua/Wali hanya memiliki akses baca." },
        { status: 403 }
      );
    }

    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const repo = createSupabaseExtractionRepository({
      supabase,
      adminSupabase,
    });

    const contentType = req.headers.get("content-type") ?? "";
    let childId = "";
    let fotoRef = "";
    let idempotencyKey = "";
    let imageUrl: string | undefined;
    let runInline = true;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const rawChildId = formData.get("child_id");
      const rawIdempotency = formData.get("idempotency_key");
      const rawFotoRef = formData.get("foto_ref");
      const file = formData.get("file");

      childId = typeof rawChildId === "string" ? rawChildId.trim() : "";
      idempotencyKey =
        typeof rawIdempotency === "string" ? rawIdempotency.trim() : "";
      fotoRef = typeof rawFotoRef === "string" ? rawFotoRef.trim() : "";

      if (!childId || !idempotencyKey) {
        return NextResponse.json(
          { error: "child_id dan idempotency_key wajib diisi." },
          { status: 400 }
        );
      }

      if (file instanceof File) {
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
          return NextResponse.json(
            { error: "Format foto harus JPEG, PNG, atau WebP." },
            { status: 400 }
          );
        }
        if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
          return NextResponse.json(
            { error: "Ukuran foto harus lebih dari 0 dan maksimal 2 MB." },
            { status: 400 }
          );
        }

        // Cek idempotency terlebih dahulu agar klik ganda tidak mengunggah file ganda
        const existingJob = await repo.findJobByIdempotencyKey(idempotencyKey);
        if (existingJob) {
          return NextResponse.json(
            { job: existingJob, idempotent: true },
            { status: 200 }
          );
        }

        const buffer = await file.arrayBuffer();
        const uploaded = await uploadKiaPhotoToStorage({
          supabase,
          childId,
          fileBuffer: buffer,
          contentType: file.type,
          extension: getExtensionFromMime(file.type),
        });
        fotoRef = uploaded.fotoRef;
      }
    } else {
      const rawBody = await req.json();
      const parsed = jsonUploadSchema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ??
              "Payload unggah ekstraksi tidak valid.",
          },
          { status: 400 }
        );
      }
      childId = parsed.data.child_id;
      fotoRef = parsed.data.foto_ref;
      idempotencyKey = parsed.data.idempotency_key;
      imageUrl = parsed.data.image_url;
      runInline = parsed.data.process_sync ?? true;
    }

    const { job, created } = await createUploadExtractionJob(
      { childId, fotoRef, idempotencyKey },
      { repo }
    );

    if (created) {
      await dispatchExtractionJobEvent(
        {
          jobId: job.id,
          userId: session.profile.id,
          imageUrl,
        },
        { repo, runInlineFallback: runInline }
      );
    }

    const latestJob = (await repo.findJobById(job.id)) ?? job;

    return NextResponse.json(
      { job: latestJob, idempotent: !created },
      { status: created ? 201 : 200 }
    );
  } catch (err: unknown) {
    if (err instanceof ExtractionServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code, details: err.details },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memproses unggahan foto KIA.",
      },
      { status: 500 }
    );
  }
}

