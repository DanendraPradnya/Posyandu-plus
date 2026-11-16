import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Child, ExtractedVisitRow, Measurement } from "../lib/types";
import type { ExtractKiaResult } from "../lib/ai/extract-kia";
import { EXTRACTION_SCHEMA_VERSION } from "../lib/ai/extraction-schema";
import { calibrateExtractionOutput } from "../lib/ai/confidence";
import {
  ExtractionServiceError,
  InMemoryExtractionRepository,
  confirmExtractionAndSaveMeasurements,
  createUploadExtractionJob,
  getExtractionJobStatus,
  processExtractionJob,
  saveManualMeasurement,
  validateMeasurementPlausibility,
} from "../lib/extraction";

const ROOT = path.resolve(__dirname, "..");

function makeSampleChild(overrides: Partial<Child> = {}): Child {
  return {
    id: "child-001",
    nama: "Putu Gede Pratama",
    tgl_lahir: "2025-05-10",
    jenis_kelamin: "M",
    nama_ortu: "Ni Made Sari",
    posyandu_id: "pos-melati-1",
    banjar: "Banjar Kaja",
    consent_at: "2026-01-10T08:00:00.000Z",
    created_at: "2026-01-10T08:00:00.000Z",
    ...overrides,
  };
}

function makeExistingMeasurement(
  overrides: Partial<Measurement> = {}
): Measurement {
  return {
    id: "meas-existing-1",
    child_id: "child-001",
    tgl_ukur: "2026-08-10",
    usia_bulan: 15,
    bb_kg: 9.8,
    pb_tb_cm: 77.5,
    cara_ukur: "berbaring",
    lk_cm: 46.2,
    lila_cm: 13.8,
    imunisasi: null,
    asi_eksklusif: null,
    sumber: "manual",
    verified_by: "kader-1",
    verified_at: "2026-08-10T09:00:00.000Z",
    foto_ref: null,
    ...overrides,
  };
}

function makeSuccessfulExtractResult(params?: {
  tglUkur?: string;
  bbKg?: number;
  pbTbCm?: number;
  lilaCm?: number;
  extraDuplicateRowDate?: string;
}): ExtractKiaResult {
  const rows: ExtractedVisitRow[] = [
    {
      baris_index: 1,
      tgl_ukur: { value: params?.tglUkur ?? "2026-09-10", confidence: 0.96 },
      bb_kg: { value: params?.bbKg ?? 10.1, confidence: 0.91 },
      pb_tb_cm: { value: params?.pbTbCm ?? 78.4, confidence: 0.89 },
      cara_ukur: { value: "berbaring", confidence: 0.94 },
      lk_cm: { value: 46.5, confidence: 0.9 },
      lila_cm: { value: params?.lilaCm ?? 14.0, confidence: 0.88 },
      imunisasi: { value: "MR", confidence: 0.86 },
      asi_eksklusif: { value: null, confidence: 0.95 },
    },
  ];

  if (params?.extraDuplicateRowDate) {
    rows.push({
      baris_index: 2,
      tgl_ukur: { value: params.extraDuplicateRowDate, confidence: 0.97 },
      bb_kg: { value: 9.8, confidence: 0.95 },
      pb_tb_cm: { value: 77.5, confidence: 0.92 },
      cara_ukur: { value: "berbaring" as const, confidence: 0.95 },
      lk_cm: { value: 46.2, confidence: 0.91 },
      lila_cm: { value: 13.8, confidence: 0.9 },
      imunisasi: { value: null, confidence: 0.95 },
      asi_eksklusif: { value: null, confidence: 0.95 },
    });
  }

  const calibrated = calibrateExtractionOutput(
    {
      schema_version: EXTRACTION_SCHEMA_VERSION,
      halaman_terdeteksi: "tabel_pertumbuhan",
      baris_kunjungan: rows,
      catatan_ekstraksi: null,
    },
    { referenceDate: "2026-10-15" }
  );

  return {
    ok: true,
    status: "siap_verifikasi",
    fallbackToManual: false,
    usedFallbackModel: false,
    modelUsed: "gpt-4o-mini",
    promptVersion: "kia-extraction-v1.0",
    data: calibrated,
    latencyMs: 1250,
    estimatedCostUsd: 0.0012,
    budgetWarning: false,
    attempts: [
      {
        model: "gpt-4o-mini",
        attemptNumber: 1,
        success: true,
        latencyMs: 1250,
        estimatedCostUsd: 0.0012,
      },
    ],
  };
}

describe("Fase 2.2 - Backend Ekstraksi KIA, Validasi, & Penyimpanan Terverifikasi (F2-11 s.d. F2-17)", () => {
  it("seluruh modul Fase 2.2 tersedia dan bebas dari karakter em dash", () => {
    const requiredFiles = [
      "lib/extraction/types.ts",
      "lib/extraction/validation.ts",
      "lib/extraction/in-memory-repository.ts",
      "lib/extraction/supabase-repository.ts",
      "lib/extraction/job-service.ts",
      "lib/extraction/save-measurements.ts",
      "lib/extraction/inngest-functions.ts",
      "lib/extraction/index.ts",
      "app/api/inngest/route.ts",
      "app/api/extractions/upload/route.ts",
      "app/api/extractions/[jobId]/route.ts",
      "app/api/extractions/[jobId]/confirm/route.ts",
      "app/api/measurements/manual/route.ts",
    ];

    for (const rel of requiredFiles) {
      const fullPath = path.join(ROOT, rel);
      expect(fs.existsSync(fullPath), `Berkas wajib belum ada: ${rel}`).toBe(
        true
      );
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(
        content.includes("\u2014"),
        `Ditemukan karakter em dash pada berkas: ${rel}`
      ).toBe(false);
    }
  });

  describe("F2-11: Pembuatan Job Unggah Foto & Idempotency Key", () => {
    it("membuat job berstatus diunggah dan mengembalikan job yang sama saat idempotency_key dikirim ulang", async () => {
      const repo = new InMemoryExtractionRepository();
      repo.seedChild(makeSampleChild());

      const first = await createUploadExtractionJob(
        {
          childId: "child-001",
          fotoRef: "child-001/photo-1.jpg",
          idempotencyKey: "idem-key-001",
        },
        { repo }
      );

      expect(first.created).toBe(true);
      expect(first.job.status).toBe("diunggah");
      expect(repo.jobs.size).toBe(1);

      const second = await createUploadExtractionJob(
        {
          childId: "child-001",
          fotoRef: "child-001/photo-1.jpg",
          idempotencyKey: "idem-key-001",
        },
        { repo }
      );

      expect(second.created).toBe(false);
      expect(second.job.id).toBe(first.job.id);
      expect(repo.jobs.size).toBe(1);
    });

    it("menolak idempotency_key yang sama jika dipakai untuk balita berbeda", async () => {
      const repo = new InMemoryExtractionRepository();
      repo.seedChild(makeSampleChild({ id: "child-001" }));
      repo.seedChild(makeSampleChild({ id: "child-002" }));

      await createUploadExtractionJob(
        {
          childId: "child-001",
          fotoRef: "child-001/photo.jpg",
          idempotencyKey: "shared-key",
        },
        { repo }
      );

      await expect(
        createUploadExtractionJob(
          {
            childId: "child-002",
            fotoRef: "child-002/photo.jpg",
            idempotencyKey: "shared-key",
          },
          { repo }
        )
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe("F2-12, F2-13, F2-14, & F2-15: Siklus Status Job, Plausibilitas, & Deteksi Duplikat", () => {
    it("memproses job dari diunggah -> diproses -> siap_verifikasi tanpa menyimpan ke measurements", async () => {
      const repo = new InMemoryExtractionRepository();
      repo.seedChild(makeSampleChild());
      repo.seedMeasurement(makeExistingMeasurement({ tgl_ukur: "2026-08-10" }));

      const observedStatuses: string[] = [];
      const originalUpdate = repo.updateExtractionJob.bind(repo);
      repo.updateExtractionJob = async (jobId, patch) => {
        if (patch.status) observedStatuses.push(patch.status);
        return originalUpdate(jobId, patch);
      };

      const { job } = await createUploadExtractionJob(
        {
          childId: "child-001",
          fotoRef: "child-001/kia.jpg",
          idempotencyKey: "idem-job-ok",
        },
        { repo }
      );

      const processed = await processExtractionJob(
        {
          jobId: job.id,
          userId: "kader-1",
          referenceDate: "2026-10-15",
        },
        {
          repo,
          extractor: async () =>
            makeSuccessfulExtractResult({
              tglUkur: "2026-09-10",
              extraDuplicateRowDate: "2026-08-10",
            }),
        }
      );

      expect(observedStatuses).toEqual(["diproses", "siap_verifikasi"]);
      expect(processed.fallbackToManual).toBe(false);
      expect(processed.job.status).toBe("siap_verifikasi");

      // F2-14: baris tanggal 2026-08-10 ditandai is_duplicate = true, baris baru = false
      const polled = await getExtractionJobStatus(job.id, { repo });
      expect(polled.hasil_ekstraksi?.baris_kunjungan[0]?.is_duplicate).toBe(
        false
      );
      expect(polled.hasil_ekstraksi?.baris_kunjungan[1]?.is_duplicate).toBe(
        true
      );

      // Human-in-the-loop: tidak ada baris baru yang masuk measurements sebelum konfirmasi
      expect(repo.measurements.length).toBe(1);
    });

    it("menandai job sebagai ditolak_validasi beserta alasan per field bila nilai di luar rentang plausibilitas (F2-13)", async () => {
      const repo = new InMemoryExtractionRepository();
      repo.seedChild(makeSampleChild());

      const { job } = await createUploadExtractionJob(
        {
          childId: "child-001",
          fotoRef: "child-001/implausible.jpg",
          idempotencyKey: "idem-implausible",
        },
        { repo }
      );

      const processed = await processExtractionJob(
        {
          jobId: job.id,
          userId: "kader-1",
          referenceDate: "2026-10-15",
        },
        {
          repo,
          extractor: async () =>
            makeSuccessfulExtractResult({
              tglUkur: "2026-12-20", // masa depan
              bbKg: 45, // di luar 1-30 kg
              pbTbCm: 20, // di luar 40-130 cm
            }),
        }
      );

      expect(processed.job.status).toBe("ditolak_validasi");
      expect(processed.job.pesan_galat).toContain("masa depan");
      expect(processed.job.pesan_galat).toContain("Berat badan");
      expect(processed.job.pesan_galat).toContain("Panjang/tinggi badan");
      const warnings =
        processed.job.hasil_ekstraksi?.baris_kunjungan[0]
          ?.plausibility_warnings ?? [];
      expect(warnings.length).toBeGreaterThanOrEqual(3);
    });

    it("mengubah status job menjadi gagal dan mengarahkan ke mode manual saat AI gagal (F2-12)", async () => {
      const repo = new InMemoryExtractionRepository();
      repo.seedChild(makeSampleChild());

      const { job } = await createUploadExtractionJob(
        {
          childId: "child-001",
          fotoRef: "child-001/fail.jpg",
          idempotencyKey: "idem-ai-fail",
        },
        { repo }
      );

      const processed = await processExtractionJob(
        { jobId: job.id, userId: "kader-1" },
        {
          repo,
          extractor: async () => ({
            ok: false,
            status: "gagal",
            fallbackToManual: true,
            budgetExceeded: true,
            rateLimited: false,
            modelUsed: null,
            promptVersion: "kia-extraction-v1.0",
            errorMessage: "Batas anggaran bulanan LLM tercapai.",
            latencyMs: 10,
            estimatedCostUsd: 0,
            attempts: [],
          }),
        }
      );

      expect(processed.job.status).toBe("gagal");
      expect(processed.fallbackToManual).toBe(true);
      expect(processed.job.pesan_galat).toContain("anggaran");
    });
  });

  describe("F2-16 & F2-17: Simpan Verifikasi Kader (KPI-6) & Input Manual", () => {
    it("menyimpan baris terpilih dengan sumber AI dan mencatat field yang dikoreksi ke extraction_logs", async () => {
      const repo = new InMemoryExtractionRepository();
      repo.seedChild(makeSampleChild({ tgl_lahir: "2025-05-10" }));
      repo.seedMeasurement(makeExistingMeasurement({ tgl_ukur: "2026-08-10" }));

      const { job } = await createUploadExtractionJob(
        {
          childId: "child-001",
          fotoRef: "child-001/kia-confirm.jpg",
          idempotencyKey: "idem-confirm-1",
        },
        { repo }
      );

      await processExtractionJob(
        {
          jobId: job.id,
          userId: "kader-1",
          referenceDate: "2026-10-15",
        },
        {
          repo,
          extractor: async () =>
            makeSuccessfulExtractResult({
              tglUkur: "2026-09-10",
              bbKg: 10.1,
              pbTbCm: 78.4,
              extraDuplicateRowDate: "2026-08-10",
            }),
        }
      );

      // Kader hanya memilih baris 1 dan mengoreksi bb_kg (10.1 -> 10.3) serta pb_tb_cm (78.4 -> 78.8)
      const savedResult = await confirmExtractionAndSaveMeasurements(
        {
          jobId: job.id,
          verifiedBy: "kader-1",
          referenceDate: "2026-10-15",
          rows: [
            {
              baris_index: 1,
              tgl_ukur: "2026-09-10",
              bb_kg: 10.3,
              pb_tb_cm: 78.8,
              cara_ukur: "berbaring",
              lk_cm: 46.5,
              lila_cm: 14.0,
              imunisasi: "MR",
              asi_eksklusif: null,
            },
          ],
        },
        { repo }
      );

      expect(savedResult.measurements.length).toBe(1);
      const saved = savedResult.measurements[0]!;
      expect(saved.sumber).toBe("AI");
      expect(saved.verified_by).toBe("kader-1");
      expect(saved.foto_ref).toBe("child-001/kia-confirm.jpg");
      expect(saved.usia_bulan).toBe(16);

      // Verifikasi pencatatan KPI-6 field_dikoreksi
      const diff = savedResult.correctedFieldsByRow[0]?.field_dikoreksi;
      expect(diff).toEqual({
        bb_kg: { before: 10.1, after: 10.3 },
        pb_tb_cm: { before: 78.4, after: 78.8 },
      });
      expect(repo.extractionLogs.length).toBe(1);
      expect(repo.extractionLogs[0]?.field_dikoreksi).toEqual(diff);

      // Job berstatus disimpan; konfirmasi kedua harus ditolak (409)
      const jobAfter = await repo.findJobById(job.id);
      expect(jobAfter?.status).toBe("disimpan");

      await expect(
        confirmExtractionAndSaveMeasurements(
          {
            jobId: job.id,
            verifiedBy: "kader-1",
            rows: [
              {
                tgl_ukur: "2026-10-10",
                bb_kg: 10.5,
              },
            ],
          },
          { repo }
        )
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("menolak konfirmasi jika baris masih melanggar batas plausibilitas atau tanggal duplikat", async () => {
      const repo = new InMemoryExtractionRepository();
      repo.seedChild(makeSampleChild());
      repo.seedMeasurement(makeExistingMeasurement({ tgl_ukur: "2026-08-10" }));

      const { job } = await createUploadExtractionJob(
        {
          childId: "child-001",
          fotoRef: "child-001/kia-bad.jpg",
          idempotencyKey: "idem-confirm-bad",
        },
        { repo }
      );

      await processExtractionJob(
        { jobId: job.id, referenceDate: "2026-10-15" },
        {
          repo,
          extractor: async () =>
            makeSuccessfulExtractResult({ tglUkur: "2026-09-10" }),
        }
      );

      await expect(
        confirmExtractionAndSaveMeasurements(
          {
            jobId: job.id,
            verifiedBy: "kader-1",
            referenceDate: "2026-10-15",
            rows: [{ tgl_ukur: "2026-09-10", bb_kg: 0.4 }], // bb_kg < 1.0
          },
          { repo }
        )
      ).rejects.toBeInstanceOf(ExtractionServiceError);

      await expect(
        confirmExtractionAndSaveMeasurements(
          {
            jobId: job.id,
            verifiedBy: "kader-1",
            referenceDate: "2026-10-15",
            rows: [{ tgl_ukur: "2026-08-10", bb_kg: 9.8 }], // duplikat
          },
          { repo }
        )
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(repo.measurements.length).toBe(1);
    });

    it("menyimpan pengukuran input manual tanpa foto dan menolak data tidak valid/duplikat (F2-17)", async () => {
      const repo = new InMemoryExtractionRepository();
      repo.seedChild(makeSampleChild({ tgl_lahir: "2025-05-10" }));

      const saved = await saveManualMeasurement(
        {
          childId: "child-001",
          verifiedBy: "kader-1",
          referenceDate: "2026-10-15",
          measurement: {
            tgl_ukur: "2026-09-10",
            bb_kg: 10.2,
            pb_tb_cm: 78.0,
            cara_ukur: "berbaring",
            lk_cm: 46.5,
            lila_cm: 14.1,
            imunisasi: "Campak",
            asi_eksklusif: false,
          },
        },
        { repo }
      );

      expect(saved.sumber).toBe("manual");
      expect(saved.foto_ref).toBeNull();
      expect(saved.verified_by).toBe("kader-1");
      expect(saved.usia_bulan).toBe(16);

      // Duplikat tanggal ukur pada input manual harus ditolak (409)
      await expect(
        saveManualMeasurement(
          {
            childId: "child-001",
            verifiedBy: "kader-1",
            referenceDate: "2026-10-15",
            measurement: {
              tgl_ukur: "2026-09-10",
              bb_kg: 10.3,
            },
          },
          { repo }
        )
      ).rejects.toMatchObject({ statusCode: 409 });

      // Plausibilitas gagal harus ditolak (422)
      await expect(
        saveManualMeasurement(
          {
            childId: "child-001",
            verifiedBy: "kader-1",
            referenceDate: "2026-10-15",
            measurement: {
              tgl_ukur: "2026-10-10",
              bb_kg: 35,
            },
          },
          { repo }
        )
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it("validateMeasurementPlausibility menolak tanggal kalender palsu dan usia >= 60 bulan", () => {
      const badCalendar = validateMeasurementPlausibility(
        { tgl_ukur: "2026-02-30", bb_kg: 8.5 },
        { childBirthDate: "2025-01-01", referenceDate: "2026-10-15" }
      );
      expect(badCalendar.isValid).toBe(false);
      expect(badCalendar.fieldErrors.tgl_ukur).toBeDefined();

      const tooOld = validateMeasurementPlausibility(
        { tgl_ukur: "2026-10-10", bb_kg: 16.0 },
        { childBirthDate: "2020-01-01", referenceDate: "2026-10-15" }
      );
      expect(tooOld.isValid).toBe(false);
      expect(tooOld.fieldErrors.tgl_ukur).toContain("59 bulan");
    });
  });
});
