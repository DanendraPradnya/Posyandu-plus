import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ExtractionServiceError,
  createSupabaseExtractionRepository,
  saveManualMeasurement,
} from "@/lib/extraction";

const manualMeasurementSchema = z.object({
  child_id: z.string().min(1, "child_id wajib diisi."),
  tgl_ukur: z.string().min(1, "tgl_ukur wajib diisi."),
  bb_kg: z.number(),
  pb_tb_cm: z.number().nullable().optional(),
  cara_ukur: z.enum(["berbaring", "berdiri"]).nullable().optional(),
  lk_cm: z.number().nullable().optional(),
  lila_cm: z.number().nullable().optional(),
  imunisasi: z.string().nullable().optional(),
  asi_eksklusif: z.boolean().nullable().optional(),
});

/**
 * POST /api/measurements/manual (F2-17)
 * Jalur cadangan input pengukuran manual tanpa foto dengan validasi plausibilitas
 * dan deteksi duplikat tanggal ukur yang sama.
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

    const rawBody = await req.json();
    const parsed = manualMeasurementSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Data pengukuran manual tidak valid.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const repo = createSupabaseExtractionRepository({ supabase });

    const { child_id, ...measurementFields } = parsed.data;
    const saved = await saveManualMeasurement(
      {
        childId: child_id,
        verifiedBy: session.profile.id,
        measurement: measurementFields,
      },
      { repo }
    );

    return NextResponse.json(
      { success: true, measurement: saved },
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
            : "Gagal menyimpan pengukuran manual.",
      },
      { status: 500 }
    );
  }
}

