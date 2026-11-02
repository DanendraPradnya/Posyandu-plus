import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  calculateAgeInMonths,
  validateAgeInMonths,
  getAndValidateAge,
  calculateZScore,
  getLmsParameters,
  applyMeasurementMethodCorrection,
  determineIndicators,
  calculateBmi,
  buildZScoreResult,
  classifyZScore,
  checkBiologicalImpossibility,
  classifyLila,
  calculateAllZScores,
  ZSCORE_TABLE_VERSION,
} from "../lib/zscore";

describe("Verifikasi Fase 1.2: Z-Score Engine Deterministik (F1-12 s.d. F1-20)", () => {
  const baseDir = path.resolve(__dirname, "..");

  // ==========================================================================
  // F1-12: Usia dalam Bulan Penuh & Validasi Rentang
  // ==========================================================================
  describe("F1-12: Modul Usia (age.ts)", () => {
    it("menghitung usia bulan penuh secara akurat dengan pembulatan ke bawah", () => {
      // Tepat 0 bulan (lahir hari ini)
      expect(calculateAgeInMonths("2026-10-15", "2026-10-15")).toBe(0);

      // Belum genap 1 bulan (hari ukur < hari lahir)
      expect(calculateAgeInMonths("2026-09-20", "2026-10-19")).toBe(0);

      // Tepat 1 bulan
      expect(calculateAgeInMonths("2026-09-20", "2026-10-20")).toBe(1);

      // Tepat 23 bulan
      expect(calculateAgeInMonths("2024-11-10", "2026-10-10")).toBe(23);

      // Tepat 24 bulan (titik transisi PB ke TB)
      expect(calculateAgeInMonths("2024-10-10", "2026-10-10")).toBe(24);

      // Tepat 59 bulan (batas maksimum balita)
      expect(calculateAgeInMonths("2021-11-10", "2026-10-10")).toBe(59);

      // Tepat 60 bulan (di luar rentang MVP)
      expect(calculateAgeInMonths("2021-10-10", "2026-10-10")).toBe(60);
    });

    it("memvalidasi batas usia 0-59 bulan dan menolak tanggal tidak valid", () => {
      expect(validateAgeInMonths(0).isValid).toBe(true);
      expect(validateAgeInMonths(23).isValid).toBe(true);
      expect(validateAgeInMonths(24).isValid).toBe(true);
      expect(validateAgeInMonths(59).isValid).toBe(true);

      // Negatif (tgl_ukur lebih awal dari tgl_lahir)
      const resNeg = validateAgeInMonths(-1);
      expect(resNeg.isValid).toBe(false);
      expect(resNeg.errorMessage).toContain("Tanggal pengukuran tidak boleh lebih awal");

      // 60 bulan ke atas
      const res60 = validateAgeInMonths(60);
      expect(res60.isValid).toBe(false);
      expect(res60.errorMessage).toContain("60 bulan");

      const helper = getAndValidateAge("2025-01-01", "2026-01-01");
      expect(helper.isValid).toBe(true);
      expect(helper.ageMonths).toBe(12);
    });
  });

  // ==========================================================================
  // F1-13: Rumus LMS WHO 2006 & Interpolasi Linear
  // ==========================================================================
  describe("F1-13: Modul Rumus LMS (lms.ts)", () => {
    it("mencari parameter LMS eksak dari tabel referensi", () => {
      const lms = getLmsParameters("BB/U", "M", 0);
      expect(lms).not.toBeNull();
      expect(lms?.L).toBeCloseTo(0.3487, 4);
      expect(lms?.M).toBeCloseTo(3.3464, 4);
      expect(lms?.S).toBeCloseTo(0.14602, 5);
    });

    it("melakukan interpolasi linear untuk nilai x non-integer", () => {
      // Panjang 72.5 cm (antara 72 cm dan 73 cm pada BB/PB Laki-laki)
      const lms72 = getLmsParameters("BB/PB", "M", 72);
      const lms73 = getLmsParameters("BB/PB", "M", 73);
      const lmsMid = getLmsParameters("BB/PB", "M", 72.5);

      expect(lms72).not.toBeNull();
      expect(lms73).not.toBeNull();
      expect(lmsMid).not.toBeNull();

      const expectedM = (lms72!.M + lms73!.M) / 2;
      expect(lmsMid!.M).toBeCloseTo(expectedM, 4);
    });

    it("menghitung Z-Score dasar dan menerapkan penyesuaian WHO di luar +/-3 SD", () => {
      // Z-Score pada median (y = M) harus menghasilkan Z = 0
      const medianCheck = calculateZScore("BB/U", "M", 0, 3.3464);
      expect(medianCheck.zScore).toBeCloseTo(0.0, 2);

      // Z-Score sangat tinggi (> +3 SD) memicu penyesuaian WHO
      const extremeHigh = calculateZScore("BB/U", "M", 0, 8.0);
      expect(extremeHigh.zScore).toBeGreaterThan(3.0);
      expect(extremeHigh.isOutOfRange).toBe(false);

      // Z-Score sangat rendah (< -3 SD) memicu penyesuaian WHO
      const extremeLow = calculateZScore("BB/U", "M", 0, 1.5);
      expect(extremeLow.zScore).toBeLessThan(-3.0);
      expect(extremeLow.isOutOfRange).toBe(false);
    });

    it("mengembalikan isOutOfRange = true jika x berada di luar rentang tabel referensi", () => {
      // BB/PB hanya mencakup 45 s.d. 110 cm
      const outBelow = calculateZScore("BB/PB", "M", 40.0, 5.0);
      expect(outBelow.isOutOfRange).toBe(true);
      expect(outBelow.zScore).toBeNull();

      const outAbove = calculateZScore("BB/PB", "M", 125.0, 15.0);
      expect(outAbove.isOutOfRange).toBe(true);
      expect(outAbove.zScore).toBeNull();
    });
  });

  // ==========================================================================
  // F1-14: Pemilihan Indikator & Koreksi Cara Ukur 0,7 cm
  // ==========================================================================
  describe("F1-14: Pemilihan Indikator & Koreksi 0,7 cm (indicator.ts)", () => {
    it("memilih PB/U dan BB/PB untuk usia < 24 bulan, dan TB/U serta BB/TB untuk usia >= 24 bulan", () => {
      const under24 = determineIndicators(23);
      expect(under24.lengthHeightIndicator).toBe("PB/U");
      expect(under24.weightLengthHeightIndicator).toBe("BB/PB");
      expect(under24.standardMethod).toBe("berbaring");

      const at24 = determineIndicators(24);
      expect(at24.lengthHeightIndicator).toBe("TB/U");
      expect(at24.weightLengthHeightIndicator).toBe("BB/TB");
      expect(at24.standardMethod).toBe("berdiri");
    });

    it("menerapkan koreksi cara ukur 0,7 cm dua arah secara konsisten", () => {
      // Usia < 24 bulan diukur berdiri -> tambah +0.7 cm
      const corr1 = applyMeasurementMethodCorrection("berdiri", 12, 75.0);
      expect(corr1.correctionCm).toBe(0.7);
      expect(corr1.correctedPbTbCm).toBe(75.7);

      // Usia < 24 bulan diukur berbaring (sesuai standar) -> 0 cm
      const corr2 = applyMeasurementMethodCorrection("berbaring", 12, 75.0);
      expect(corr2.correctionCm).toBe(0);
      expect(corr2.correctedPbTbCm).toBe(75.0);

      // Usia >= 24 bulan diukur berbaring -> kurangi -0.7 cm
      const corr3 = applyMeasurementMethodCorrection("berbaring", 30, 90.0);
      expect(corr3.correctionCm).toBe(-0.7);
      expect(corr3.correctedPbTbCm).toBe(89.3);

      // Usia >= 24 bulan diukur berdiri (sesuai standar) -> 0 cm
      const corr4 = applyMeasurementMethodCorrection("berdiri", 30, 90.0);
      expect(corr4.correctionCm).toBe(0);
      expect(corr4.correctedPbTbCm).toBe(90.0);
    });

    it("menghitung IMT dengan rumus BB / (TB_meter)^2", () => {
      // BB = 10 kg, TB = 80 cm -> 10 / (0.8 * 0.8) = 15.625 (dibulatkan ke 15.62 atau 15.63)
      const bmi = calculateBmi(10, 80);
      expect(bmi).toBeCloseTo(15.62, 1);
    });
  });

  // ==========================================================================
  // F1-15: Penanganan Kasus Tepi & Flag Biologis Tidak Mungkin
  // ==========================================================================
  describe("F1-15: Kasus Tepi & Flag Biologis Tidak Mungkin", () => {
    it("menandai data tidak lengkap sebagai 'Tidak dapat dihitung'", () => {
      const res = buildZScoreResult("PB/U", "M", 12, null);
      expect(res.nilai_z).toBeNull();
      expect(res.klasifikasi).toBe("Tidak dapat dihitung");
      expect(res.flag_biologis_tidak_mungkin).toBe(false);
    });

    it("mendeteksi flag biologis tidak mungkin (WHO Extremes)", () => {
      // BB/U < -6 atau > +5
      expect(checkBiologicalImpossibility("BB/U", -6.1)).toBe(true);
      expect(checkBiologicalImpossibility("BB/U", 5.1)).toBe(true);
      expect(checkBiologicalImpossibility("BB/U", 2.0)).toBe(false);

      // PB/U atau TB/U < -6 atau > +6
      expect(checkBiologicalImpossibility("PB/U", -6.5)).toBe(true);
      expect(checkBiologicalImpossibility("TB/U", 6.2)).toBe(true);
      expect(checkBiologicalImpossibility("TB/U", -2.5)).toBe(false);

      // BB/PB, BB/TB, IMT/U < -5 atau > +5
      expect(checkBiologicalImpossibility("BB/PB", -5.1)).toBe(true);
      expect(checkBiologicalImpossibility("BB/TB", 5.2)).toBe(true);
      expect(checkBiologicalImpossibility("IMT/U", -5.5)).toBe(true);
      expect(checkBiologicalImpossibility("IMT/U", 3.0)).toBe(false);
    });

    it("memberikan klasifikasi 'Perlu pengukuran ulang' saat flag biologis terpicu", () => {
      const extremeLowWeight = buildZScoreResult("BB/U", "M", 0, 0.5); // Sangat mustahil
      expect(extremeLowWeight.flag_biologis_tidak_mungkin).toBe(true);
      expect(extremeLowWeight.klasifikasi).toBe("Perlu pengukuran ulang");
    });
  });

  // ==========================================================================
  // F1-16 & F1-17: Klasifikasi Status Gizi Permenkes & Skrining LiLA / LK
  // ==========================================================================
  describe("F1-16 & F1-17: Klasifikasi Status Gizi & Skrining Tambahan", () => {
    it("mengklasifikasikan seluruh ambang batas Permenkes 2/2020 dengan benar", () => {
      // BB/U
      expect(classifyZScore("BB/U", -3.5)).toBe("Berat badan sangat kurang (severely underweight)");
      expect(classifyZScore("BB/U", -2.5)).toBe("Berat badan kurang (underweight)");
      expect(classifyZScore("BB/U", 0.0)).toBe("Berat badan normal");
      expect(classifyZScore("BB/U", 1.5)).toBe("Risiko berat badan lebih");

      // PB/U & TB/U
      expect(classifyZScore("TB/U", -3.2)).toBe("Sangat pendek (severely stunted)");
      expect(classifyZScore("TB/U", -2.2)).toBe("Pendek (stunted)");
      expect(classifyZScore("TB/U", 0.5)).toBe("Normal");
      expect(classifyZScore("TB/U", 3.5)).toBe("Tinggi");

      // BB/PB, BB/TB, IMT/U
      expect(classifyZScore("BB/TB", -3.5)).toBe("Gizi buruk (severely wasted)");
      expect(classifyZScore("BB/TB", -2.5)).toBe("Gizi kurang (wasted)");
      expect(classifyZScore("BB/TB", 0.0)).toBe("Gizi baik (normal)");
      expect(classifyZScore("BB/TB", 1.5)).toBe("Berisiko gizi lebih (possible risk of overweight)");
      expect(classifyZScore("BB/TB", 2.5)).toBe("Gizi lebih (overweight)");
      expect(classifyZScore("BB/TB", 3.5)).toBe("Obesitas (obese)");

      // LK/U
      expect(classifyZScore("LK/U", -2.5)).toBe("Mikrosefali");
      expect(classifyZScore("LK/U", 0.0)).toBe("Normal");
      expect(classifyZScore("LK/U", 2.5)).toBe("Makrosefali");
    });

    it("mengklasifikasikan skrining LiLA sesuai rentang usia balita dan bayi", () => {
      // Balita 6-59 bulan
      expect(classifyLila(11.0, 12)).toBe("Gizi buruk");
      expect(classifyLila(12.0, 24)).toBe("Gizi kurang");
      expect(classifyLila(13.5, 36)).toBe("Gizi baik");

      // Bayi 1-5 bulan
      expect(classifyLila(10.5, 3)).toBe("Berisiko (rujuk)");
      expect(classifyLila(11.5, 3)).toBe("Normal");

      // Input kosong
      expect(classifyLila(null, 12)).toBeNull();
    });
  });

  // ==========================================================================
  // F1-18: Penyimpanan Versi Tabel pada Hasil ZScore
  // ==========================================================================
  describe("F1-18: Versi Tabel Z-Score", () => {
    it("menyertakan versi_tabel resmi pada setiap objek ZScoreResult", () => {
      const output = calculateAllZScores({
        birthDate: "2025-04-10",
        measureDate: "2026-10-10",
        sex: "M",
        weightKg: 10.5,
        pbTbCm: 80.0,
        measurementMethod: "berbaring",
        headCircumferenceCm: 46.5,
        armCircumferenceCm: 14.0,
      });

      expect(output.versiTabel).toBe(ZSCORE_TABLE_VERSION);
      expect(output.results["BB/U"].versi_tabel).toBe(ZSCORE_TABLE_VERSION);
      expect(output.results["PB/U"].versi_tabel).toBe(ZSCORE_TABLE_VERSION);
      expect(output.results["IMT/U"].versi_tabel).toBe(ZSCORE_TABLE_VERSION);
    });
  });

  // ==========================================================================
  // F1-19: Validasi Terhadap Fixture Permenkes No. 2 Tahun 2020 (KPI-4)
  // ==========================================================================
  describe("F1-19: Uji Fixture Permenkes (KPI-4: 100% Cocok)", () => {
    it("lolos 100% pada seluruh 672 titik uji referensi Permenkes 2/2020", () => {
      const fixtureFile = path.join(baseDir, "tests", "fixtures", "permenkes.json");
      expect(fs.existsSync(fixtureFile)).toBe(true);

      const fixtureData = JSON.parse(fs.readFileSync(fixtureFile, "utf-8"));
      expect(fixtureData.fixtures.length).toBeGreaterThanOrEqual(200);

      let totalPassed = 0;
      const failures: Array<{
        indikator: string;
        sex: string;
        x: number;
        y: number;
        expected: number;
        actual: number | null;
        diff: number;
      }> = [];

      for (const item of fixtureData.fixtures) {
        const { zScore } = calculateZScore(
          item.indikator,
          item.jenis_kelamin,
          item.x,
          item.nilai_ukur
        );

        expect(zScore).not.toBeNull();

        const diff = Math.abs((zScore ?? 0) - item.expected_z);
        if (diff <= item.toleransi) {
          totalPassed++;
        } else {
          failures.push({
            indikator: item.indikator,
            sex: item.jenis_kelamin,
            x: item.x,
            y: item.nilai_ukur,
            expected: item.expected_z,
            actual: zScore,
            diff,
          });
        }
      }

      if (failures.length > 0) {
        console.error("Titik uji Permenkes yang gagal:", failures.slice(0, 5));
      }

      // KPI-4: Target 100% lolos uji
      expect(totalPassed).toBe(fixtureData.fixtures.length);
      expect(failures.length).toBe(0);
    });
  });

  // ==========================================================================
  // F1-20: Validasi Silang BB/U dengan Garis KMS (ref_kms_line.csv)
  // ==========================================================================
  describe("F1-20: Validasi Silang Garis KMS", () => {
    it("memvalidasi garis merah ≈ -2 SD dan garis oranye ≈ +1 SD pada grafik 0-2 dan 2-5", () => {
      const kmsPath = path.join(baseDir, "ref", "ref_kms_line.csv");
      expect(fs.existsSync(kmsPath)).toBe(true);

      const kmsRows = fs
        .readFileSync(kmsPath, "utf-8")
        .replace(/\r/g, "")
        .trim()
        .split("\n")
        .slice(1);

      let pointsTested = 0;

      for (const row of kmsRows) {
        const parts = row.split(",");
        if (parts.length < 5) continue;
        const [sex = "", chart = "", ageStr = "0", redKgStr = "0", orangeKgStr = "0"] = parts;
        const ageMonth = parseInt(ageStr, 10);
        const redKg = parseFloat(redKgStr);
        const orangeKg = parseFloat(orangeKgStr);

        // Aturan PRD: usia <= 24 bulan memakai grafik 0-2, usia >= 25 bulan memakai grafik 2-5
        if (ageMonth <= 24 && chart !== "0-2") continue;
        if (ageMonth >= 25 && chart !== "2-5") continue;

        const resRed = calculateZScore("BB/U", sex as "M" | "F", ageMonth, redKg);
        const resOrange = calculateZScore("BB/U", sex as "M" | "F", ageMonth, orangeKg);

        expect(resRed.zScore).not.toBeNull();
        expect(resOrange.zScore).not.toBeNull();

        // Garis merah Buku KIA berada di sekitar -2 SD (toleransi +/- 0.3 SD untuk diskritisasi grafik KMS)
        expect(Math.abs(resRed.zScore! - -2.0)).toBeLessThan(0.3);

        // Garis oranye Buku KIA berada di sekitar +1 SD
        expect(Math.abs(resOrange.zScore! - 1.0)).toBeLessThan(0.3);

        pointsTested++;
      }

      expect(pointsTested).toBe(122); // 61 bulan x 2 jenis kelamin
    });
  });
});
