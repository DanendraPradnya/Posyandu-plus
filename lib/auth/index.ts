import { createClient } from "../supabase/server";
import { UserProfile, UserRole } from "../types";

export interface CurrentUserSession {
  authUserId: string;
  email: string;
  profile: UserProfile;
}

/**
 * Mengambil sesi pengguna aktif saat ini di server (Route Handlers & Server Actions).
 * Memeriksa tabel `public.users`. Jika pengguna tidak aktif (status_aktif = false),
 * sesi langsung ditolak untuk memenuhi acceptance criteria F1-04 (tolak login <= 1 menit).
 */
export async function getCurrentUser(): Promise<CurrentUserSession | null> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser || !authUser.email) {
    return null;
  }

  // Ambil profil dari tabel public.users
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, peran, nama, email, status_aktif, posyandu_ditugaskan")
    .eq("id", authUser.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  // F1-04 & FR1: Akun nonaktif wajib ditolak seketika
  if (!profile.status_aktif) {
    await supabase.auth.signOut();
    return null;
  }

  return {
    authUserId: authUser.id,
    email: authUser.email,
    profile: profile as UserProfile,
  };
}

/**
 * Memastikan pengguna yang sedang login memiliki peran yang diizinkan dan berstatus aktif.
 * Melemparkan error atau mengembalikan null jika otorisasi gagal.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<CurrentUserSession> {
  const session = await getCurrentUser();

  if (!session) {
    throw new Error("UNAUTHORIZED: Pengguna belum login atau akun telah dinonaktifkan.");
  }

  if (!allowedRoles.includes(session.profile.peran)) {
    throw new Error(
      `FORBIDDEN: Peran '${session.profile.peran}' tidak memiliki izin untuk aksi ini.`
    );
  }

  return session;
}

