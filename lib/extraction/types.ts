import type {
  Child,
  ExtractionJob,
  ExtractionJobStatus,
  KiaExtractionOutput,
  Measurement,
  MeasurementMethod,
} from "../types";
import type { ExtractionLogPayload } from "../ai/extraction-logger";

export interface MeasurementInputRow {
  tgl_ukur: string;
  bb_kg: number;
  pb_tb_cm?: number | null;
  cara_ukur?: MeasurementMethod | null;
  lk_cm?: number | null;
  lila_cm?: number | null;
  imunisasi?: string | null;
  asi_eksklusif?: boolean | null;
}

export interface ConfirmedExtractionRowInput extends MeasurementInputRow {
  baris_index?: number;
}

export interface NewMeasurementRecord {
  child_id: string;
  tgl_ukur: string;
  usia_bulan: number;
  bb_kg: number;
  pb_tb_cm: number | null;
  cara_ukur: MeasurementMethod | null;
  lk_cm: number | null;
  lila_cm: number | null;
  imunisasi: string | null;
  asi_eksklusif: boolean | null;
  sumber: "AI" | "manual";
  verified_by: string;
  verified_at: string;
  foto_ref: string | null;
}

export interface ExtractionJobUpdatePatch {
  status?: ExtractionJobStatus;
  hasil_ekstraksi?: KiaExtractionOutput | null;
  pesan_galat?: string | null;
  verified_at?: string | null;
}

export interface ExtractionRepository {
  getChildById(childId: string): Promise<Child | null>;
  getExistingMeasurementDates(childId: string): Promise<string[]>;
  findJobByIdempotencyKey(idempotencyKey: string): Promise<ExtractionJob | null>;
  findJobById(jobId: string): Promise<ExtractionJob | null>;
  createExtractionJob(input: {
    child_id: string;
    foto_ref: string;
    idempotency_key: string;
    status: ExtractionJobStatus;
  }): Promise<ExtractionJob>;
  updateExtractionJob(
    jobId: string,
    patch: ExtractionJobUpdatePatch
  ): Promise<ExtractionJob>;
  insertMeasurements(rows: NewMeasurementRecord[]): Promise<Measurement[]>;
  insertExtractionLog(payload: ExtractionLogPayload): Promise<void>;
  getMonthlyLlmSpendUsd?(yearMonth: string): Promise<number>;
  getSignedPhotoUrl?(
    fotoRef: string,
    expiresInSeconds?: number
  ): Promise<string | null>;
}

export class ExtractionServiceError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    options: { statusCode?: number; code?: string; details?: unknown } = {}
  ) {
    super(message);
    this.name = "ExtractionServiceError";
    this.statusCode = options.statusCode ?? 400;
    this.code = options.code ?? "EXTRACTION_ERROR";
    this.details = options.details;
  }
}

