import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getTodayIsoLocal } from "../lib/zscore/age";

const ROOT = path.resolve(__dirname, "..");

describe("Issue #21 - Penyempurnaan Tata Letak UI & Logika Frontend Lintas Halaman", () => {
  it("navbar halaman Beranda (/) ringkas satu baris tanpa flex-wrap liar atau duplikasi link /balita di nav tengah", () => {
    const homeCode = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf-8");

    expect(homeCode).not.toContain('flex items-center justify-between gap-3 flex-wrap rounded-full');
    expect(homeCode).toContain("whitespace-nowrap");
    // Pastikan link /balita tidak diduplikasi di dalam <nav aria-label="Navigasi Utama">
    const navMatch = homeCode.match(/<nav[\s\S]*?<\/nav>/);
    expect(navMatch).not.toBeNull();
    expect(navMatch?.[0]).not.toContain('href="/balita"');
  });

  it("kartu filter & dropdown urutkan di /balita memiliki min-w-0, overflow-hidden, dan logika visibilitas kontekstual", () => {
    const balitaCode = fs.readFileSync(
      path.join(ROOT, "app/balita/page.tsx"),
      "utf-8"
    );

    expect(balitaCode).toContain("overflow-hidden");
    expect(balitaCode).toContain("min-w-0");
    expect(balitaCode).toContain("truncate text-ellipsis");
    expect(balitaCode).toContain("(!isParent || childrenList.length > 1)");
  });

  it("komponen Input & Select memakai text-base di mobile (cegah auto-zoom iOS) dan min-w-0", () => {
    const inputCode = fs.readFileSync(
      path.join(ROOT, "components/ui/Input.tsx"),
      "utf-8"
    );

    expect(inputCode).toContain("min-w-0");
    expect(inputCode).toContain("max-w-full");
    expect(inputCode).toContain("text-base sm:text-sm");
    expect(inputCode).toContain("truncate text-ellipsis");
  });

  it("komponen form pengukuran & halaman detail memiliki perlindungan overflow min-w-0", () => {
    const manualCode = fs.readFileSync(
      path.join(ROOT, "components/measurement/ManualMeasurementForm.tsx"),
      "utf-8"
    );
    const verifyCode = fs.readFileSync(
      path.join(ROOT, "components/measurement/VerificationSideBySide.tsx"),
      "utf-8"
    );
    const detailCode = fs.readFileSync(
      path.join(ROOT, "app/balita/[id]/page.tsx"),
      "utf-8"
    );

    expect(manualCode).toContain("min-w-0 max-w-full");
    expect(verifyCode).toContain("min-w-0 max-w-full");
    expect(verifyCode).toContain("min-h-[48px]");
    expect(detailCode).toContain("break-words min-w-0");
  });

  it("aksesibilitas tab KMS, target sentuh >= 48px, dan prefers-reduced-motion terpenuhi", () => {
    const kmsCode = fs.readFileSync(
      path.join(ROOT, "components/kms/KmsChart.tsx"),
      "utf-8"
    );
    const feedbackCode = fs.readFileSync(
      path.join(ROOT, "components/ui/FeedbackStates.tsx"),
      "utf-8"
    );
    const shareCode = fs.readFileSync(
      path.join(ROOT, "components/share/ShareLinkManager.tsx"),
      "utf-8"
    );

    expect(kmsCode).toContain('role="tablist"');
    expect(kmsCode).toContain('role="tab"');
    expect(kmsCode).toContain("aria-selected");
    expect(feedbackCode).toContain("motion-reduce:animate-none");
    expect(feedbackCode).toContain("min-h-[48px] min-w-[48px]");
    expect(shareCode).toContain("min-h-[48px]");
  });

  it("halaman hasil memakai getTodayIsoLocal() untuk konsistensi tanggal lokal dan bebas karakter em dash", () => {
    const hasilPage = fs.readFileSync(
      path.join(ROOT, "app/balita/[id]/hasil/page.tsx"),
      "utf-8"
    );
    const publicSharePage = fs.readFileSync(
      path.join(ROOT, "app/hasil/[token]/page.tsx"),
      "utf-8"
    );

    expect(hasilPage).toContain("getTodayIsoLocal()");
    expect(publicSharePage).toContain("getTodayIsoLocal()");
    expect(hasilPage).not.toContain("new Date().toISOString().slice(0, 10)");
    expect(publicSharePage).not.toContain("new Date().toISOString().slice(0, 10)");

    const localIso = getTodayIsoLocal(new Date(2026, 10, 24, 22, 30, 0));
    expect(localIso).toBe("2026-11-24");

    const filesToScan = [
      "lib/zscore/age.ts",
      "app/page.tsx",
      "app/balita/page.tsx",
      "app/balita/baru/page.tsx",
      "app/balita/[id]/page.tsx",
      "app/balita/[id]/hasil/page.tsx",
      "app/balita/[id]/ukur/page.tsx",
      "app/bidan/kader/page.tsx",
      "app/hasil/[token]/page.tsx",
      "components/ui/Input.tsx",
      "components/ui/FeedbackStates.tsx",
      "components/kms/KmsChart.tsx",
      "components/share/ShareLinkManager.tsx",
      "components/measurement/ManualMeasurementForm.tsx",
      "components/measurement/VerificationSideBySide.tsx",
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
