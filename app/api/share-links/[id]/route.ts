import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/share-links/[id] (FR13, Fase 3 - B10)
 * Mencabut tautan bagikan dengan mengisi `revoked_at`.
 */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentUser();
    if (!session || !session.profile.status_aktif) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    if (session.profile.peran === "orang_tua") {
      return NextResponse.json(
        { error: "Akses ditolak: Pengelolaan tautan bagikan hanya untuk Kader atau Bidan." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, revoked_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Tautan bagikan tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ shareLink: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mencabut tautan bagikan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

