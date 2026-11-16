import { randomUUID } from "node:crypto";
import type {
  Child,
  ExtractionJob,
  ExtractionJobStatus,
  Measurement,
} from "../types";
import type { ExtractionLogPayload } from "../ai/extraction-logger";
import type {
  ExtractionJobUpdatePatch,
  ExtractionRepository,
  NewMeasurementRecord,
} from "./types";

export class InMemoryExtractionRepository implements ExtractionRepository {
  readonly children = new Map<string, Child>();
  readonly jobs = new Map<string, ExtractionJob>();
  readonly measurements: Measurement[] = [];
  readonly extractionLogs: ExtractionLogPayload[] = [];
  readonly signedUrls = new Map<string, string>();
  monthlySpendUsd = 0;

  seedChild(child: Child): void {
    this.children.set(child.id, child);
  }

  seedMeasurement(measurement: Measurement): void {
    this.measurements.push(measurement);
  }

  async getChildById(childId: string): Promise<Child | null> {
    return this.children.get(childId) ?? null;
  }

  async getExistingMeasurementDates(childId: string): Promise<string[]> {
    return this.measurements
      .filter((m) => m.child_id === childId)
      .map((m) => m.tgl_ukur);
  }

  async findJobByIdempotencyKey(
    idempotencyKey: string
  ): Promise<ExtractionJob | null> {
    for (const job of this.jobs.values()) {
      if (job.idempotency_key === idempotencyKey) {
        return job;
      }
    }
    return null;
  }

  async findJobById(jobId: string): Promise<ExtractionJob | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async createExtractionJob(input: {
    child_id: string;
    foto_ref: string;
    idempotency_key: string;
    status: ExtractionJobStatus;
  }): Promise<ExtractionJob> {
    const existing = await this.findJobByIdempotencyKey(input.idempotency_key);
    if (existing) {
      throw new Error(
        `duplicate key value violates unique constraint "extraction_jobs_idempotency_key_key"`
      );
    }

    const job: ExtractionJob = {
      id: randomUUID(),
      child_id: input.child_id,
      foto_ref: input.foto_ref,
      status: input.status,
      idempotency_key: input.idempotency_key,
      hasil_ekstraksi: null,
      pesan_galat: null,
      dibuat_pada: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async updateExtractionJob(
    jobId: string,
    patch: ExtractionJobUpdatePatch
  ): Promise<ExtractionJob> {
    const existing = this.jobs.get(jobId);
    if (!existing) {
      throw new Error(`ExtractionJob tidak ditemukan: ${jobId}`);
    }
    const updated: ExtractionJob = {
      ...existing,
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.hasil_ekstraksi !== undefined
        ? { hasil_ekstraksi: patch.hasil_ekstraksi }
        : {}),
      ...(patch.pesan_galat !== undefined
        ? { pesan_galat: patch.pesan_galat }
        : {}),
    };
    this.jobs.set(jobId, updated);
    return updated;
  }

  async insertMeasurements(
    rows: NewMeasurementRecord[]
  ): Promise<Measurement[]> {
    const created: Measurement[] = [];
    for (const row of rows) {
      const duplicate = this.measurements.some(
        (m) => m.child_id === row.child_id && m.tgl_ukur === row.tgl_ukur
      );
      if (duplicate) {
        throw new Error(
          `duplicate key value violates unique constraint "uq_measurements_child_date"`
        );
      }
      const record: Measurement = {
        id: randomUUID(),
        ...row,
      };
      this.measurements.push(record);
      created.push(record);
    }
    return created;
  }

  async insertExtractionLog(payload: ExtractionLogPayload): Promise<void> {
    this.extractionLogs.push(payload);
  }

  async getMonthlyLlmSpendUsd(): Promise<number> {
    return this.monthlySpendUsd;
  }

  async getSignedPhotoUrl(fotoRef: string): Promise<string | null> {
    return this.signedUrls.get(fotoRef) ?? `https://storage.local/${fotoRef}`;
  }
}

