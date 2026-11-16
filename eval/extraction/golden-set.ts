/**
 * Generator & Manifest Golden Set Sintetis Buku KIA (F2-06 & F2-07)
 * Menghasilkan minimal 120 kasus halaman KIA sintetis lengkap dengan label kebenaran
 * (ground truth) yang valid terhadap skema F0-07, variasi penulis, pencahayaan,
 * serta pasangan citra asli vs terkompresi <= 1 MB.
 */

import type { KiaExtractionOutput, MeasurementMethod } from "../../lib/types";
import { EXTRACTION_SCHEMA_VERSION } from "../../lib/ai/extraction-schema";

export type SampleInputType = "cetak" | "tulisan_tangan";
export type PhotoCondition = "terang" | "redup" | "miring";

export interface GoldenSetSample {
  sampleId: string;
  inputType: SampleInputType;
  writerId: string;
  photoCondition: PhotoCondition;
  isCompressedUnder1Mb: boolean;
  fileSizeKb: number;
  pairId: string;
  groundTruth: KiaExtractionOutput;
}

export interface GoldenSetPrediction {
  sampleId: string;
  predicted: KiaExtractionOutput;
  latencyMs: number;
}

const IMMUNIZATION_LIST = [
  "HB-0",
  "BCG, Polio 1",
  "DPT-HB-Hib 1, Polio 2",
  "DPT-HB-Hib 2, Polio 3",
  "DPT-HB-Hib 3, Polio 4",
  "Campak-Rubella",
  "Booster DPT-HB-Hib",
] as const;

const WRITER_IDS = [
  "penulis-kader-1",
  "penulis-kader-2",
  "penulis-kader-3",
  "penulis-kader-4",
  "penulis-bidan-1",
  "penulis-mahasiswa-1",
] as const;

const PHOTO_CONDITIONS: readonly PhotoCondition[] = [
  "terang",
  "redup",
  "miring",
] as const;

function buildSyntheticGroundTruth(index: number): KiaExtractionOutput {
  const baseYear = 2025 + (index % 2);
  const month1 = ((index % 9) + 1).toString().padStart(2, "0");
  const month2 = ((index % 9) + 2).toString().padStart(2, "0");
  const day = (((index * 3) % 24) + 2).toString().padStart(2, "0");

  const ageFactor = index % 18;
  const bb1 = Number((5.2 + ageFactor * 0.45).toFixed(1));
  const bb2 = Number((bb1 + 0.4).toFixed(1));
  const pb1 = Number((58.0 + ageFactor * 1.9).toFixed(1));
  const pb2 = Number((pb1 + 1.2).toFixed(1));
  const lk1 = Number((39.5 + ageFactor * 0.4).toFixed(1));
  const lk2 = Number((lk1 + 0.3).toFixed(1));
  const lila1 = Number((12.4 + (ageFactor % 7) * 0.3).toFixed(1));
  const lila2 = Number((lila1 + 0.2).toFixed(1));

  const method: MeasurementMethod = index % 3 === 0 ? "berdiri" : "berbaring";
  const imm = IMMUNIZATION_LIST[index % IMMUNIZATION_LIST.length] ?? "Campak-Rubella";
  const asi = index % 4 !== 0;

  return {
    schema_version: EXTRACTION_SCHEMA_VERSION,
    halaman_terdeteksi: index % 5 === 0 ? "gabungan" : "tabel_pertumbuhan",
    baris_kunjungan: [
      {
        baris_index: 1,
        tgl_ukur: { value: `${baseYear}-${month1}-${day}`, confidence: 0.96 },
        bb_kg: { value: bb1, confidence: 0.95 },
        pb_tb_cm: { value: pb1, confidence: 0.94 },
        cara_ukur: { value: method, confidence: 0.95 },
        lk_cm: { value: lk1, confidence: 0.93 },
        lila_cm: { value: lila1, confidence: 0.92 },
        imunisasi: { value: imm, confidence: 0.91 },
        asi_eksklusif: { value: asi, confidence: 0.97 },
      },
      {
        baris_index: 2,
        tgl_ukur: { value: `${baseYear}-${month2}-${day}`, confidence: 0.95 },
        bb_kg: { value: bb2, confidence: 0.94 },
        pb_tb_cm: { value: pb2, confidence: 0.93 },
        cara_ukur: { value: method, confidence: 0.95 },
        lk_cm: { value: lk2, confidence: 0.92 },
        lila_cm: { value: lila2, confidence: 0.91 },
        imunisasi: { value: imm, confidence: 0.9 },
        asi_eksklusif: { value: asi, confidence: 0.96 },
      },
    ],
    catatan_ekstraksi: null,
  };
}

/**
 * Menghasilkan manifest Golden Set sintetis berisi 120 halaman KIA:
 * - 40 halaman kategori cetak/angka jelas (20 asli + 20 terkompresi <= 1 MB)
 * - 80 halaman kategori tulisan tangan (40 asli + 40 terkompresi <= 1 MB)
 */
export function buildSyntheticGoldenSet(totalPairs = 60): GoldenSetSample[] {
  const safePairs = Math.max(50, totalPairs); // minimal 100 halaman (2 sampel per pasangan)
  const samples: GoldenSetSample[] = [];

  for (let i = 0; i < safePairs; i++) {
    const isPrinted = i < Math.floor(safePairs / 3);
    const inputType: SampleInputType = isPrinted ? "cetak" : "tulisan_tangan";
    const writerId = isPrinted
      ? "cetak-sistem"
      : (WRITER_IDS[i % WRITER_IDS.length] ?? "penulis-kader-1");
    const photoCondition = PHOTO_CONDITIONS[i % PHOTO_CONDITIONS.length] ?? "terang";
    const pairId = `PAIR-${String(i + 1).padStart(3, "0")}`;
    const groundTruth = buildSyntheticGroundTruth(i);

    // 1. Sampel citra resolusi asli (> 1 MB)
    samples.push({
      sampleId: `GS-${String(samples.length + 1).padStart(3, "0")}`,
      inputType,
      writerId,
      photoCondition,
      isCompressedUnder1Mb: false,
      fileSizeKb: 2450 + ((i * 73) % 900),
      pairId,
      groundTruth,
    });

    // 2. Sampel pasangan terkompresi klien (<= 1 MB) untuk uji FR3 / F2-10
    samples.push({
      sampleId: `GS-${String(samples.length + 1).padStart(3, "0")}`,
      inputType,
      writerId,
      photoCondition,
      isCompressedUnder1Mb: true,
      fileSizeKb: 420 + ((i * 37) % 480),
      pairId,
      groundTruth,
    });
  }

  return samples;
}

/**
 * Menghasilkan prediksi simulasi baseline untuk menguji skrip evaluator dan KPI secara offline.
 * Simulasi menyertakan tingkat kekeliruan realistis pada tulisan tangan redup/miring
 * namun tetap memenuhi ambang target KPI-3, KPI-1, dan selisih kompresi <= 2 poin.
 */
export function createSyntheticBaselinePredictions(
  samples: GoldenSetSample[]
): GoldenSetPrediction[] {
  return samples.map((sample, idx) => {
    const cloned: KiaExtractionOutput = JSON.parse(
      JSON.stringify(sample.groundTruth)
    ) as KiaExtractionOutput;

    const firstRow = cloned.baris_kunjungan[0];

    // Simulasi sesekali field tulisan tangan atau cetak redup terbaca kurang tepat
    if (sample.inputType === "cetak") {
      // ~98% akurasi field cetak (kesalahan sangat jarang di 1 field tiap ~7 sampel)
      if (idx % 14 === 5 && firstRow && firstRow.imunisasi.value) {
        firstRow.imunisasi.value = "Polio";
        firstRow.imunisasi.confidence = 0.72;
      }
    } else {
      // Tulisan tangan: sesekali meleset pada foto redup/miring, menjaga akurasi ~90-93%
      if (sample.photoCondition === "miring" && idx % 5 === 1 && firstRow) {
        if (firstRow.bb_kg.value !== null) {
          firstRow.bb_kg.value = Number((firstRow.bb_kg.value + 0.1).toFixed(1));
          firstRow.bb_kg.confidence = 0.76;
        }
      }
      if (sample.photoCondition === "redup" && idx % 4 === 3 && firstRow) {
        firstRow.lila_cm.value = null;
        firstRow.lila_cm.confidence = 0.55;
      }
      // Simulasi dampak kompresi kecil (<= 1% perubahan tambahan pada foto tulisan tangan)
      if (sample.isCompressedUnder1Mb && idx % 17 === 4 && firstRow) {
        firstRow.lk_cm.value = null;
        firstRow.lk_cm.confidence = 0.62;
      }
    }

    const baseLatency =
      sample.inputType === "cetak"
        ? 2350 + (idx % 7) * 180
        : 3150 + (idx % 11) * 290;
    const compressionBonus = sample.isCompressedUnder1Mb ? -320 : 280;

    return {
      sampleId: sample.sampleId,
      predicted: cloned,
      latencyMs: Math.max(950, baseLatency + compressionBonus),
    };
  });
}
