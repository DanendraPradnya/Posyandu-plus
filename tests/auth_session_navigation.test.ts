import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { evaluateRouteAccess } from "../lib/auth/guard";
import type { UserRole } from "../lib/types";

const ROOT = path.resolve(__dirname, "..");

describe("Issue #19 - Persistensi Sesi Autentikasi & Navigasi Beranda Lintas Peran", () => {
  const allRoles: UserRole[] = ["orang_tua", "kader", "bidan"];

  describe("Evaluasi Akses Rute Beranda (/) & Perlindungan dari Auto-Logout", () => {
    it("mengizinkan pengguna aktif dari semua peran (orang_tua, kader, bidan) mengakses Beranda (/) tanpa signOut", () => {
      for (const role of allRoles) {
        const decision = evaluateRouteAccess({
          pathname: "/",
          isAuthenticated: true,
          role,
          isActive: true,
        });
        expect(decision.allowed, `Peran ${role} wajib diizinkan ke /`).toBe(true);
        expect(decision.shouldSignOut).toBeUndefined();
        expect(decision.redirectTo).toBeUndefined();
      }
    });

    it("tidak memicu shouldSignOut apabila status aktif belum terkonfirmasi (isActive: null/undefined) saat galat jaringan sementara", () => {
      for (const role of [null, ...allRoles] as Array<UserRole | null>) {
        const homeDecision = evaluateRouteAccess({
          pathname: "/",
          isAuthenticated: true,
          role,
          isActive: null,
        });
        expect(homeDecision.allowed).toBe(true);
        expect(homeDecision.shouldSignOut).toBeUndefined();

        const balitaDecision = evaluateRouteAccess({
          pathname: "/balita",
          isAuthenticated: true,
          role,
          isActive: null,
        });
        expect(balitaDecision.allowed).toBe(true);
        expect(balitaDecision.shouldSignOut).toBeUndefined();
      }
    });

    it("hanya memicu shouldSignOut apabila isActive bernilai false secara eksplisit untuk semua peran", () => {
      for (const role of allRoles) {
        const decision = evaluateRouteAccess({
          pathname: "/",
          isAuthenticated: true,
          role,
          isActive: false,
        });
        expect(decision.allowed).toBe(false);
        expect(decision.shouldSignOut).toBe(true);
        expect(decision.redirectTo).toBe("/login?error=account_inactive");
      }
    });

    it("mengarahkan pengguna aktif dari semua peran yang membuka /login langsung ke /balita tanpa signOut", () => {
      for (const role of allRoles) {
        const decision = evaluateRouteAccess({
          pathname: "/login",
          isAuthenticated: true,
          role,
          isActive: true,
        });
        expect(decision.allowed).toBe(false);
        expect(decision.shouldSignOut).toBeUndefined();
        expect(decision.redirectTo).toBe("/balita");
      }
    });
  });

  describe("Verifikasi Implementasi Middleware, Login, & Halaman Beranda Sadar-Sesi", () => {
    it("middleware menjaga atribut cookie secara utuh saat redirect dan mencegah signOut saat prefetch atau galat query", () => {
      const middlewareCode = fs.readFileSync(
        path.join(ROOT, "middleware.ts"),
        "utf-8"
      );

      expect(middlewareCode).toContain("profileError");
      expect(middlewareCode).toContain("isPrefetch");
      expect(middlewareCode).toContain("redirectResponse.cookies.set(cookie)");
      expect(middlewareCode).not.toContain(
        "redirectResponse.cookies.set(cookie.name, cookie.value)"
      );
      expect(middlewareCode).toContain("decision.shouldSignOut && !isPrefetch");
    });

    it("halaman /login memakai router.replace setelah login berhasil dan memeriksa sesi aktif saat dimuat", () => {
      const loginCode = fs.readFileSync(
        path.join(ROOT, "app/login/page.tsx"),
        "utf-8"
      );

      expect(loginCode).toContain("router.replace(targetRoute)");
      expect(loginCode).not.toContain("router.push(targetRoute)");
      expect(loginCode).toContain("supabase.auth.getSession()");
    });

    it("halaman Beranda (/) sadar-sesi dan sadar-peran (menampilkan identitas, tombol Keluar, dan menyembunyikan rute terlarang bagi orang_tua)", () => {
      const homeCode = fs.readFileSync(
        path.join(ROOT, "app/page.tsx"),
        "utf-8"
      );

      expect(homeCode).toContain('"use client"');
      expect(homeCode).toContain("supabase.auth.getSession()");
      expect(homeCode).toContain("supabase.auth.onAuthStateChange");
      expect(homeCode).toContain("handleSignOut");
      expect(homeCode).toContain("Orang Tua / Wali");
      expect(homeCode).toContain("Data Anak Saya");
      expect(homeCode).toContain("Lihat Perkembangan Anak Saya");
    });

    it("seluruh berkas yang dimodifikasi bebas dari karakter em dash sesuai aturan antislop R-02", () => {
      const filesToScan = [
        "middleware.ts",
        "lib/auth/guard.ts",
        "lib/supabase/client.ts",
        "app/page.tsx",
        "app/login/page.tsx",
        "app/balita/page.tsx",
        "app/balita/[id]/page.tsx",
        "app/balita/[id]/hasil/page.tsx",
        "app/balita/[id]/ukur/page.tsx",
      ];

      for (const rel of filesToScan) {
        const content = fs.readFileSync(path.join(ROOT, rel), "utf-8");
        expect(
          content.includes("\u2014"),
          `Ditemukan karakter em dash pada berkas: ${rel}`
        ).toBe(false);
      }
    });
  });
});
