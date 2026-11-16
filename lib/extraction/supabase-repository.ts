import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Child,
  ExtractionJob,
  ExtractionJobStatus,
  KiaExtractionOutput,
  Measurement,
} from "../types";
import { createAdminClient } from "../supabase/server";
import {
  logExtractionAttempt,
  type ExtractionLogPayload,
  type SupabaseLikeInsertClient,
} from "../ai/extraction-logger";
import type {
  ExtractionJobUpdatePatch,
  ExtractionRepository,
  NewMeasurementRecord,
} from "./types";

const DEFAULT_KIA_BUCKET = "kia-photos";

export function getKiaStorageBucketName(): string {
  return process.env.SUPABASE_STORAGE_BUCKET_KIA || DEFAULT_KIA_BUCKET;
}

/**
 * Mengunggah foto tabel Buku KIA ke Supabase Storage privat (bucket `kia-photos`).
 */
export async function uploadKiaPhotoToStorage(params: {
  supabase: SupabaseClient;
  childId: string;
  fileBuffer: Uint8Array | ArrayBuffer;
  contentType: string;
  extension: string;
}): Promise<{ fotoRef: string }> {
  const bucket = getKiaStorageBucketName();
  const safeExt = params.extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const path = `${params.childId}/${Date.now()}-${randomUUID()}.${safeExt}`;

  const { error } = await params.supabase.storage
    .from(bucket)
    .upload(path, params.fileBuffer, {
      contentType: params.contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Gagal mengunggah foto KIA ke Storage: ${error.message}`);
  }

  return { fotoRef: path };
}

/**
 * Implementasi repository ekstraksi berbasis Supabase (dengan support RLS userClient + adminClient untuk logs/worker).
 */
export function createSupabaseExtractionRepository(params: {
  supabase: SupabaseClient;
  adminSupabase?: SupabaseClient;
}): ExtractionRepository {
  const db = params.supabase;
  const getAdmin = () => params.adminSupabase ?? createAdminClient();
  const bucket = getKiaStorageBucketName();

  return {
    async getChildById(childId: string): Promise<Child | null> {
      const { data, error } = await db
        .from("children")
        .select("*")
        .eq("id", childId)
        .maybeSingle();

      if (error) {
        throw new Error(`Gagal mengambil data balita: ${error.message}`);
      }
      return (data as Child | null) ?? null;
    },

    async getExistingMeasurementDates(childId: string): Promise<string[]> {
      const { data, error } = await db
        .from("measurements")
        .select("tgl_ukur")
        .eq("child_id", childId);

      if (error) {
        throw new Error(
          `Gagal memeriksa tanggal pengukuran sebelumnya: ${error.message}`
        );
      }

      return (data ?? []).map((row: { tgl_ukur: string }) => row.tgl_ukur);
    },

    async findJobByIdempotencyKey(
      idempotencyKey: string
    ): Promise<ExtractionJob | null> {
      const { data, error } = await db
        .from("extraction_jobs")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (error) {
        throw new Error(
          `Gagal memeriksa idempotency_key job ekstraksi: ${error.message}`
        );
      }

      return (data as ExtractionJob | null) ?? null;
    },

    async findJobById(jobId: string): Promise<ExtractionJob | null> {
      const { data, error } = await db
        .from("extraction_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();

      if (error) {
        throw new Error(`Gagal mengambil extraction_jobs: ${error.message}`);
      }

      return (data as ExtractionJob | null) ?? null;
    },

    async createExtractionJob(input: {
      child_id: string;
      foto_ref: string;
      idempotency_key: string;
      status: ExtractionJobStatus;
    }): Promise<ExtractionJob> {
      const { data, error } = await db
        .from("extraction_jobs")
        .insert({
          child_id: input.child_id,
          foto_ref: input.foto_ref,
          idempotency_key: input.idempotency_key,
          status: input.status,
        })
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(
          error?.message ?? "Gagal membuat extraction_jobs baru."
        );
      }

      return data as ExtractionJob;
    },

    async updateExtractionJob(
      jobId: string,
      patch: ExtractionJobUpdatePatch
    ): Promise<ExtractionJob> {
      const payload: Record<string, unknown> = {};
      if (patch.status !== undefined) payload.status = patch.status;
      if (patch.hasil_ekstraksi !== undefined) {
        payload.hasil_ekstraksi =
          patch.hasil_ekstraksi as KiaExtractionOutput | null;
      }
      if (patch.pesan_galat !== undefined) {
        payload.pesan_galat = patch.pesan_galat;
      }
      if (patch.verified_at !== undefined) {
        payload.verified_at = patch.verified_at;
      }

      const { data, error } = await db
        .from("extraction_jobs")
        .update(payload)
        .eq("id", jobId)
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(
          error?.message ?? "Gagal memperbarui status extraction_jobs."
        );
      }

      return data as ExtractionJob;
    },

    async insertMeasurements(
      rows: NewMeasurementRecord[]
    ): Promise<Measurement[]> {
      const { data, error } = await db
        .from("measurements")
        .insert(rows)
        .select("*");

      if (error || !data) {
        throw new Error(
          error?.message ?? "Gagal menyimpan data pengukuran ke measurements."
        );
      }

      return data as Measurement[];
    },

    async insertExtractionLog(payload: ExtractionLogPayload): Promise<void> {
      const admin = getAdmin() as unknown as SupabaseLikeInsertClient;
      await logExtractionAttempt(payload, { supabaseClient: admin });
    },

    async getMonthlyLlmSpendUsd(yearMonth: string): Promise<number> {
      try {
        const admin = getAdmin();
        const startIso = `${yearMonth}-01T00:00:00.000Z`;
        const { data, error } = await admin
          .from("extraction_logs")
          .select("estimasi_biaya_usd")
          .gte("created_at", startIso);

        if (error || !data) return 0;
        return data.reduce(
          (sum: number, row: { estimasi_biaya_usd: number | string | null }) =>
            sum + Number(row.estimasi_biaya_usd ?? 0),
          0
        );
      } catch {
        return 0;
      }
    },

    async getSignedPhotoUrl(
      fotoRef: string,
      expiresInSeconds = 300
    ): Promise<string | null> {
      const storageClient = params.adminSupabase ?? db;
      const { data, error } = await storageClient.storage
        .from(bucket)
        .createSignedUrl(fotoRef, expiresInSeconds);

      if (error || !data?.signedUrl) {
        return null;
      }
      return data.signedUrl;
    },
  };
}

