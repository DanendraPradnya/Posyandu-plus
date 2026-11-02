import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * Endpoint Health-Check & Database Keep-Alive (F1-10 & NFR3).
 * Menjalankan query ringan ke Supabase untuk memeriksa status koneksi
 * sekaligus mencegah database Supabase Free dijeda otomatis (auto-pause).
 */
export async function GET() {
  const startTime = Date.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "your-supabase-anon-key"
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      {
        status: "degraded",
        database: "unconfigured",
        message: "Variabel lingkungan Supabase belum disetel.",
      },
      { status: 503 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    // Query ringan: hitung posyandu
    const { count, error } = await supabase
      .from("posyandu")
      .select("*", { count: "exact", head: true });

    const latencyMs = Date.now() - startTime;

    if (error) {
      logger.error("Pemeriksaan kesehatan basis data gagal", {
        error: error.message,
        latencyMs,
      });

      return NextResponse.json(
        {
          status: "unhealthy",
          database: "error",
          error: error.message,
          latencyMs,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    logger.info("Health-check berhasil", { latencyMs, posyanduCount: count });

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      latencyMs,
      timestamp: new Date().toISOString(),
      posyanduCount: count,
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    logger.error("Health-check exception", { error: errorMessage, latencyMs });

    return NextResponse.json(
      {
        status: "unhealthy",
        database: "exception",
        error: errorMessage,
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

