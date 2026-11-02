import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Endpoint Manajemen Akun Kader khusus Bidan (F1-08).
 * Mendukung aksi:
 * 1. POST { action: "create", nama, email, password, posyandu_id, alasan }
 * 2. POST { action: "toggle_status", user_id, status_aktif, alasan }
 * 3. POST { action: "reassign", user_id, posyandu_id, alasan }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();

    // 1. Verifikasi peran: Hanya Bidan aktif yang boleh memanggil endpoint ini
    if (!session || session.profile.peran !== "bidan" || !session.profile.status_aktif) {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Bidan aktif yang dapat mengelola akun Kader." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, alasan } = body;

    // Alasan wajib disertakan untuk semua aksi manajemen Bidan
    if (!alasan || typeof alasan !== "string" || alasan.trim().length === 0) {
      return NextResponse.json(
        { error: "Alasan wajib disertakan untuk setiap perubahan oleh Bidan." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // =========================================================================
    // AKSI 1: BUAT AKUN KADER BARU
    // =========================================================================
    if (action === "create") {
      const { nama, email, password, posyandu_id } = body;

      if (!nama || !email || !password || !posyandu_id) {
        return NextResponse.json(
          { error: "Nama, email, password, dan posyandu_id wajib diisi." },
          { status: 400 }
        );
      }

      // Verifikasi bahwa posyandu_id valid
      const { data: posyanduExists } = await adminClient
        .from("posyandu")
        .select("id, nama")
        .eq("id", posyandu_id)
        .maybeSingle();

      if (!posyanduExists) {
        return NextResponse.json(
          { error: "Posyandu yang dipilih tidak ditemukan." },
          { status: 404 }
        );
      }

      // Buat pengguna di Supabase Auth
      const { data: newAuth, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nama, peran: "kader" },
      });

      if (authError || !newAuth.user) {
        return NextResponse.json(
          { error: `Gagal membuat auth user: ${authError?.message}` },
          { status: 400 }
        );
      }

      // Masukkan ke public.users
      const { error: profileError } = await adminClient.from("users").insert({
        id: newAuth.user.id,
        peran: "kader",
        nama,
        email,
        status_aktif: true,
        posyandu_ditugaskan: posyandu_id,
      });

      if (profileError) {
        return NextResponse.json(
          { error: `Gagal membuat profil kader: ${profileError.message}` },
          { status: 500 }
        );
      }

      // Catat ke audit_logs
      await adminClient.from("audit_logs").insert({
        aktor: session.profile.id,
        aksi: "CREATE_KADER",
        entitas: "users",
        entitas_id: newAuth.user.id,
        nilai_lama: null,
        nilai_baru: { nama, email, peran: "kader", posyandu_ditugaskan: posyandu_id },
        alasan: alasan.trim(),
      });

      return NextResponse.json({
        success: true,
        message: "Akun Kader berhasil dibuat.",
        user_id: newAuth.user.id,
      });
    }

    // =========================================================================
    // AKSI 2: AKTIFKAN / NONAKTIFKAN AKUN KADER
    // =========================================================================
    if (action === "toggle_status") {
      const { user_id, status_aktif } = body;

      if (!user_id || typeof status_aktif !== "boolean") {
        return NextResponse.json(
          { error: "user_id dan status_aktif (boolean) wajib disertakan." },
          { status: 400 }
        );
      }

      // Ambil nilai lama
      const { data: oldProfile, error: fetchErr } = await adminClient
        .from("users")
        .select("*")
        .eq("id", user_id)
        .maybeSingle();

      if (fetchErr || !oldProfile) {
        return NextResponse.json({ error: "Akun Kader tidak ditemukan." }, { status: 404 });
      }

      if (oldProfile.peran !== "kader") {
        return NextResponse.json(
          { error: "Hanya akun dengan peran Kader yang dapat dinonaktifkan." },
          { status: 400 }
        );
      }

      // 1. Update di public.users
      const { error: updateErr } = await adminClient
        .from("users")
        .update({ status_aktif })
        .eq("id", user_id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // 2. Jika dinonaktifkan, blokir login di Auth (ban_duration) seketika (F1-06 <= 1 menit)
      if (!status_aktif) {
        await adminClient.auth.admin.updateUserById(user_id, {
          ban_duration: "876000h", // ban permanen sampai diaktifkan kembali
        });
      } else {
        await adminClient.auth.admin.updateUserById(user_id, {
          ban_duration: "none",
        });
      }

      // Catat ke audit_logs
      await adminClient.from("audit_logs").insert({
        aktor: session.profile.id,
        aksi: status_aktif ? "ACTIVATE_KADER" : "DEACTIVATE_KADER",
        entitas: "users",
        entitas_id: user_id,
        nilai_lama: { status_aktif: oldProfile.status_aktif },
        nilai_baru: { status_aktif },
        alasan: alasan.trim(),
      });

      return NextResponse.json({
        success: true,
        message: `Akun Kader berhasil di-${status_aktif ? "aktifkan" : "nonaktifkan"}.`,
      });
    }

    // =========================================================================
    // AKSI 3: UBAH PENUGASAN POSYANDU KADER
    // =========================================================================
    if (action === "reassign") {
      const { user_id, posyandu_id } = body;

      if (!user_id || !posyandu_id) {
        return NextResponse.json(
          { error: "user_id dan posyandu_id wajib disertakan." },
          { status: 400 }
        );
      }

      const { data: oldProfile } = await adminClient
        .from("users")
        .select("*")
        .eq("id", user_id)
        .maybeSingle();

      if (!oldProfile || oldProfile.peran !== "kader") {
        return NextResponse.json({ error: "Akun Kader tidak ditemukan." }, { status: 404 });
      }

      const { error: updateErr } = await adminClient
        .from("users")
        .update({ posyandu_ditugaskan: posyandu_id })
        .eq("id", user_id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // Catat ke audit_logs
      await adminClient.from("audit_logs").insert({
        aktor: session.profile.id,
        aksi: "REASSIGN_KADER_POSYANDU",
        entitas: "users",
        entitas_id: user_id,
        nilai_lama: { posyandu_ditugaskan: oldProfile.posyandu_ditugaskan },
        nilai_baru: { posyandu_ditugaskan: posyandu_id },
        alasan: alasan.trim(),
      });

      return NextResponse.json({
        success: true,
        message: "Penugasan Posyandu Kader berhasil diperbarui.",
      });
    }

    return NextResponse.json({ error: `Aksi '${action}' tidak dikenali.` }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terjadi kesalahan internal server." },
      { status: 500 }
    );
  }
}

