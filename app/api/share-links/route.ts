import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  generateShareToken,
  getShareLinkExpiryDays,
  hashShareToken,
} from "@/lib/share/token";

/**
 * GET /api/share-links?child_id=...
 * Mengambil daftar tautan bagikan untuk satu balita.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || !session.profile.status_aktif) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const childId = req.nextUrl.searchParams.get("child_id");
    if (!childId) {
      return NextResponse.json(
        { error: "Parameter child_id wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("share_links")
      .select("id, child_id, expires_at, revoked_at, access_count, last_accessed_at, created_at")
      .eq("child_id", childId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shareLinks: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat tautan bagikan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/share-links (FR13, Fase 3 - B10)
 * Membuat tautan bagikan read-only dengan token acak panjang, hash SHA-256,
 * dan masa berlaku default 30 hari.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || !session.profile.status_aktif) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const body = (await req.json()) as { child_id?: string; expiry_days?: number };
    const childId = body.child_id;
    if (!childId) {
      return NextResponse.json(
        { error: "Parameter child_id wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verifikasi akses balita via RLS
    const { data: child, error: childErr } = await supabase
      .from("children")
      .select("id")
      .eq("id", childId)
      .maybeSingle();

    if (childErr || !child) {
      return NextResponse.json(
        { error: "Balita tidak ditemukan atau di luar wilayah Posyandu Anda." },
        { status: 404 }
      );
    }

    const token = generateShareToken();
    const tokenHash = hashShareToken(token);
    const expiryDays =
      typeof body.expiry_days === "number" && body.expiry_days > 0
        ? Math.min(90, Math.floor(body.expiry_days))
        : getShareLinkExpiryDays();

    const expiresAt = new Date(
      Date.now() + expiryDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: inserted, error: insertErr } = await supabase
      .from("share_links")
      .insert({
        child_id: childId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_by: session.authUserId,
      })
      .select("id, child_id, expires_at, revoked_at, access_count, created_at")
      .single();

    if (insertErr || !inserted) {
      return NextResponse.json(
        { error: insertErr?.message ?? "Gagal membuat tautan bagikan." },
        { status: 500 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      req.nextUrl.origin;

    return NextResponse.json(
      {
        shareLink: inserted,
        token,
        shareUrl: `${baseUrl}/hasil/${token}`,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membuat tautan bagikan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

