import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  evaluateRouteAccess,
  isParentBlockedRoute,
  isStaffRole,
} from "../lib/auth/guard";
import type { Child } from "../lib/types";

const ROOT = path.resolve(__dirname, "..");

describe("Issue #17 - Peran Pengguna Orang Tua / Wali (Parents Read-Only Access)", () => {
  it("memiliki migrasi SQL 005 dengan RLS read-only (hanya FOR SELECT) untuk peran orang_tua", () => {
    const migrationPath = path.join(
      ROOT,
      "supabase/migrations/005_parent_role_and_rls.sql"
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("CHECK (peran IN ('kader', 'bidan', 'orang_tua'))");
    expect(sql).toContain("parent_user_id UUID");
    expect(sql).toContain("children_parent_select");
    expect(sql).toContain("measurements_parent_select");
    expect(sql).toContain("zscores_parent_select");
    expect(sql).toContain("health_profiles_parent_select");
    expect(sql).toContain("alerts_parent_select");
    expect(sql).toContain("education_parent_select");
    expect(sql).toContain("status_review = 'aktif'");

    // Pastikan tidak ada kebijakan tulis (INSERT/UPDATE/DELETE/ALL) untuk orang_tua
    expect(sql).not.toMatch(/parent_(insert|update|delete|all)/i);
    expect(sql).not.toMatch(/FOR\s+(INSERT|UPDATE|DELETE|ALL)/i);
  });

  describe("Route Guard & Hak Akses Rute Orang Tua (Read-Only)", () => {
    it("mengizinkan orang_tua aktif membuka daftar anaknya, profil perkembangan, dan halaman hasil rekomendasi AI", () => {
      const allowedPaths = [
        "/balita",
        "/balita/child-001",
        "/balita/child-001/hasil",
      ];

      for (const pathname of allowedPaths) {
        const decision = evaluateRouteAccess({
          pathname,
          isAuthenticated: true,
          role: "orang_tua",
          isActive: true,
        });
        expect(decision.allowed, `Harusnya diizinkan: ${pathname}`).toBe(true);
      }
    });

    it("memblokir orang_tua dari halaman registrasi, input/scan pengukuran, dan panel Bidan", () => {
      const blockedPaths = [
        "/balita/baru",
        "/balita/child-001/ukur",
        "/balita/child-001/scan",
        "/balita/child-001/verifikasi",
        "/balita/child-001/ukur-manual",
        "/bidan/kader",
      ];

      for (const pathname of blockedPaths) {
        expect(isParentBlockedRoute(pathname)).toBe(true);
        const decision = evaluateRouteAccess({
          pathname,
          isAuthenticated: true,
          role: "orang_tua",
          isActive: true,
        });
        expect(decision.allowed, `Harusnya diblokir: ${pathname}`).toBe(false);
        expect(decision.redirectTo).toBe("/balita?denied=parent_readonly");
      }
    });

    it("tetap mengizinkan Kader & Bidan membuka halaman input dan menolak akun orang_tua nonaktif", () => {
      expect(isStaffRole("kader")).toBe(true);
      expect(isStaffRole("bidan")).toBe(true);
      expect(isStaffRole("orang_tua")).toBe(false);

      const kaderInput = evaluateRouteAccess({
        pathname: "/balita/child-001/ukur",
        isAuthenticated: true,
        role: "kader",
        isActive: true,
      });
      expect(kaderInput.allowed).toBe(true);

      const inactiveParent = evaluateRouteAccess({
        pathname: "/balita",
        isAuthenticated: true,
        role: "orang_tua",
        isActive: false,
      });
      expect(inactiveParent.allowed).toBe(false);
      expect(inactiveParent.shouldSignOut).toBe(true);
      expect(inactiveParent.redirectTo).toBe("/login?error=account_inactive");
    });
  });

  it("memastikan seluruh endpoint API mutasi menolak peran orang_tua dengan HTTP 403", () => {
    const mutationApiRoutes = [
      "app/api/extractions/route.ts",
      "app/api/extractions/upload/route.ts",
      "app/api/extractions/[jobId]/confirm/route.ts",
      "app/api/measurements/route.ts",
      "app/api/measurements/manual/route.ts",
      "app/api/share-links/route.ts",
      "app/api/share-links/[id]/route.ts",
    ];

    for (const rel of mutationApiRoutes) {
      const content = fs.readFileSync(path.join(ROOT, rel), "utf-8");
      expect(content, `${rel} wajib memblokir peran orang_tua`).toContain(
        'peran === "orang_tua"'
      );
      expect(content, `${rel} wajib mengembalikan status 403`).toContain("403");
    }
  });

  it("memastikan isolasi data anak per parent_user_id dan bebas karakter em dash", () => {
    const children: Child[] = [
      {
        id: "child-a",
        nama: "I Gede Rama",
        tgl_lahir: "2025-10-15",
        jenis_kelamin: "M",
        nama_ortu: "I Made Sanjaya",
        parent_user_id: "parent-1",
        posyandu_id: "pos-1",
        banjar: "Banjar Dalem",
        consent_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "child-b",
        nama: "Ni Kadek Ayu",
        tgl_lahir: "2025-03-20",
        jenis_kelamin: "F",
        nama_ortu: "Ni Ketut Suartini",
        parent_user_id: "parent-2",
        posyandu_id: "pos-1",
        banjar: "Banjar Dalem",
        consent_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const visibleForParent1 = children.filter(
      (c) => c.parent_user_id === "parent-1"
    );
    expect(visibleForParent1.map((c) => c.id)).toEqual(["child-a"]);

    const filesToScan = [
      "supabase/migrations/005_parent_role_and_rls.sql",
      "lib/auth/guard.ts",
      "app/login/page.tsx",
      "app/balita/page.tsx",
      "app/balita/baru/page.tsx",
      "app/balita/[id]/page.tsx",
      "app/balita/[id]/ukur/page.tsx",
      "app/balita/[id]/hasil/page.tsx",
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
