import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  CRITICAL_FIXED_TEMPLATE,
  evaluateHealthRulesAndProfile,
  type VisitHistoryEntry,
} from "../lib/rules";
import { getAccumulativeKbmGrams, getKmsLinePoint } from "../lib/rules/ref-data";
import { calculateAllZScores } from "../lib/zscore";
import { checkMeasurementAnomalies } from "../lib/validation/measurement";
import {
  generateShareToken,
  hashShareToken,
  maskChildName,
} from "../lib/share/token";
import type { Measurement, Sex } from "../lib/types";

const ROOT = path.resolve(__dirname, "..");

function makeVisit(
  id: string,
  birthDate: string,
  sex: Sex,
  tglUkur: string,
  bbKg: number,
  pbTbCm: number | null,
  lilaCm: number | null = null
): VisitHistoryEntry {
  const zOut = calculateAllZScores({
    birthDate,
    measureDate: tglUkur,
    sex,
    weightKg: bbKg,
    pbTbCm,
    armCircumferenceCm: lilaCm,
  });

  const measurement: Measurement = {
    id,
    child_id: "child-1",
    tgl_ukur: tglUkur,
    usia_bulan: zOut.ageMonths,
    bb_kg: bbKg,
    pb_tb_cm: pbTbCm,
    cara_ukur: zOut.ageMonths < 24 ? "berbaring" : "berdiri",
    lk_cm: null,
    lila_cm: lilaCm,
    imunisasi: null,
    asi_eksklusif: null,
    sumber: "manual",
    verified_by: "user-1",
    verified_at: `${tglUkur}T08:00:00.000Z`,
    foto_ref: null,
  };

  return {
    measurement,
    zscores: Object.values(zOut.results),
  };
}

describe("Fase 3 - Aturan R1-R8, Profil Kesehatan, KMS & Tautan Bagikan (B6, B7, B10, C7-C9)", () => {
  it("memiliki seluruh berkas Fase 3 dan bebas karakter em dash", () => {
    const requiredFiles = [
      "lib/rules/ref-data.ts",
      "lib/rules/index.ts",
      "lib/share/token.ts",
      "app/api/share-links/route.ts",
      "app/api/share-links/[id]/route.ts",
      "components/kms/KmsChart.tsx",
      "components/health/HealthProfileCard.tsx",
      "components/share/ShareLinkManager.tsx",
      "app/balita/[id]/hasil/page.tsx",
      "app/hasil/[token]/page.tsx",
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

  it("menghitung KBM akumulatif saat jarak kunjungan > 1 bulan dan memicu R1 hanya jika 2 kali berturut-turut T", () => {
    // Laki-laki bulan 1 (800g) + bulan 2 (900g) = 1700g
    expect(getAccumulativeKbmGrams("M", 0, 2)).toBe(1700);
    // Garis KMS tepat 24 bulan memakai grafik 0-2 tahun
    expect(getKmsLinePoint("M", 24)?.chart).toBe("0-2");
    expect(getKmsLinePoint("M", 25)?.chart).toBe("2-5");

    const birth = "2025-01-01";
    const v1 = makeVisit("m1", birth, "M", "2026-01-01", 9.6, 75.7); // 12 bln
    const v2 = makeVisit("m2", birth, "M", "2026-02-01", 9.6, 76.5); // 13 bln, T ke-1
    const v3 = makeVisit("m3", birth, "M", "2026-03-01", 9.5, 77.2); // 14 bln, T ke-2

    const afterV2 = evaluateHealthRulesAndProfile({
      sex: "M",
      history: [v1, v2],
    });
    expect(afterV2.trenBb).toBe("Tidak Naik (T)");
    expect(afterV2.aturanTerpicu.some((r) => r.kode === "R1")).toBe(false);
    expect(afterV2.catatanPemantauan).toContain("R1");

    const afterV3 = evaluateHealthRulesAndProfile({
      sex: "M",
      history: [v1, v2, v3],
    });
    expect(afterV3.aturanTerpicu.some((r) => r.kode === "R1")).toBe(true);
    expect(afterV3.statusKeseluruhan).toBe("Waspada");
  });

  it("memicu R2 (turun >= 1 pita Z-Score), R3a (bawah garis merah), dan R3b (atas garis oranye)", () => {
    const birth = "2025-01-01";
    // Kunjungan 1: BB normal tinggi (10.6 kg pada 12 bln, antara 0..+1 SD)
    const v1 = makeVisit("m1", birth, "M", "2026-01-01", 10.6, 76.0);
    // Kunjungan 2: BB turun ke 8.2 kg (antara -2..-1 SD) -> turun >= 1 pita (R2)
    const v2 = makeVisit("m2", birth, "M", "2026-02-01", 8.2, 76.5);
    const resR2 = evaluateHealthRulesAndProfile({ sex: "M", history: [v1, v2] });
    expect(resR2.aturanTerpicu.some((r) => r.kode === "R2")).toBe(true);

    // R3a: 12 bln laki-laki garis merah = 7.8 kg -> uji 7.7 kg (masih > -3 SD)
    const vRed = makeVisit("m3", birth, "M", "2026-01-01", 7.7, 71.0);
    const resR3a = evaluateHealthRulesAndProfile({ sex: "M", history: [vRed] });
    expect(resR3a.aturanTerpicu.some((r) => r.kode === "R3a")).toBe(true);
    expect(resR3a.statusKeseluruhan).toBe("Berisiko");

    // R3b: 12 bln laki-laki garis oranye = 10.8 kg -> uji 11.2 kg
    const vOrange = makeVisit("m4", birth, "M", "2026-01-01", 11.2, 78.0);
    const resR3b = evaluateHealthRulesAndProfile({ sex: "M", history: [vOrange] });
    expect(resR3b.aturanTerpicu.some((r) => r.kode === "R3b")).toBe(true);
  });

  it("memicu R4 (stunted/wasted), R5 (Kritis < -3 SD / LiLA < 11.5), R6 (LiLA 11.5-12.4), R7 & R8", () => {
    const birth = "2024-01-01";
    // R4: TB sangat pendek/pendek (-2.5 SD) pada 24 bln (M median ~87.1, -2 SD ~81.0)
    const vR4 = makeVisit("m4", birth, "M", "2026-01-01", 11.5, 80.0);
    const resR4 = evaluateHealthRulesAndProfile({ sex: "M", history: [vR4] });
    expect(resR4.aturanTerpicu.some((r) => r.kode === "R4")).toBe(true);
    expect(resR4.statusKeseluruhan).toBe("Berisiko");

    // R5 via LiLA < 11.5 cm -> Kritis
    const vR5 = makeVisit("m5", birth, "M", "2026-01-01", 11.5, 86.0, 11.2);
    const resR5 = evaluateHealthRulesAndProfile({ sex: "M", history: [vR5] });
    expect(resR5.aturanTerpicu.some((r) => r.kode === "R5")).toBe(true);
    expect(resR5.statusKeseluruhan).toBe("Kritis");
    expect(resR5.aturanTerpicu.find((r) => r.kode === "R5")?.alasan_awam).toContain(
      CRITICAL_FIXED_TEMPLATE
    );

    // R6 via LiLA 12.0 cm -> Berisiko
    const vR6 = makeVisit("m6", birth, "M", "2026-01-01", 11.5, 86.0, 12.0);
    const resR6 = evaluateHealthRulesAndProfile({ sex: "M", history: [vR6] });
    expect(resR6.aturanTerpicu.some((r) => r.kode === "R6")).toBe(true);

    // R7: BB/TB > +2 SD (obesitas/gizi lebih)
    const vR7 = makeVisit("m7", birth, "M", "2026-01-01", 16.0, 86.0);
    const resR7 = evaluateHealthRulesAndProfile({ sex: "M", history: [vR7] });
    expect(resR7.aturanTerpicu.some((r) => r.kode === "R7")).toBe(true);

    // R8: BB/TB +1 s.d. +2 SD (berisiko gizi lebih)
    const vR8 = makeVisit("m8", birth, "M", "2026-01-01", 13.0, 86.0);
    const resR8 = evaluateHealthRulesAndProfile({ sex: "M", history: [vR8] });
    expect(resR8.aturanTerpicu.some((r) => r.kode === "R8")).toBe(true);
  });

  it("mendeteksi anomali biologis WHO dan penyusutan tinggi badan untuk konfirmasi cek ulang", () => {
    const birth = "2025-10-01";
    const prior = makeVisit("m1", birth, "M", "2026-10-01", 9.2, 75.0).measurement;

    const anomaly = checkMeasurementAnomalies(
      {
        tgl_ukur: "2026-11-01",
        bb_kg: 26.0, // Mustahil untuk bayi 13 bulan
        pb_tb_cm: 72.0, // Menyusut 3 cm dari 75.0 cm
        cara_ukur: "berbaring",
        lk_cm: null,
        lila_cm: null,
        imunisasi: null,
        asi_eksklusif: null,
      },
      birth,
      "M",
      [prior]
    );

    expect(anomaly.hasAnomalies).toBe(true);
    expect(anomaly.anomalyWarnings.some((w) => w.includes("Anomali Biologis WHO"))).toBe(
      true
    );
    expect(anomaly.anomalyWarnings.some((w) => w.includes("menyusut"))).toBe(true);
  });

  it("menghasilkan token bagikan aman, hash konsisten, dan menyamarkan nama lengkap tanpa PII", () => {
    const t1 = generateShareToken();
    const t2 = generateShareToken();
    expect(t1.length).toBeGreaterThanOrEqual(32);
    expect(t1).not.toBe(t2);
    expect(hashShareToken(t1)).toBe(hashShareToken(t1));
    expect(hashShareToken(t1)).not.toBe(t1);

    expect(maskChildName("I Putu Adinata Kusuma")).toBe("I P. A. K.");
    expect(maskChildName("Made")).toBe("Mad.");
  });
});
