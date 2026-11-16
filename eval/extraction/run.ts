/**
 * Skrip Evaluasi Akurasi Ekstraksi KIA pada Golden Set (Fase 2 - F2-08..F2-10)
 * Mengukur KPI-3 (>= 95% field cetak/jelas, >= 85% tulisan tangan),
 * KPI-1 (median <= 5s, P90 <= 8s), dan dampak kompresi foto <= 1 MB (penurunan <= 2 poin).
 */

import {
  buildSyntheticGoldenSet,
  createSyntheticBaselinePredictions,
} from "./golden-set";
import { evaluateGoldenSet } from "./evaluator";

function runCliEvaluation() {
  const goldenSet = buildSyntheticGoldenSet(60); // 120 halaman (40 cetak, 80 tulisan tangan)
  const baselinePredictions = createSyntheticBaselinePredictions(goldenSet);
  const report = evaluateGoldenSet(goldenSet, baselinePredictions);

  console.log("=== Laporan Evaluasi Golden Set Ekstraksi KIA (Posyandu+) ===");
  console.log(`Total Sampel Uji          : ${report.totalSamples} halaman`);
  console.log(
    `Akurasi Cetak (KPI-3)     : ${report.printed.accuracyPct}% (${report.printed.matchedFields}/${report.printed.totalFields} field) [Target >= 95%]`
  );
  console.log(
    `Akurasi Tulisan Tangan    : ${report.handwritten.accuracyPct}% (${report.handwritten.matchedFields}/${report.handwritten.totalFields} field) [Target >= 85%]`
  );
  console.log(
    `Akurasi Keseluruhan       : ${report.overallAccuracyPct}%`
  );
  console.log(
    `Dampak Kompresi <= 1 MB   : ${report.compressionAccuracyDropPts} poin (Asli ${report.originalPhotos.accuracyPct}% vs Kompresi ${report.compressedPhotos.accuracyPct}%) [Target <= 2.0 poin]`
  );
  console.log(
    `Latensi Median (KPI-1)    : ${report.latencyMedianMs} ms [Target <= 5000 ms]`
  );
  console.log(
    `Latensi P90 (KPI-1)       : ${report.latencyP90Ms} ms [Target <= 8000 ms]`
  );
  console.log("\nRingkasan Per-Field:");
  for (const row of report.fieldBreakdown) {
    console.log(
      `  - ${row.field.padEnd(14, " ")}: ${row.accuracyPct}% (${row.matched}/${row.total})`
    );
  }
  console.log(
    `\nStatus Seluruh Gerbang KPI: ${report.kpiChecks.allPassed ? "PASS" : "FAIL"}`
  );

  if (!report.kpiChecks.allPassed) {
    process.exitCode = 1;
  }
}

runCliEvaluation();
