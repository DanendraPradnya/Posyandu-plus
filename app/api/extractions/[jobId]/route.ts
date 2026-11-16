import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ExtractionServiceError,
  createSupabaseExtractionRepository,
  getExtractionJobStatus,
} from "@/lib/extraction";

/**
 * GET /api/extractions/[jobId] (F2-15)
 * Mengembalikan status terkini job ekstraksi beserta hasil validasi dan penanda duplikat.
 */
export async function GET(
  _req: NextRequest,
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
    const supabase = await createClient();
    const repo = createSupabaseExtractionRepository({ supabase });

    const job = await getExtractionJobStatus(jobId, { repo });
    return NextResponse.json({ job }, { status: 200 });
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
            : "Gagal mengambil status job ekstraksi.",
      },
      { status: 500 }
    );
  }
}

