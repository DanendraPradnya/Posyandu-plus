/**
 * Penyimpanan Hasil Verifikasi Kader & Input Manual Pengukuran (F2-16 & F2-17).
 * Menjamin data AI tidak pernah menjadi rekam medis final tanpa konfirmasi manusia,
 * serta mencatat field yang dikoreksi ke `extraction_logs` untuk KPI-6.
 */

import type { ExtractedVisitRow, Measurement } from "../types";
import { diffCorrectedFields } from "../ai/extraction-logger";
import { EXTRACTION_PROMPT_VERSION } from "../ai/prompts";
import { calculateAgeInMonths } from "../zscore/age";
import { validateMeasurementPlausibility } from "./validation";
import {
  ExtractionServiceError,
  type ConfirmedExtractionRowInput,
  type ExtractionRepository,
  type MeasurementInputRow,
  type NewMeasurementRecord,
} from "./types";

export interface ConfirmExtractionInput {
  jobId: string;
  verifiedBy: string;
  rows: ConfirmedExtractionRowInput[];
  referenceDate?: string;
}

export interface ConfirmExtractionResult {
  measurements: Measurement[];
  correctedFieldsByRow: Array<{
    baris_index: number | null;
    measurement_id: string;
    field_dikoreksi: Record<string, { before: unknown; after: unknown }>;
  }>;
}

/**
 * Mengonfirmasi dan menyimpan baris pengukuran hasil verifikasi Kader ke `measurements` (F2-16).
 * Mencatat daftar field yang dikoreksi Kader ke `extraction_logs.field_dikoreksi` (KPI-6).
 */
export async function confirmExtractionAndSaveMeasurements(
  input: ConfirmExtractionInput,
  deps: { repo: ExtractionRepository }
): Promise<ConfirmExtractionResult> {
  if (!input.rows || input.rows.length === 0) {
    throw new ExtractionServiceError(
      "Minimal satu baris kunjungan harus dipilih untuk disimpan.",
      { statusCode: 400, code: "NO_ROWS_SELECTED" }
    );
  }

  const job = await deps.repo.findJobById(input.jobId);
  if (!job) {
    throw new ExtractionServiceError("Job ekstraksi tidak ditemukan.", {
      statusCode: 404,
      code: "JOB_NOT_FOUND",
    });
  }

  if (job.status === "disimpan") {
    throw new ExtractionServiceError(
      "Job ekstraksi ini sudah pernah dikonfirmasi dan disimpan sebelumnya.",
      { statusCode: 409, code: "JOB_ALREADY_SAVED" }
    );
  }

  if (job.status === "diunggah" || job.status === "diproses") {
    throw new ExtractionServiceError(
      "Proses ekstraksi masih berjalan. Tunggu hingga siap diverifikasi.",
      { statusCode: 409, code: "JOB_NOT_READY" }
    );
  }

  if (job.status === "gagal") {
    throw new ExtractionServiceError(
      "Job ekstraksi gagal diproses. Silakan gunakan jalur input manual.",
      { statusCode: 409, code: "JOB_FAILED_USE_MANUAL" }
    );
  }

  const child = await deps.repo.getChildById(job.child_id);
  if (!child) {
    throw new ExtractionServiceError("Data balita tidak ditemukan.", {
      statusCode: 404,
      code: "CHILD_NOT_FOUND",
    });
  }

  const existingDates = new Set(
    await deps.repo.getExistingMeasurementDates(job.child_id)
  );
  const batchDates = new Set<string>();

  const validationErrors: Array<{
    index: number;
    fieldErrors: Record<string, string>;
  }> = [];
  const duplicateDates: string[] = [];
  const nowIso = new Date().toISOString();
  const recordsToInsert: NewMeasurementRecord[] = [];

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    if (!row) continue;

    const plausibility = validateMeasurementPlausibility(row, {
      childBirthDate: child.tgl_lahir,
      referenceDate: input.referenceDate,
    });

    if (!plausibility.isValid) {
      validationErrors.push({
        index: i,
        fieldErrors: plausibility.fieldErrors,
      });
      continue;
    }

    if (existingDates.has(row.tgl_ukur) || batchDates.has(row.tgl_ukur)) {
      duplicateDates.push(row.tgl_ukur);
      continue;
    }
    batchDates.add(row.tgl_ukur);

    const usiaBulan =
      plausibility.ageMonths ??
      calculateAgeInMonths(child.tgl_lahir, row.tgl_ukur);

    recordsToInsert.push({
      child_id: child.id,
      tgl_ukur: row.tgl_ukur,
      usia_bulan: usiaBulan,
      bb_kg: row.bb_kg,
      pb_tb_cm: row.pb_tb_cm ?? null,
      cara_ukur: row.cara_ukur ?? null,
      lk_cm: row.lk_cm ?? null,
      lila_cm: row.lila_cm ?? null,
      imunisasi: row.imunisasi?.trim() ? row.imunisasi.trim() : null,
      asi_eksklusif: row.asi_eksklusif ?? null,
      sumber: "AI",
      verified_by: input.verifiedBy,
      verified_at: nowIso,
      foto_ref: job.foto_ref,
    });
  }

  if (validationErrors.length > 0) {
    throw new ExtractionServiceError(
      "Terdapat nilai pengukuran yang tidak valid atau di luar batas plausibilitas.",
      {
        statusCode: 422,
        code: "VALIDATION_FAILED",
        details: { validationErrors },
      }
    );
  }

  if (duplicateDates.length > 0) {
    throw new ExtractionServiceError(
      `Tanggal ukur sudah tercatat sebelumnya: ${duplicateDates.join(", ")}.`,
      {
        statusCode: 409,
        code: "DUPLICATE_MEASUREMENT_DATE",
        details: { duplicateDates },
      }
    );
  }

  const savedMeasurements = await deps.repo.insertMeasurements(recordsToInsert);

  // Hitung koreksi field per baris untuk KPI-6 dan catat ke extraction_logs
  const aiRows = job.hasil_ekstraksi?.baris_kunjungan ?? [];
  const correctedFieldsByRow: ConfirmExtractionResult["correctedFieldsByRow"] =
    [];

  for (let i = 0; i < savedMeasurements.length; i++) {
    const saved = savedMeasurements[i];
    const submitted = input.rows[i];
    if (!saved || !submitted) continue;

    let matchedAiRow: ExtractedVisitRow | undefined;
    if (submitted.baris_index !== undefined) {
      matchedAiRow = aiRows.find(
        (r) => r.baris_index === submitted.baris_index
      );
    } else if (aiRows[i]) {
      matchedAiRow = aiRows[i];
    }

    const diffs = matchedAiRow
      ? diffCorrectedFields(matchedAiRow, {
          tgl_ukur: saved.tgl_ukur,
          bb_kg: saved.bb_kg,
          pb_tb_cm: saved.pb_tb_cm,
          cara_ukur: saved.cara_ukur,
          lk_cm: saved.lk_cm,
          lila_cm: saved.lila_cm,
          imunisasi: saved.imunisasi,
          asi_eksklusif: saved.asi_eksklusif,
        })
      : {};

    correctedFieldsByRow.push({
      baris_index: matchedAiRow?.baris_index ?? submitted.baris_index ?? null,
      measurement_id: saved.id,
      field_dikoreksi: diffs,
    });

    await deps.repo.insertExtractionLog({
      extraction_job_id: job.id,
      measurement_id: saved.id,
      model: "human-verification",
      versi_prompt: EXTRACTION_PROMPT_VERSION,
      field_dikoreksi: Object.keys(diffs).length > 0 ? diffs : null,
      latensi_ms: 0,
      estimasi_biaya_usd: 0,
    });
  }

  await deps.repo.updateExtractionJob(job.id, {
    status: "disimpan",
    verified_at: nowIso,
  });

  return {
    measurements: savedMeasurements,
    correctedFieldsByRow,
  };
}

export interface SaveManualMeasurementInput {
  childId: string;
  verifiedBy: string;
  measurement: MeasurementInputRow;
  referenceDate?: string;
}

/**
 * Menyimpan pengukuran input manual tanpa foto menggunakan validasi plausibilitas
 * dan deteksi duplikat yang sama dengan alur AI (F2-17).
 */
export async function saveManualMeasurement(
  input: SaveManualMeasurementInput,
  deps: { repo: ExtractionRepository }
): Promise<Measurement> {
  const child = await deps.repo.getChildById(input.childId);
  if (!child) {
    throw new ExtractionServiceError(
      "Data balita tidak ditemukan atau berada di luar wilayah Posyandu Anda.",
      { statusCode: 404, code: "CHILD_NOT_FOUND" }
    );
  }

  const plausibility = validateMeasurementPlausibility(input.measurement, {
    childBirthDate: child.tgl_lahir,
    referenceDate: input.referenceDate,
  });

  if (!plausibility.isValid) {
    throw new ExtractionServiceError(
      "Data pengukuran manual tidak valid atau berada di luar batas plausibilitas.",
      {
        statusCode: 422,
        code: "VALIDATION_FAILED",
        details: { fieldErrors: plausibility.fieldErrors },
      }
    );
  }

  const existingDates = await deps.repo.getExistingMeasurementDates(child.id);
  if (existingDates.includes(input.measurement.tgl_ukur)) {
    throw new ExtractionServiceError(
      `Pengukuran pada tanggal ${input.measurement.tgl_ukur} sudah tercatat untuk balita ini.`,
      {
        statusCode: 409,
        code: "DUPLICATE_MEASUREMENT_DATE",
        details: { tgl_ukur: input.measurement.tgl_ukur },
      }
    );
  }

  const usiaBulan =
    plausibility.ageMonths ??
    calculateAgeInMonths(child.tgl_lahir, input.measurement.tgl_ukur);
  const nowIso = new Date().toISOString();

  const [saved] = await deps.repo.insertMeasurements([
    {
      child_id: child.id,
      tgl_ukur: input.measurement.tgl_ukur,
      usia_bulan: usiaBulan,
      bb_kg: input.measurement.bb_kg,
      pb_tb_cm: input.measurement.pb_tb_cm ?? null,
      cara_ukur: input.measurement.cara_ukur ?? null,
      lk_cm: input.measurement.lk_cm ?? null,
      lila_cm: input.measurement.lila_cm ?? null,
      imunisasi: input.measurement.imunisasi?.trim()
        ? input.measurement.imunisasi.trim()
        : null,
      asi_eksklusif: input.measurement.asi_eksklusif ?? null,
      sumber: "manual",
      verified_by: input.verifiedBy,
      verified_at: nowIso,
      foto_ref: null,
    },
  ]);

  if (!saved) {
    throw new ExtractionServiceError("Gagal menyimpan data pengukuran manual.", {
      statusCode: 500,
      code: "INSERT_FAILED",
    });
  }

  return saved;
}

