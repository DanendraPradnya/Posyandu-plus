/**
 * Modul Aturan Growth Faltering & Risk Alert R1-R8 + Profil Kesehatan (Fase 3 - B6 & B7)
 * Menggunakan perhitungan deterministik (bukan LLM) sesuai FR6 & FR6A PRD Posyandu+ v2.2.
 */

import type {
  AlertRuleCode,
  IndicatorType,
  Measurement,
  OverallHealthStatus,
  Sex,
  TriggeredRule,
  ZScoreResult,
} from "../types";
import { getAccumulativeKbmGrams, getKmsLinePoint } from "./ref-data";

export const SUPPORTED_ALERT_RULES = [
  "R1",
  "R2",
  "R3a",
  "R3b",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
] as const;

export const CRITICAL_FIXED_TEMPLATE =
  "Segera bawa anak ke Puskesmas atau rumah sakit terdekat untuk pemeriksaan dan penanganan lebih mendalam oleh tenaga kesehatan.";

const SEVERITY_RANK: Record<OverallHealthStatus, number> = {
  Normal: 0,
  Waspada: 1,
  Berisiko: 2,
  Kritis: 3,
};

export interface VisitHistoryEntry {
  measurement: Measurement;
  zscores: ZScoreResult[];
}

export interface EvaluateHealthRulesInput {
  sex: Sex;
  /** Seluruh riwayat kunjungan balita, akan diurutkan kronologis (tgl_ukur ASC). */
  history: VisitHistoryEntry[];
  /** Pengukuran target (default: kunjungan terbaru). */
  targetMeasurementId?: string;
}

export interface EvaluatedHealthProfile {
  measurementId: string;
  childId: string;
  statusKeseluruhan: OverallHealthStatus;
  statusPerIndikator: Record<IndicatorType, ZScoreResult | undefined>;
  statusLila: string | null;
  aturanTerpicu: TriggeredRule[];
  trenBb: "Naik (N)" | "Tidak Naik (T)" | "Kunjungan Pertama";
  catatanPemantauan: string | null;
}

function getZScoreByIndicator(
  zscores: ZScoreResult[],
  indicator: IndicatorType
): ZScoreResult | undefined {
  return zscores.find((z) => z.indikator === indicator);
}

/**
 * Mengembalikan indeks pita Z-Score untuk aturan R2 (penurunan >= 1 pita antar kunjungan).
 * Pita: <-3 (-4), -3..-2 (-3), -2..-1 (-2), -1..0 (-1), 0..+1 (0), +1..+2 (1), +2..+3 (2), >+3 (3)
 */
function getZScoreBand(z: number): number {
  if (z < -3) return -4;
  if (z < -2) return -3;
  if (z < -1) return -2;
  if (z < 0) return -1;
  if (z <= 1) return 0;
  if (z <= 2) return 1;
  if (z <= 3) return 2;
  return 3;
}

function isWeightGainAdequate(
  sex: Sex,
  prev: Measurement,
  curr: Measurement
): { naik: boolean; gainGram: number; requiredKbmGram: number } {
  const gainGram = Math.round((curr.bb_kg - prev.bb_kg) * 1000);
  const requiredKbmGram = getAccumulativeKbmGrams(
    sex,
    prev.usia_bulan,
    curr.usia_bulan
  );

  // Berat mendatar atau turun selalu T; atau kenaikan < KBM
  const naik = curr.bb_kg > prev.bb_kg && gainGram >= requiredKbmGram;
  return { naik, gainGram, requiredKbmGram };
}

function classifyLilaScreening(
  lilaCm: number | null,
  ageMonths: number
): string | null {
  if (lilaCm === null) return null;
  if (ageMonths < 6) {
    return lilaCm < 11.0
      ? "Berisiko (< 11,0 cm pada bayi < 6 bulan)"
      : "Normal";
  }
  if (lilaCm < 11.5) return "Gizi buruk (< 11,5 cm)";
  if (lilaCm < 12.5) return "Gizi kurang (11,5 - 12,4 cm)";
  return "Gizi baik (>= 12,5 cm)";
}

/**
 * Mengevaluasi aturan R1-R8 dan membentuk Profil Kesehatan Balita (FR6 & FR6A).
 */
export function evaluateHealthRulesAndProfile(
  input: EvaluateHealthRulesInput
): EvaluatedHealthProfile {
  const sorted = [...input.history].sort((a, b) =>
    a.measurement.tgl_ukur.localeCompare(b.measurement.tgl_ukur)
  );

  if (sorted.length === 0) {
    throw new Error("Minimal satu data pengukuran diperlukan untuk evaluasi profil kesehatan.");
  }

  const targetIdx = input.targetMeasurementId
    ? sorted.findIndex((item) => item.measurement.id === input.targetMeasurementId)
    : sorted.length - 1;

  const idx = targetIdx >= 0 ? targetIdx : sorted.length - 1;
  const currentEntry = sorted[idx]!;
  const prevEntry = idx > 0 ? sorted[idx - 1]! : null;
  const prevPrevEntry = idx > 1 ? sorted[idx - 2]! : null;

  const curr = currentEntry.measurement;
  const zList = currentEntry.zscores;

  const statusPerIndikator: Record<IndicatorType, ZScoreResult | undefined> = {
    "BB/U": getZScoreByIndicator(zList, "BB/U"),
    "PB/U": getZScoreByIndicator(zList, "PB/U"),
    "TB/U": getZScoreByIndicator(zList, "TB/U"),
    "BB/PB": getZScoreByIndicator(zList, "BB/PB"),
    "BB/TB": getZScoreByIndicator(zList, "BB/TB"),
    "IMT/U": getZScoreByIndicator(zList, "IMT/U"),
    "LK/U": getZScoreByIndicator(zList, "LK/U"),
  };

  const triggeredMap = new Map<AlertRuleCode, TriggeredRule>();
  const addRule = (rule: TriggeredRule) => {
    if (!triggeredMap.has(rule.kode)) {
      triggeredMap.set(rule.kode, rule);
    }
  };

  let trenBb: "Naik (N)" | "Tidak Naik (T)" | "Kunjungan Pertama" =
    "Kunjungan Pertama";
  let catatanPemantauan: string | null = null;

  // -------------------------------------------------------------------------
  // 1. Aturan Tren (hanya jika tersedia >= 2 pengukuran: R1 & R2)
  // -------------------------------------------------------------------------
  if (prevEntry) {
    const prev = prevEntry.measurement;
    const currGain = isWeightGainAdequate(input.sex, prev, curr);
    trenBb = currGain.naik ? "Naik (N)" : "Tidak Naik (T)";

    if (!currGain.naik) {
      if (prevPrevEntry) {
        const prevGain = isWeightGainAdequate(
          input.sex,
          prevPrevEntry.measurement,
          prev
        );
        if (!prevGain.naik) {
          addRule({
            kode: "R1",
            tingkat: "Waspada",
            alasan_awam: `Aturan R1: Berat badan anak tidak naik (T) dua kali berturut-turut (kenaikan ${currGain.gainGram} g, target minimal ${currGain.requiredKbmGram} g).`,
          });
        } else {
          catatanPemantauan = `Catatan pemantauan (R1): Berat badan tidak naik (T) 1 kali (${currGain.gainGram} g dari target ${currGain.requiredKbmGram} g).`;
        }
      } else {
        catatanPemantauan = `Catatan pemantauan (R1): Berat badan tidak naik (T) 1 kali (${currGain.gainGram} g dari target ${currGain.requiredKbmGram} g).`;
      }
    }

    // R2: Kurva BB/U turun melewati >= 1 pita Z-Score antar kunjungan
    const currBbu = statusPerIndikator["BB/U"];
    const prevBbu = getZScoreByIndicator(prevEntry.zscores, "BB/U");
    if (
      currBbu &&
      prevBbu &&
      !currBbu.flag_biologis_tidak_mungkin &&
      !prevBbu.flag_biologis_tidak_mungkin &&
      currBbu.nilai_z !== null &&
      prevBbu.nilai_z !== null
    ) {
      const bandDrop = getZScoreBand(prevBbu.nilai_z) - getZScoreBand(currBbu.nilai_z);
      if (bandDrop >= 1) {
        addRule({
          kode: "R2",
          tingkat: "Waspada",
          alasan_awam: `Aturan R2: Kurva berat badan menurut usia (BB/U) turun melewati garis pita pertumbuhan (dari ${prevBbu.nilai_z.toFixed(2)} SD menjadi ${currBbu.nilai_z.toFixed(2)} SD).`,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Aturan Garis KMS BB/U (R3a & R3b)
  // -------------------------------------------------------------------------
  const bbu = statusPerIndikator["BB/U"];
  const kmsLine = getKmsLinePoint(input.sex, curr.usia_bulan);
  if (kmsLine && (!bbu || !bbu.flag_biologis_tidak_mungkin)) {
    if (curr.bb_kg < kmsLine.redLineKg) {
      addRule({
        kode: "R3a",
        tingkat: "Berisiko",
        alasan_awam: `Aturan R3a: Berat badan anak (${curr.bb_kg} kg) berada di bawah garis merah KMS (${kmsLine.redLineKg} kg untuk usia ${curr.usia_bulan} bulan).`,
      });
    } else if (curr.bb_kg > kmsLine.orangeLineKg) {
      addRule({
        kode: "R3b",
        tingkat: "Waspada",
        alasan_awam: `Aturan R3b: Berat badan anak (${curr.bb_kg} kg) berada di atas garis oranye KMS (${kmsLine.orangeLineKg} kg), menandakan risiko berat badan lebih.`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // 3. Aturan Z-Score Antropometri (R4, R5, R7, R8)
  // -------------------------------------------------------------------------
  const lenHeightZ = statusPerIndikator["TB/U"] ?? statusPerIndikator["PB/U"];
  const weightHeightZ =
    statusPerIndikator["BB/TB"] ?? statusPerIndikator["BB/PB"];
  const imtZ = statusPerIndikator["IMT/U"];

  // R5: Z-Score < -3 SD pada indikator apa pun (yang valid secara biologis)
  const coreIndicators: ZScoreResult[] = [
    bbu,
    lenHeightZ,
    weightHeightZ,
    imtZ,
  ].filter((z): z is ZScoreResult => Boolean(z));

  const criticalZ = coreIndicators.find(
    (z) =>
      !z.flag_biologis_tidak_mungkin && z.nilai_z !== null && z.nilai_z < -3
  );

  if (criticalZ && criticalZ.nilai_z !== null) {
    addRule({
      kode: "R5",
      tingkat: "Kritis",
      alasan_awam: `Aturan R5: Ditemukan kondisi sangat kurus/sangat pendek/berat sangat kurang pada ${criticalZ.indikator} (${criticalZ.nilai_z.toFixed(2)} SD, di bawah -3 SD). ${CRITICAL_FIXED_TEMPLATE}`,
    });
  }

  // R4: TB/U (atau PB/U) < -2 SD atau BB/TB (atau BB/PB) < -2 SD
  const isStunted =
    lenHeightZ &&
    !lenHeightZ.flag_biologis_tidak_mungkin &&
    lenHeightZ.nilai_z !== null &&
    lenHeightZ.nilai_z < -2;
  const isWasted =
    weightHeightZ &&
    !weightHeightZ.flag_biologis_tidak_mungkin &&
    weightHeightZ.nilai_z !== null &&
    weightHeightZ.nilai_z < -2;

  if (isStunted || isWasted) {
    const parts: string[] = [];
    if (isStunted && lenHeightZ?.nilai_z !== null) {
      parts.push(
        `${lenHeightZ.indikator} ${lenHeightZ.nilai_z.toFixed(2)} SD (${lenHeightZ.klasifikasi})`
      );
    }
    if (isWasted && weightHeightZ?.nilai_z !== null) {
      parts.push(
        `${weightHeightZ.indikator} ${weightHeightZ.nilai_z.toFixed(2)} SD (${weightHeightZ.klasifikasi})`
      );
    }
    addRule({
      kode: "R4",
      tingkat: "Berisiko",
      alasan_awam: `Aturan R4: Indikator pertumbuhan di bawah -2 SD (${parts.join(", ")}).`,
    });
  }

  // R7 & R8: Kelebihan gizi (BB/PB-TB atau IMT/U)
  const overNutritionCandidates = [weightHeightZ, imtZ].filter(
    (z): z is ZScoreResult =>
      Boolean(z && !z.flag_biologis_tidak_mungkin && z.nilai_z !== null)
  );

  const hasR7 = overNutritionCandidates.find((z) => (z.nilai_z ?? 0) > 2);
  const hasR8 = overNutritionCandidates.find(
    (z) => (z.nilai_z ?? 0) > 1 && (z.nilai_z ?? 0) <= 2
  );

  if (hasR7 && hasR7.nilai_z !== null) {
    addRule({
      kode: "R7",
      tingkat: "Berisiko",
      alasan_awam: `Aturan R7: ${hasR7.indikator} berada di atas +2 SD (${hasR7.nilai_z.toFixed(2)} SD), menunjukkan gizi lebih / obesitas.`,
    });
  } else if (hasR8 && hasR8.nilai_z !== null) {
    addRule({
      kode: "R8",
      tingkat: "Waspada",
      alasan_awam: `Aturan R8: ${hasR8.indikator} berada di antara +1 sampai +2 SD (${hasR8.nilai_z.toFixed(2)} SD), berisiko gizi lebih.`,
    });
  }

  // -------------------------------------------------------------------------
  // 4. Aturan Skrining LiLA (R5 & R6)
  // -------------------------------------------------------------------------
  const statusLila = classifyLilaScreening(curr.lila_cm, curr.usia_bulan);
  if (curr.lila_cm !== null) {
    if (curr.usia_bulan >= 6 && curr.lila_cm < 11.5) {
      addRule({
        kode: "R5",
        tingkat: "Kritis",
        alasan_awam: `Aturan R5: Lingkar Lengan Atas (LiLA) ${curr.lila_cm} cm (< 11,5 cm pada usia 6-59 bulan). ${CRITICAL_FIXED_TEMPLATE}`,
      });
    } else if (curr.usia_bulan >= 6 && curr.lila_cm < 12.5) {
      addRule({
        kode: "R6",
        tingkat: "Berisiko",
        alasan_awam: `Aturan R6: LiLA ${curr.lila_cm} cm (11,5 - 12,4 cm), menunjukkan gizi kurang. Rujuk ke fasilitas kesehatan untuk pemeriksaan.`,
      });
    } else if (curr.usia_bulan < 6 && curr.lila_cm < 11.0) {
      addRule({
        kode: "R6",
        tingkat: "Berisiko",
        alasan_awam: `Aturan R6: LiLA ${curr.lila_cm} cm (< 11,0 cm pada bayi < 6 bulan). Segera rujuk ke fasilitas kesehatan untuk pemeriksaan.`,
      });
    }
  }

  const aturanTerpicu = Array.from(triggeredMap.values());

  let statusKeseluruhan: OverallHealthStatus = "Normal";
  for (const rule of aturanTerpicu) {
    if (SEVERITY_RANK[rule.tingkat] > SEVERITY_RANK[statusKeseluruhan]) {
      statusKeseluruhan = rule.tingkat;
    }
  }

  return {
    measurementId: curr.id,
    childId: curr.child_id,
    statusKeseluruhan,
    statusPerIndikator,
    statusLila,
    aturanTerpicu,
    trenBb,
    catatanPemantauan,
  };
}
