import { Inngest } from "inngest";
import { logger } from "../logger";
import { createAdminClient } from "../supabase/server";
import { processExtractionJob } from "./job-service";
import { createSupabaseExtractionRepository } from "./supabase-repository";
import type { ExtractionRepository } from "./types";

export interface KiaExtractionRequestedPayload {
  jobId: string;
  userId?: string;
  imageUrl?: string;
}

export const inngest = new Inngest({
  id: "posyandu-plus",
});

/**
 * Worker asinkron Inngest untuk memproses ekstraksi foto KIA (F2-12).
 * Memiliki retry otomatis hingga 2 kali apabila terjadi kegagalan sementara.
 */
export const processKiaExtractionJobFn = inngest.createFunction(
  { id: "process-kia-extraction-job", retries: 2 },
  { event: "kia/extraction.requested" },
  async ({ event, step }) => {
    const payload = event.data as KiaExtractionRequestedPayload;

    return step.run("extract-and-validate-kia", async () => {
      const admin = createAdminClient();
      const repo = createSupabaseExtractionRepository({
        supabase: admin,
        adminSupabase: admin,
      });

      return processExtractionJob(
        {
          jobId: payload.jobId,
          userId: payload.userId,
          imageUrl: payload.imageUrl,
        },
        { repo }
      );
    });
  }
);

/**
 * Mengirimkan event antrean ekstraksi ke Inngest, atau jatuh kembali ke eksekusi
 * in-process apabila server Inngest tidak dikonfigurasi/tidak aktif di lingkungan lokal.
 */
export async function dispatchExtractionJobEvent(
  payload: KiaExtractionRequestedPayload,
  deps: { repo?: ExtractionRepository; runInlineFallback?: boolean } = {}
): Promise<{ queuedViaInngest: boolean }> {
  const eventKey = process.env.INNGEST_EVENT_KEY;
  const hasRemoteInngestKey =
    Boolean(eventKey) && eventKey !== "local" && eventKey !== "your-inngest-key";

  if (hasRemoteInngestKey) {
    try {
      await inngest.send({
        name: "kia/extraction.requested",
        data: payload,
      });
      return { queuedViaInngest: true };
    } catch (err: unknown) {
      logger.warn("Gagal mengirim event ke Inngest, beralih ke pemrosesan langsung", {
        jobId: payload.jobId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (deps.runInlineFallback !== false && deps.repo) {
    await processExtractionJob(
      {
        jobId: payload.jobId,
        userId: payload.userId,
        imageUrl: payload.imageUrl,
      },
      { repo: deps.repo }
    );
  }

  return { queuedViaInngest: false };
}

