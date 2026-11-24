import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  filterChildrenByMeasurementSegment,
  getChildMeasurementStatus,
  hasChildMeasurement,
} from "../lib/measurement-status";

const ROOT = path.resolve(__dirname, "..");

describe("Issue #22 - Logika Status & Segmentasi Indikator Sudah Diukur vs Belum Diukur", () => {
  describe("Logika Penentu Status & Segmentasi Anak", () => {
    it("mengembalikan 'Belum Diukur' bila anak belum memiliki data pengukuran sama sekali (0)", () => {
      expect(getChildMeasurementStatus(0)).toBe("Belum Diukur");
      expect(
        getChildMeasurementStatus({
          measurementCount: 0,
          latestMeasureDate: null,
        })
      ).toBe("Belum Diukur");
      expect(
        hasChildMeasurement({ measurementCount: 0, latestMeasureDate: null })
      ).toBe(false);
    });

    it("mengembalikan 'Sudah Diukur' bila anak memiliki minimal 1 data pengukuran meskipun health_profiles belum ada", () => {
      expect(getChildMeasurementStatus(1)).toBe("Sudah Diukur");
      expect(getChildMeasurementStatus(4)).toBe("Sudah Diukur");
      expect(
        getChildMeasurementStatus({
          measurementCount: 1,
          latestMeasureDate: "2026-11-24",
        })
      ).toBe("Sudah Diukur");
      expect(
        hasChildMeasurement({
          measurementCount: 1,
          latestMeasureDate: "2026-11-24",
        })
      ).toBe(true);
    });

    it("memfilter daftar anak dengan tepat menurut segmen all, measured, dan unmeasured", () => {
      const sample = [
        {
          id: "c1",
          measurementCount: 2,
          latestMeasureDate: "2026-11-20",
        },
        {
          id: "c2",
          measurementCount: 0,
          latestMeasureDate: null,
        },
        {
          id: "c3",
          measurementCount: 1,
          latestMeasureDate: "2026-11-24",
        },
      ];

      expect(
        filterChildrenByMeasurementSegment(sample, "all").map((c) => c.id)
      ).toEqual(["c1", "c2", "c3"]);
      expect(
        filterChildrenByMeasurementSegment(sample, "measured").map((c) => c.id)
      ).toEqual(["c1", "c3"]);
      expect(
        filterChildrenByMeasurementSegment(sample, "unmeasured").map((c) => c.id)
      ).toEqual(["c2"]);
    });
  });

  describe("Segmentasi Warna Indikator & Konsistensi Lintas Halaman", () => {
    it("StatusBadge memakai warna hijau (#DCFCE7 / #15803D) untuk Sudah Diukur dan merah (#FEE2E2 / #B91C1C) untuk Belum Diukur", () => {
      const badgeCode = fs.readFileSync(
        path.join(ROOT, "components/ui/StatusBadge.tsx"),
        "utf-8"
      );

      expect(badgeCode).toContain('"Sudah Diukur"');
      expect(badgeCode).toContain('"Belum Diukur"');
      expect(badgeCode).toContain("bg-[#DCFCE7] border-green-300");
      expect(badgeCode).toContain("bg-[#FEE2E2] border-red-300");
      expect(badgeCode).toContain("text-[#15803D]");
      expect(badgeCode).toContain("text-[#B91C1C]");
    });

    it("Halaman Dashboard (/balita) dan Halaman Detail Anak (/balita/[id]) menampilkan indikator terpusat & segmentasi lengkap", () => {
      const dashboardCode = fs.readFileSync(
        path.join(ROOT, "app/balita/page.tsx"),
        "utf-8"
      );
      const detailCode = fs.readFileSync(
        path.join(ROOT, "app/balita/[id]/page.tsx"),
        "utf-8"
      );

      expect(dashboardCode).toContain("getChildMeasurementStatus");
      expect(dashboardCode).toContain("filterChildrenByMeasurementSegment");
      expect(dashboardCode).toContain('role="tablist"');
      expect(dashboardCode).toContain("Sudah Diukur (");
      expect(dashboardCode).toContain("Belum Diukur (");

      expect(detailCode).toContain("getChildMeasurementStatus(measurements.length)");
      expect(detailCode).toContain("<StatusBadge status={measurementStatus} />");
    });

    it("seluruh berkas yang dibuat atau diubah bebas karakter em dash (R-02)", () => {
      const filesToScan = [
        "lib/measurement-status.ts",
        "components/ui/StatusBadge.tsx",
        "components/ui/Card.tsx",
        "app/balita/page.tsx",
        "app/balita/[id]/page.tsx",
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
