import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  ExtractionServiceError,
  confirmExtractionAndSaveMeasurements,
  createSupabaseExtractionRepository,
} from "@/lib/extraction";

const confirmedRowSchema = z.object({
  baris_index: z.number().int().min(0).optional(),
  tgl_ukur: z.string().min(1),
  bb_kg: z.number(),
  pb_tb_cm: z.number().nullable().optional(),
  cara_ukur: z.enum(["berbaring", "berdiri"]).nullable().optional(),
  lk_cm: z.number().nullable().optional(),
  lila_cm: z.number().nullable().optional(),
  imunisasi: z.string().nullable().optional(),
  asi_eksklusif: z.boolean().nullable().optional(),
});

const confirmBodySchema = z.object({
  rows: z.array(confirmedRowSchema).min(1, "Minimal 1 baris harus dipilih."),
});

/**
 * POST /api/extractions/[jobId]/confirm (F2-16)
 * Menyimpan baris hasil ekstraksi yang telah diperiksa dan dikonfirmasi oleh Kader ke `measurements`,
 * serta mencatat koreksi ke `extraction_logs` untuk KPI-6.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json(
        { error: "Sesi petugas tidak valid atau akun nonaktif." },
        { status: 401 }
      );
    }

    const { jobId } = await context.params;
    const rawBody = await req.json();
    const parsed = confirmBodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Data konfirmasi verifikasi tidak valid.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const repo = createSupabaseExtractionRepository({
      supabase,
      adminSupabase,
    });

    const result = await confirmExtractionAndSaveMeasurements(
      {
        jobId,
        verifiedBy: session.profile.id,
        rows: parsed.data.rows,
      },
      { repo }
    );

    return NextResponse.json(
      {
        success: true,
        measurements: result.measurements,
        correctedFieldsByRow: result.correctedFieldsByRow,
      },
      { status: 201 }
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
            : "Gagal menyimpan hasil verifikasi ekstraksi.",
      },
      { status: 500 }
    );
  }
}

