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
 * Mengevaluasi hak akses rute berdasarkan status autentikasi, status aktif akun,
 * dan peran pengguna (Kader vs Bidan) sesuai ketentuan F1-26 dan F1-04.
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

  // 4. Jika mengakses rute khusus Bidan (/bidan/*), wajib peran === 'bidan'
  if (isAuthenticated && isProtectedBidanRoute && role !== "bidan") {
    return {
      allowed: false,
      redirectTo: "/balita?denied=bidan_only",
      reason: "Halaman ini khusus untuk peran Bidan.",
    };
  }

  return { allowed: true };
}

