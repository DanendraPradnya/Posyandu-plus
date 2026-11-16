/**
 * Layanan Job Ekstraksi KIA (F2-11, F2-12, & F2-15).
 * Mengatur pembuatan job idempoten, orkestrasi worker AI + validasi plausibilitas + deteksi duplikat,
 * serta pembacaan status job untuk polling klien.
 */

import type { ExtractionJob } from "../types";
import {
  extractKiaFromImage,
  type ExtractKiaDeps,
  type ExtractKiaResult,
} from "../ai/extract-kia";
import { getCurrentYearMonthUtc } from "../ai/cost-tracker";
import {
  annotateDuplicateRows,
  validateAndAnnotateExtractedOutput,
} from "./validation";
import { ExtractionServiceError, type ExtractionRepository } from "./types";

export interface CreateUploadJobInput {
  childId: string;
  fotoRef: string;
  idempotencyKey: string;
}

export interface CreateUploadJobResult {
  job: ExtractionJob;
  created: boolean;
}

/**
 * Membuat rekaman `extraction_jobs` berstatus `diunggah` dengan dukungan idempotency key (F2-11).
 * Permintaan ulang dengan `idempotency_key` yang sama mengembalikan job sebelumnya tanpa duplikasi.
 */
export async function createUploadExtractionJob(
  input: CreateUploadJobInput,
  deps: { repo: ExtractionRepository }
): Promise<CreateUploadJobResult> {
  const childId = input.childId.trim();
  const fotoRef = input.fotoRef.trim();
  const idempotencyKey = input.idempotencyKey.trim();

  if (!childId || !fotoRef || !idempotencyKey) {
    throw new ExtractionServiceError(
      "child_id, foto_ref, dan idempotency_key wajib diisi.",
      { statusCode: 400, code: "INVALID_UPLOAD_INPUT" }
    );
  }

  const child = await deps.repo.getChildById(childId);
  if (!child) {
    throw new ExtractionServiceError(
      "Data balita tidak ditemukan atau berada di luar wilayah Posyandu Anda.",
      { statusCode: 404, code: "CHILD_NOT_FOUND" }
    );
  }

  const existing = await deps.repo.findJobByIdempotencyKey(idempotencyKey);
  if (existing) {
    if (existing.child_id !== childId) {
      throw new ExtractionServiceError(
        "idempotency_key sudah digunakan untuk data balita lain.",
        { statusCode: 409, code: "IDEMPOTENCY_CONFLICT" }
      );
    }
    return { job: existing, created: false };
  }

  try {
    const job = await deps.repo.createExtractionJob({
      child_id: childId,
      foto_ref: fotoRef,
      idempotency_key: idempotencyKey,
      status: "diunggah",
    });
    return { job, created: true };
  } catch (err: unknown) {
    // Tangani kondisi race condition apabila request paralel memasukkan idempotency_key yang sama
    const raceExisting = await deps.repo.findJobByIdempotencyKey(idempotencyKey);
    if (raceExisting && raceExisting.child_id === childId) {
      return { job: raceExisting, created: false };
    }
    throw err;
  }
}

export interface ProcessExtractionJobInput {
  jobId: string;
  userId?: string;
  imageUrl?: string;
  referenceDate?: string;
}

export interface ProcessExtractionJobResult {
  job: ExtractionJob;
  fallbackToManual: boolean;
  extractionResult?: ExtractKiaResult;
}

/**
 * Memproses satu job ekstraksi KIA secara asinkron (F2-12):
 * `diunggah` -> `diproses` -> `siap_verifikasi` | `ditolak_validasi` | `gagal`.
 */
export async function processExtractionJob(
  input: ProcessExtractionJobInput,
  deps: {
    repo: ExtractionRepository;
    extractKiaDeps?: ExtractKiaDeps;
    extractor?: (
      extractInput: Parameters<typeof extractKiaFromImage>[0],
      extractDeps?: ExtractKiaDeps
    ) => Promise<ExtractKiaResult>;
  }
): Promise<ProcessExtractionJobResult> {
  const job = await deps.repo.findJobById(input.jobId);
  if (!job) {
    throw new ExtractionServiceError("Job ekstraksi tidak ditemukan.", {
      statusCode: 404,
      code: "JOB_NOT_FOUND",
    });
  }

  // Jika job sudah berada pada status terminal siap verifikasi / disimpan / ditolak, jangan ulangi panggilan LLM
  if (
    job.status === "siap_verifikasi" ||
    job.status === "disimpan" ||
    job.status === "ditolak_validasi"
  ) {
    return {
      job,
      fallbackToManual: false,
    };
  }

  // 1. Transisi status ke `diproses`
  await deps.repo.updateExtractionJob(job.id, {
    status: "diproses",
    pesan_galat: null,
  });

  // 2. Resolusi URL gambar (signed URL Storage atau data URI yang dikirim)
  const resolvedImageUrl =
    input.imageUrl ??
    (deps.repo.getSignedPhotoUrl
      ? await deps.repo.getSignedPhotoUrl(job.foto_ref, 300)
      : null);

  if (!resolvedImageUrl) {
    const failedJob = await deps.repo.updateExtractionJob(job.id, {
      status: "gagal",
      pesan_galat:
        "Foto KIA tidak dapat diakses dari Storage. Silakan ulangi foto atau gunakan input manual.",
    });
    return {
      job: failedJob,
      fallbackToManual: true,
    };
  }

  const child = await deps.repo.getChildById(job.child_id);
  const currentSpend =
    deps.extractKiaDeps?.currentMonthlySpendUsd ??
    (deps.repo.getMonthlyLlmSpendUsd
      ? await deps.repo.getMonthlyLlmSpendUsd(getCurrentYearMonthUtc())
      : undefined);

  const runExtract = deps.extractor ?? extractKiaFromImage;
  const extractResult = await runExtract(
    {
      imageUrl: resolvedImageUrl,
      userId: input.userId,
      extractionJobId: job.id,
      referenceDate: input.referenceDate,
    },
    {
      ...deps.extractKiaDeps,
      ...(currentSpend !== undefined ? { currentMonthlySpendUsd: currentSpend } : {}),
    }
  );

  // 3. Jika panggilan AI gagal atau anggaran habis, arahkan ke mode manual (`gagal`)
  if (!extractResult.ok) {
    const failedJob = await deps.repo.updateExtractionJob(job.id, {
      status: "gagal",
      pesan_galat: extractResult.errorMessage,
    });
    return {
      job: failedJob,
      fallbackToManual: true,
      extractionResult: extractResult,
    };
  }

  // 4. Validasi plausibilitas (F2-13) & deteksi duplikat tanggal ukur (F2-14)
  const existingDates = await deps.repo.getExistingMeasurementDates(
    job.child_id
  );
  const validation = validateAndAnnotateExtractedOutput(extractResult.data, {
    existingMeasureDates: existingDates,
    childBirthDate: child?.tgl_lahir,
    referenceDate: input.referenceDate,
  });

  if (!validation.isValid) {
    const rejectedJob = await deps.repo.updateExtractionJob(job.id, {
      status: "ditolak_validasi",
      hasil_ekstraksi: validation.annotatedOutput,
      pesan_galat:
        validation.summaryMessage ??
        "Hasil ekstraksi mengandung nilai di luar rentang biologis yang wajar.",
    });
    return {
      job: rejectedJob,
      fallbackToManual: false,
      extractionResult: extractResult,
    };
  }

  // 5. Lolos validasi -> `siap_verifikasi`
  const readyJob = await deps.repo.updateExtractionJob(job.id, {
    status: "siap_verifikasi",
    hasil_ekstraksi: validation.annotatedOutput,
    pesan_galat: null,
  });

  return {
    job: readyJob,
    fallbackToManual: false,
    extractionResult: extractResult,
  };
}

/**
 * Mengambil status terkini `extraction_jobs` beserta pembaruan penanda duplikat (F2-15).
 */
export async function getExtractionJobStatus(
  jobId: string,
  deps: { repo: ExtractionRepository }
): Promise<ExtractionJob> {
  const job = await deps.repo.findJobById(jobId);
  if (!job) {
    throw new ExtractionServiceError("Job ekstraksi tidak ditemukan.", {
      statusCode: 404,
      code: "JOB_NOT_FOUND",
    });
  }

  if (job.hasil_ekstraksi && job.hasil_ekstraksi.baris_kunjungan.length > 0) {
    const existingDates = await deps.repo.getExistingMeasurementDates(
      job.child_id
    );
    return {
      ...job,
      hasil_ekstraksi: {
        ...job.hasil_ekstraksi,
        baris_kunjungan: annotateDuplicateRows(
          job.hasil_ekstraksi.baris_kunjungan,
          existingDates
        ),
      },
    };
  }

  return job;
}

