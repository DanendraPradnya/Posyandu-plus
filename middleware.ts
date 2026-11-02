import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { evaluateRouteAccess } from "@/lib/auth/guard";
import type { UserRole } from "@/lib/types";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "your-supabase-anon-key"
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Jika env Supabase belum tersedia (misal pada environment CI tanpa kredensial live),
  // lewati pemeriksaan jaringan di middleware agar aplikasi tetap dapat dirender.
  if (!supabaseUrl || !supabaseKey || supabaseUrl === "your-supabase-url") {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }>
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabaseResponse.cookies.set(name, value, options as any)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole | null = null;
  let isActive: boolean | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("peran, status_aktif")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      role = profile.peran as UserRole;
      isActive = Boolean(profile.status_aktif);
    } else {
      isActive = false;
    }
  }

  const decision = evaluateRouteAccess({
    pathname: request.nextUrl.pathname,
    isAuthenticated: Boolean(user),
    role,
    isActive,
  });

  if (decision.shouldSignOut) {
    await supabase.auth.signOut();
  }

  if (!decision.allowed && decision.redirectTo) {
    const redirectUrl = new URL(decision.redirectTo, request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest\\.webmanifest|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

