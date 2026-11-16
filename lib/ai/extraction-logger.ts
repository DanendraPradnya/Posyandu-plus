/**
 * Pencatatan Log Ekstraksi KIA ke Supabase `extraction_logs` (F2-04 & KPI-6)
 * Mencatat model, versi prompt, skor keyakinan, koreksi manusia, latensi, dan estimasi biaya.
 */

import type { ExtractedVisitRow } from "../types";
import { createAdminClient } from "../supabase/server";

export interface ExtractionLogPayload {
  extraction_job_id?: string | null;
  measurement_id?: string | null;
  model: string;
  versi_prompt: string;
  keyakinan?: Record<string, number> | null;
  field_dikoreksi?: Record<string, { before: unknown; after: unknown }> | null;
  latensi_ms: number;
  estimasi_biaya_usd: number;
}

export interface ExtractionLogResult {
  logged: boolean;
  error?: string;
}

export interface SupabaseLikeInsertClient {
  from: (table: string) => {
    insert: (
      row: Record<string, unknown>
    ) => PromiseLike<{ error: { message: string } | null }> | Promise<{ error: { message: string } | null }>;
  };
}

/**
 * Menyimpan satu catatan log ekstraksi ke tabel `public.extraction_logs`.
 * Mengembalikan status terstruktur agar kegagalan logging tidak mematikan alur utama.
 */
export async function logExtractionAttempt(
  payload: ExtractionLogPayload,
  deps: { supabaseClient?: SupabaseLikeInsertClient } = {}
): Promise<ExtractionLogResult> {
  try {
    const client =
      deps.supabaseClient ??
      (createAdminClient() as unknown as SupabaseLikeInsertClient);

    const record = {
      extraction_job_id: payload.extraction_job_id ?? null,
      measurement_id: payload.measurement_id ?? null,
      model: payload.model,
      versi_prompt: payload.versi_prompt,
      keyakinan: payload.keyakinan ?? null,
      field_dikoreksi: payload.field_dikoreksi ?? null,
      latensi_ms: Math.max(0, Math.round(payload.latensi_ms)),
      estimasi_biaya_usd: Math.max(0, payload.estimasi_biaya_usd),
    };

    const { error } = await client.from("extraction_logs").insert(record);
    if (error) {
      return { logged: false, error: error.message };
    }
    return { logged: true };
  } catch (err: unknown) {
    return {
      logged: false,
      error:
        err instanceof Error
          ? err.message
          : "Gagal menulis ke tabel extraction_logs.",
    };
  }
}

const TRACKED_CORRECTION_FIELDS = [
  "tgl_ukur",
  "bb_kg",
  "pb_tb_cm",
  "cara_ukur",
  "lk_cm",
  "lila_cm",
  "imunisasi",
  "asi_eksklusif",
] as const;

/**
 * Menghitung daftar field yang dikoreksi oleh Kader saat konfirmasi dibandingkan keluaran AI (KPI-6).
 */
export function diffCorrectedFields(
  aiRow: ExtractedVisitRow,
  confirmedValues: Partial<Record<(typeof TRACKED_CORRECTION_FIELDS)[number], unknown>>
): Record<string, { before: unknown; after: unknown }> {
  const diffs: Record<string, { before: unknown; after: unknown }> = {};

  for (const field of TRACKED_CORRECTION_FIELDS) {
    if (!(field in confirmedValues)) continue;
    const beforeVal = aiRow[field].value;
    const afterVal = confirmedValues[field] ?? null;
    if (beforeVal !== afterVal) {
      diffs[field] = { before: beforeVal, after: afterVal };
    }
  }

  return diffs;
}
