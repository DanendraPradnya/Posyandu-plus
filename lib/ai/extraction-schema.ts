/**
 * Skema Validasi & OpenAI Structured Outputs Ekstraksi Buku KIA (F0-07)
 * Mengacu pada FR4 PRD Posyandu+ v2.2 (hal. 127 Tabel Pemantauan Pertumbuhan & hal. 128 LiLA).
 * Versi Skema: 1.0 (Dikunci pada Fase 0, kompatibel penuh dengan OpenAI strict: true)
 */

import { z } from "zod";

export const EXTRACTION_SCHEMA_VERSION = "1.0" as const;

/**
 * Ambang batas validasi plausibilitas (FR4) & ambang keyakinan rendah untuk penyorotan UI.
 */
export const PLAUSIBILITY_LIMITS = {
  BB_KG_MIN: 1.0,
  BB_KG_MAX: 30.0,
  PB_TB_CM_MIN: 40.0,
  PB_TB_CM_MAX: 130.0,
  LK_CM_MIN: 25.0,
  LK_CM_MAX: 60.0,
  LILA_CM_MIN: 6.0,
  LILA_CM_MAX: 25.0,
  LOW_CONFIDENCE_THRESHOLD: 0.85,
} as const;

export function fieldWithConfidenceSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema.nullable(),
    confidence: z.number().min(0).max(1),
  });
}

export const extractedVisitRowSchema = z.object({
  baris_index: z.number().int().min(0),
  tgl_ukur: fieldWithConfidenceSchema(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
  ),
  bb_kg: fieldWithConfidenceSchema(z.number()),
  pb_tb_cm: fieldWithConfidenceSchema(z.number()),
  cara_ukur: fieldWithConfidenceSchema(z.enum(["berbaring", "berdiri"])),
  lk_cm: fieldWithConfidenceSchema(z.number()),
  lila_cm: fieldWithConfidenceSchema(z.number()),
  imunisasi: fieldWithConfidenceSchema(z.string()),
  asi_eksklusif: fieldWithConfidenceSchema(z.boolean()),
});

export const kiaExtractionOutputSchema = z.object({
  schema_version: z.literal(EXTRACTION_SCHEMA_VERSION),
  halaman_terdeteksi: z.enum([
    "tabel_pertumbuhan",
    "catatan_lila",
    "gabungan",
    "tidak_dikenali",
  ]),
  baris_kunjungan: z.array(extractedVisitRowSchema),
  catatan_ekstraksi: z.string().nullable().optional(),
});

/**
 * JSON Schema untuk parameter `response_format` / `text.format` pada OpenAI Vision API
 * dengan mode Structured Outputs (`strict: true`, `additionalProperties: false`,
 * dan seluruh properti tercantum di dalam `required`).
 */
export const KIA_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    schema_version: { type: "string", enum: ["1.0"] },
    halaman_terdeteksi: {
      type: "string",
      enum: ["tabel_pertumbuhan", "catatan_lila", "gabungan", "tidak_dikenali"],
    },
    baris_kunjungan: {
      type: "array",
      items: {
        type: "object",
        properties: {
          baris_index: { type: "integer" },
          tgl_ukur: {
            type: "object",
            properties: {
              value: { type: ["string", "null"], description: "Tanggal YYYY-MM-DD" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
            additionalProperties: false,
          },
          bb_kg: {
            type: "object",
            properties: {
              value: { type: ["number", "null"], description: "Berat badan dalam kg" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
            additionalProperties: false,
          },
          pb_tb_cm: {
            type: "object",
            properties: {
              value: { type: ["number", "null"], description: "Panjang/tinggi badan dalam cm" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
            additionalProperties: false,
          },
          cara_ukur: {
            type: "object",
            properties: {
              value: { type: ["string", "null"], enum: ["berbaring", "berdiri", null] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
            additionalProperties: false,
          },
          lk_cm: {
            type: "object",
            properties: {
              value: { type: ["number", "null"], description: "Lingkar kepala dalam cm" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
            additionalProperties: false,
          },
          lila_cm: {
            type: "object",
            properties: {
              value: { type: ["number", "null"], description: "Lingkar lengan atas dalam cm" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
            additionalProperties: false,
          },
          imunisasi: {
            type: "object",
            properties: {
              value: { type: ["string", "null"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
            additionalProperties: false,
          },
          asi_eksklusif: {
            type: "object",
            properties: {
              value: { type: ["boolean", "null"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
            additionalProperties: false,
          },
        },
        required: [
          "baris_index",
          "tgl_ukur",
          "bb_kg",
          "pb_tb_cm",
          "cara_ukur",
          "lk_cm",
          "lila_cm",
          "imunisasi",
          "asi_eksklusif",
        ],
        additionalProperties: false,
      },
    },
    catatan_ekstraksi: {
      type: ["string", "null"],
      description: "Catatan tambahan dari hasil ekstraksi halaman KIA, atau null jika tidak ada",
    },
  },
  required: [
    "schema_version",
    "halaman_terdeteksi",
    "baris_kunjungan",
    "catatan_ekstraksi",
  ],
  additionalProperties: false,
} as const;

/**
 * Konfigurasi siap pakai untuk parameter `response_format` OpenAI Chat Completions API.
 */
export const OPENAI_KIA_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "kia_extraction",
    description: "Hasil ekstraksi terstruktur halaman pemantauan pertumbuhan dan LiLA Buku KIA",
    strict: true,
    schema: KIA_EXTRACTION_JSON_SCHEMA,
  },
} as const;
