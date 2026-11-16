import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  annotateExtractedRows,
  validateMeasurementRow,
} from "../lib/validation/measurement";
import { analyzeImageDataQuality } from "../lib/camera/image-utils";
import type { ExtractedVisitRow } from "../lib/types";

const ROOT = path.resolve(__dirname, "..");

describe("Fase 2.2 - Endpoint Ekstraksi, Simpan Verifikasi, Kamera & Input Manual (B8, B9, C5, C6)", () => {
  it("memiliki seluruh berkas API, validasi, kamera, dan UI Fase 2 serta bebas karakter em dash", () => {
    const requiredFiles = [
      "lib/validation/measurement.ts",
      "lib/camera/image-utils.ts",
      "app/api/extractions/route.ts",
      "app/api/measurements/route.ts",
      "components/measurement/CameraCaptureCrop.tsx",
      "components/measurement/VerificationSideBySide.tsx",
      "components/measurement/ManualMeasurementForm.tsx",
      "app/balita/[id]/ukur/page.tsx",
      "app/balita/[id]/page.tsx",
    ];

    for (const rel of requiredFiles) {
      const fullPath = path.join(ROOT, rel);
      expect(fs.existsSync(fullPath), `Berkas belum ada: ${rel}`).toBe(true);
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(
        content.includes("\u2014"),
        `Ditemukan karakter em dash pada berkas: ${rel}`
      ).toBe(false);
    }
  });

  describe("Validasi Plausibilitas & Usia 0-59 Bulan (FR4)", () => {
    it("menerima baris pengukuran valid dan menghitung usia bulan dengan benar", () => {
      const res = validateMeasurementRow(
        {
          tgl_ukur: "2026-10-15",
          bb_kg: 9.4,
          pb_tb_cm: 76.2,
          cara_ukur: "berbaring",
          lk_cm: 45.0,
          lila_cm: 13.8,
          imunisasi: "Campak",
          asi_eksklusif: true,
        },
        "2025-10-15",
        "2026-11-16"
      );

      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.ageMonths).toBe(12);
    });

    it("menolak tanggal ukur di masa depan, usia >= 60 bulan, dan nilai di luar rentang biologis", () => {
      const futureRes = validateMeasurementRow(
        {
          tgl_ukur: "2027-01-01",
          bb_kg: 10,
          pb_tb_cm: 80,
          cara_ukur: "berdiri",
          lk_cm: null,
          lila_cm: null,
          imunisasi: null,
          asi_eksklusif: null,
        },
        "2025-01-01",
        "2026-11-16"
      );
      expect(futureRes.valid).toBe(false);
      expect(futureRes.errors.some((e) => e.includes("masa depan"))).toBe(true);

      const overAgeRes = validateMeasurementRow(
        {
          tgl_ukur: "2026-11-01",
          bb_kg: 18,
          pb_tb_cm: 110,
          cara_ukur: "berdiri",
          lk_cm: null,
          lila_cm: null,
          imunisasi: null,
          asi_eksklusif: null,
        },
        "2021-10-01",
        "2026-11-16"
      );
      expect(overAgeRes.valid).toBe(false);
      expect(overAgeRes.errors.some((e) => e.includes("59 bulan"))).toBe(true);

      const implausibleRes = validateMeasurementRow(
        {
          tgl_ukur: "2026-11-01",
          bb_kg: 42.0,
          pb_tb_cm: 155.0,
          cara_ukur: "berdiri",
          lk_cm: 70.0,
          lila_cm: null,
          imunisasi: null,
          asi_eksklusif: null,
        },
        "2025-01-01",
        "2026-11-16"
      );
      expect(implausibleRes.valid).toBe(false);
      expect(implausibleRes.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Anotasi Duplikat & Penyorotan Keyakinan Rendah", () => {
    it("menandai is_duplicate untuk tanggal yang sudah tercatat dan memberi peringatan keyakinan rendah", () => {
      const rows: ExtractedVisitRow[] = [
        {
          baris_index: 1,
          tgl_ukur: { value: "2026-10-10", confidence: 0.96 },
          bb_kg: { value: 8.5, confidence: 0.72 },
          pb_tb_cm: { value: 72.0, confidence: 0.91 },
          cara_ukur: { value: "berbaring", confidence: 0.93 },
          lk_cm: { value: 44.0, confidence: 0.9 },
          lila_cm: { value: 13.2, confidence: 0.9 },
          imunisasi: { value: null, confidence: 0.9 },
          asi_eksklusif: { value: true, confidence: 0.95 },
        },
      ];

      const annotated = annotateExtractedRows(
        rows,
        new Set(["2026-10-10"]),
        "2025-10-10",
        "2026-11-16"
      );

      expect(annotated[0]?.is_duplicate).toBe(true);
      expect(
        annotated[0]?.plausibility_warnings?.some((w) => w.includes("Berat badan"))
      ).toBe(true);
    });
  });

  describe("Analisis Kualitas Foto Sisi Klien (FR3)", () => {
    it("mendeteksi foto gelap dan buram vs foto terang dan tajam", () => {
      const w = 24;
      const h = 24;

      // 1. Foto seragam gelap (nilai RGB = 15) -> isDark & isBlurry
      const darkFlat = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        darkFlat[i * 4] = 15;
        darkFlat[i * 4 + 1] = 15;
        darkFlat[i * 4 + 2] = 15;
        darkFlat[i * 4 + 3] = 255;
      }
      const darkReport = analyzeImageDataQuality(darkFlat, w, h);
      expect(darkReport.isDark).toBe(true);
      expect(darkReport.isBlurry).toBe(true);
      expect(darkReport.warnings.length).toBeGreaterThanOrEqual(2);

      // 2. Foto terang dengan tepi tajam (pola papan catur kontras tinggi)
      const sharpBright = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const val = (x + y) % 2 === 0 ? 230 : 80;
          const idx = (y * w + x) * 4;
          sharpBright[idx] = val;
          sharpBright[idx + 1] = val;
          sharpBright[idx + 2] = val;
          sharpBright[idx + 3] = 255;
        }
      }
      const sharpReport = analyzeImageDataQuality(sharpBright, w, h);
      expect(sharpReport.isDark).toBe(false);
      expect(sharpReport.isBlurry).toBe(false);
      expect(sharpReport.warnings).toHaveLength(0);
    });
  });
});
