import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import manifest from "../app/manifest";
import { evaluateRouteAccess } from "../lib/auth/guard";
import {
  validateChildRegistration,
  findPotentialDuplicates,
  type ExistingChildSummary,
} from "../lib/validation/child-registration";

const ROOT = path.resolve(__dirname, "..");

describe("Fase 1.3 - Frontend Dasar & Sistem Desain PWA (F1-21 s.d. F1-26)", () => {
  it("memiliki seluruh berkas komponen UI, manifest PWA, middleware, dan halaman utama", () => {
    const requiredFiles = [
      "app/manifest.ts",
      "public/icons/icon-192x192.svg",
      "public/icons/icon-512x512.svg",
      "middleware.ts",
      "lib/auth/guard.ts",
      "lib/validation/child-registration.ts",
      "components/ui/Button.tsx",
      "components/ui/Input.tsx",
      "components/ui/Card.tsx",
      "components/ui/StatusBadge.tsx",
      "components/ui/FeedbackStates.tsx",
      "components/ui/index.ts",
      "app/login/page.tsx",
      "app/balita/page.tsx",
      "app/balita/[id]/page.tsx",
      "app/balita/baru/page.tsx",
      "app/bidan/kader/page.tsx",
    ];

    for (const relPath of requiredFiles) {
      const fullPath = path.join(ROOT, relPath);
      expect(fs.existsSync(fullPath), `File wajib belum ada: ${relPath}`).toBe(
        true
      );
    }
  });

  it("mengonfigurasi PWA Web App Manifest sesuai spesifikasi F1-21", () => {
    const m = manifest();
    expect(m.short_name).toBe("Posyandu+");
    expect(m.start_url).toBe("/balita");
    expect(m.display).toBe("standalone");
    expect(m.background_color).toBe("#F8FAFC");
    expect(m.theme_color).toBe("#111827");
    expect(Array.isArray(m.icons)).toBe(true);
    expect(m.icons?.length).toBeGreaterThanOrEqual(2);
  });

  describe("Proteksi Rute Berbasis Peran & Status Aktif (F1-26 & F1-04)", () => {
    it("mengarahkan pengguna yang belum login ke /login saat mengakses /balita atau /bidan/kader", () => {
      const balitaDecision = evaluateRouteAccess({
        pathname: "/balita",
        isAuthenticated: false,
      });
      expect(balitaDecision.allowed).toBe(false);
      expect(balitaDecision.redirectTo).toContain("/login");

      const bidanDecision = evaluateRouteAccess({
        pathname: "/bidan/kader",
        isAuthenticated: false,
      });
      expect(bidanDecision.allowed).toBe(false);
      expect(bidanDecision.redirectTo).toContain("/login");
    });

    it("menolak seketika dan memicu signOut jika akun berstatus nonaktif (status_aktif = false)", () => {
      const decision = evaluateRouteAccess({
        pathname: "/balita",
        isAuthenticated: true,
        role: "kader",
        isActive: false,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.shouldSignOut).toBe(true);
      expect(decision.redirectTo).toBe("/login?error=account_inactive");
    });

    it("memblokir peran Kader dari halaman /bidan/kader dan mengizinkan peran Bidan", () => {
      const kaderAttempt = evaluateRouteAccess({
        pathname: "/bidan/kader",
        isAuthenticated: true,
        role: "kader",
        isActive: true,
      });
      expect(kaderAttempt.allowed).toBe(false);
      expect(kaderAttempt.redirectTo).toBe("/balita?denied=bidan_only");

      const bidanAttempt = evaluateRouteAccess({
        pathname: "/bidan/kader",
        isAuthenticated: true,
        role: "bidan",
        isActive: true,
      });
      expect(bidanAttempt.allowed).toBe(true);
    });
  });

  describe("Validasi Registrasi Balita, Usia 0-59 Bulan & Consent UU PDP (F1-24)", () => {
    it("menolak registrasi apabila kotak persetujuan UU PDP belum dicentang", () => {
      const result = validateChildRegistration({
        nama: "Putu Gede Pratama",
        tgl_lahir: "2024-06-15",
        jenis_kelamin: "M",
        nama_ortu: "Ni Made Sari",
        posyandu_id: "pos-1",
        banjar: "Banjar Kaja",
        consent_given: false,
        referenceDate: "2026-06-15",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.consent_given).toBeDefined();
    });

    it("menolak registrasi apabila usia balita >= 60 bulan atau tanggal lahir di masa depan", () => {
      const tooOld = validateChildRegistration({
        nama: "Kadek Adi",
        tgl_lahir: "2020-01-10",
        jenis_kelamin: "M",
        nama_ortu: "Wayan Sudira",
        posyandu_id: "pos-1",
        banjar: "Banjar Tengah",
        consent_given: true,
        referenceDate: "2026-03-10",
      });
      expect(tooOld.isValid).toBe(false);
      expect(tooOld.ageMonths).toBeGreaterThanOrEqual(60);
      expect(tooOld.errors.tgl_lahir).toContain("59 bulan");

      const futureBirth = validateChildRegistration({
        nama: "Komang Ayu",
        tgl_lahir: "2026-08-01",
        jenis_kelamin: "F",
        nama_ortu: "Ketut Rai",
        posyandu_id: "pos-1",
        banjar: "Banjar Kelod",
        consent_given: true,
        referenceDate: "2026-03-10",
      });
      expect(futureBirth.isValid).toBe(false);
      expect(futureBirth.errors.tgl_lahir).toBeDefined();
    });

    it("menerima registrasi balita usia 0-59 bulan yang lengkap beserta persetujuan orang tua", () => {
      const valid = validateChildRegistration({
        nama: "Putu Ayu Lestari",
        tgl_lahir: "2024-03-10",
        jenis_kelamin: "F",
        nama_ortu: "Ni Luh Sari",
        posyandu_id: "pos-1",
        banjar: "Banjar Kaja",
        consent_given: true,
        referenceDate: "2026-03-10",
      });

      expect(valid.isValid).toBe(true);
      expect(valid.ageMonths).toBe(24);
      expect(Object.keys(valid.errors).length).toBe(0);
    });

    it("mendeteksi potensi duplikat berdasarkan nama (case-insensitive) dan tanggal lahir", () => {
      const existing: ExistingChildSummary[] = [
        {
          id: "c-1",
          nama: "Putu Ayu Lestari",
          tgl_lahir: "2024-03-10",
          nama_ortu: "Ni Luh Sari",
          banjar: "Banjar Kaja",
        },
      ];

      const matches = findPotentialDuplicates(
        "  putu   ayu lestari ",
        "2024-03-10",
        existing
      );
      expect(matches.length).toBe(1);
      expect(matches[0]?.id).toBe("c-1");

      const noMatch = findPotentialDuplicates(
        "Putu Ayu Lestari",
        "2024-03-11",
        existing
      );
      expect(noMatch.length).toBe(0);
    });
  });

  describe("Standar Desain & Aksesibilitas Antislop (NFR5 & R-02)", () => {
    it("menjamin target sentuh >= 48px pada komponen Button dan Input serta bebas karakter em dash", () => {
      const buttonCode = fs.readFileSync(
        path.join(ROOT, "components/ui/Button.tsx"),
        "utf-8"
      );
      const inputCode = fs.readFileSync(
        path.join(ROOT, "components/ui/Input.tsx"),
        "utf-8"
      );

      expect(buttonCode).toContain("min-h-[48px]");
      expect(inputCode).toContain("min-h-[48px]");

      const filesToScan = [
        "app/page.tsx",
        "app/layout.tsx",
        "app/login/page.tsx",
        "app/balita/page.tsx",
        "app/balita/[id]/page.tsx",
        "app/balita/baru/page.tsx",
        "app/bidan/kader/page.tsx",
        "components/ui/Button.tsx",
        "components/ui/Input.tsx",
        "components/ui/Card.tsx",
        "components/ui/StatusBadge.tsx",
        "components/ui/FeedbackStates.tsx",
      ];

      for (const rel of filesToScan) {
        const content = fs.readFileSync(path.join(ROOT, rel), "utf-8");
        expect(
          content.includes("\u2014"),
          `Ditemukan em dash pada file: ${rel}`
        ).toBe(false);
      }
    });
  });
});

