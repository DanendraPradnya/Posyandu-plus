import type { UserRole } from "../types";

export interface RouteAccessContext {
  pathname: string;
  isAuthenticated: boolean;
  role?: UserRole | null;
  isActive?: boolean | null;
}

export interface RouteAccessDecision {
  allowed: boolean;
  redirectTo?: string;
  shouldSignOut?: boolean;
  reason?: string;
}

/**
 * Memeriksa apakah peran pengguna adalah petugas Posyandu (Kader atau Bidan).
 */
export function isStaffRole(role?: UserRole | null): boolean {
  return role === "kader" || role === "bidan";
}

/**
 * Memeriksa apakah rute yang diminta dilarang untuk peran Orang Tua / Wali (read-only).
 * Orang tua hanya boleh mengakses /balita, /balita/[id], dan /balita/[id]/hasil.
 */
export function isParentBlockedRoute(pathname: string): boolean {
  if (pathname === "/bidan" || pathname.startsWith("/bidan/")) {
    return true;
  }
  if (pathname === "/balita/baru" || pathname.startsWith("/balita/baru/")) {
    return true;
  }
  if (/^\/balita\/[^/]+\/(ukur|scan|verifikasi|ukur-manual)(\/|$)/.test(pathname)) {
    return true;
  }
  return false;
}

/**
 * Mengevaluasi hak akses rute berdasarkan status autentikasi, status aktif akun,
 * dan peran pengguna (Kader, Bidan, atau Orang Tua / Wali) sesuai F1-26, F1-04, dan Issue #17.
 */
export function evaluateRouteAccess(ctx: RouteAccessContext): RouteAccessDecision {
  const { pathname, isAuthenticated, role, isActive } = ctx;

  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");
  const isProtectedBalitaRoute =
    pathname === "/balita" || pathname.startsWith("/balita/");
  const isProtectedBidanRoute =
    pathname === "/bidan" || pathname.startsWith("/bidan/");
  const isProtectedRoute = isProtectedBalitaRoute || isProtectedBidanRoute;

  // 1. Jika pengguna terautentikasi tetapi akunnya telah dinonaktifkan (F1-04)
  if (isAuthenticated && isActive === false) {
    return {
      allowed: false,
      shouldSignOut: true,
      redirectTo: "/login?error=account_inactive",
      reason: "Akun telah dinonaktifkan oleh Bidan.",
    };
  }

  // 2. Jika belum login dan mencoba mengakses rute terproteksi (/balita/* atau /bidan/*)
  if (!isAuthenticated && isProtectedRoute) {
    const nextParam = encodeURIComponent(pathname);
    return {
      allowed: false,
      redirectTo: `/login?next=${nextParam}`,
      reason: "Pengguna belum login.",
    };
  }

  // 3. Jika sudah login dan aktif tetapi mengakses halaman /login -> arahkan ke /balita
  if (isAuthenticated && isActive !== false && isLoginRoute) {
    return {
      allowed: false,
      redirectTo: "/balita",
      reason: "Pengguna sudah masuk.",
    };
  }

  // 4. Pembatasan ketat peran Orang Tua / Wali (read-only: tidak boleh input/ukur/bidan)
  if (isAuthenticated && role === "orang_tua" && isParentBlockedRoute(pathname)) {
    return {
      allowed: false,
      redirectTo: "/balita?denied=parent_readonly",
      reason: "Akun Orang Tua/Wali hanya memiliki akses baca terhadap data perkembangan anaknya sendiri.",
    };
  }

  // 5. Jika mengakses rute khusus Bidan (/bidan/*), wajib peran === 'bidan'
  if (isAuthenticated && isProtectedBidanRoute && role !== "bidan") {
    return {
      allowed: false,
      redirectTo: "/balita?denied=bidan_only",
      reason: "Halaman ini khusus untuk peran Bidan.",
    };
  }

  return { allowed: true };
}
