/**
 * Skema Validasi & Structured Output Ekstraksi Buku KIA (F0-07)
 * Mengacu pada FR4 PRD Posyandu+ v2.2 (hal. 127 Tabel Pemantauan Pertumbuhan & hal. 128 LiLA).
 * Versi Skema: 1.0 (Dikunci pada Fase 0)
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
  catatan_ekstraksi: z.string().optional(),
});

/**
 * JSON Schema untuk parameter `responseSchema` / `response_format` pada Gemini Flash Vision / OpenAI Vision.
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
          },
          bb_kg: {
            type: "object",
            properties: {
              value: { type: ["number", "null"], description: "Berat badan dalam kg" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
          },
          pb_tb_cm: {
            type: "object",
            properties: {
              value: { type: ["number", "null"], description: "Panjang/tinggi badan dalam cm" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
          },
          cara_ukur: {
            type: "object",
            properties: {
              value: { type: ["string", "null"], enum: ["berbaring", "berdiri", null] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
          },
          lk_cm: {
            type: "object",
            properties: {
              value: { type: ["number", "null"], description: "Lingkar kepala dalam cm" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
          },
          lila_cm: {
            type: "object",
            properties: {
              value: { type: ["number", "null"], description: "Lingkar lengan atas dalam cm" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
          },
          imunisasi: {
            type: "object",
            properties: {
              value: { type: ["string", "null"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
          },
          asi_eksklusif: {
            type: "object",
            properties: {
              value: { type: ["boolean", "null"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["value", "confidence"],
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
      },
    },
    catatan_ekstraksi: { type: "string" },
  },
  required: ["schema_version", "halaman_terdeteksi", "baris_kunjungan"],
} as const;
