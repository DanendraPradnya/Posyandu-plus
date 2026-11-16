import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  EXTRACTION_SCHEMA_VERSION,
  KIA_EXTRACTION_JSON_SCHEMA,
  OPENAI_KIA_RESPONSE_FORMAT,
  kiaExtractionOutputSchema,
} from "../lib/ai/extraction-schema";

describe("Verifikasi Gerbang Fase 0 (Data Referensi & Kontrak)", () => {
  const baseDir = path.resolve(__dirname, "..");

  it("F0-02: .env.example mengonfigurasi OpenAI Full (Vision & Text) tanpa variabel Gemini usang", () => {
    const envExamplePath = path.join(baseDir, ".env.example");
    expect(fs.existsSync(envExamplePath)).toBe(true);
    const content = fs.readFileSync(envExamplePath, "utf-8");

    expect(content).toContain("OPENAI_API_KEY=");
    expect(content).toContain("OPENAI_VISION_MODEL=");
    expect(content).toContain("OPENAI_VISION_FALLBACK_MODEL=");
    expect(content).toContain("OPENAI_TEXT_MODEL=");

    expect(content).not.toContain("GEMINI_API_KEY");
    expect(content).not.toContain("GEMINI_VISION_MODEL");
    expect(content).not.toContain("GEMINI_TEXT_MODEL");
  });

  it("F0-03: ref_lms.csv tersedia dan memuat seluruh indikator wajib", () => {
    const lmsPath = path.join(baseDir, "ref", "ref_lms.csv");
    expect(fs.existsSync(lmsPath)).toBe(true);
    const content = fs.readFileSync(lmsPath, "utf-8").replace(/\r/g, "").trim().split("\n");
    expect(content[0]).toBe("indikator,jenis_kelamin,x,L,M,S");
    expect(content.length).toBeGreaterThan(700);
  });

  it("F0-04: ref_kbm.csv tersedia sesuai tabel KBM Buku KIA", () => {
    const kbmPath = path.join(baseDir, "ref", "ref_kbm.csv");
    expect(fs.existsSync(kbmPath)).toBe(true);
    const content = fs.readFileSync(kbmPath, "utf-8").replace(/\r/g, "").trim().split("\n");
    expect(content.length).toBe(23); // 1 header + 11 rentang x 2 jenis kelamin
  });

  it("F0-05: ref_kms_line.csv tersedia untuk usia 0-60 bulan (L & P)", () => {
    const kmsPath = path.join(baseDir, "ref", "ref_kms_line.csv");
    expect(fs.existsSync(kmsPath)).toBe(true);
    const content = fs.readFileSync(kmsPath, "utf-8").replace(/\r/g, "").trim().split("\n");
    expect(content.length).toBe(123); // 1 header + 61 bulan x 2 jenis kelamin
  });

  it("F0-06: tests/fixtures/permenkes.json memuat >= 200 titik uji referensi", () => {
    const fixturePath = path.join(baseDir, "tests", "fixtures", "permenkes.json");
    expect(fs.existsSync(fixturePath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
    expect(data.jumlah_titik).toBeGreaterThanOrEqual(200);
    expect(Array.isArray(data.fixtures)).toBe(true);
    expect(data.fixtures.length).toBeGreaterThanOrEqual(200);
  });

  it("F0-07: Skema JSON ekstraksi KIA v1.0 memvalidasi contoh keluaran dan patuh pada OpenAI Structured Outputs (strict: true)", () => {
    const sample = {
      schema_version: EXTRACTION_SCHEMA_VERSION,
      halaman_terdeteksi: "tabel_pertumbuhan",
      baris_kunjungan: [
        {
          baris_index: 1,
          tgl_ukur: { value: "2026-10-12", confidence: 0.96 },
          bb_kg: { value: 7.8, confidence: 0.94 },
          pb_tb_cm: { value: 72.5, confidence: 0.88 },
          cara_ukur: { value: "berbaring", confidence: 0.95 },
          lk_cm: { value: 45.0, confidence: 0.91 },
          lila_cm: { value: 13.0, confidence: 0.89 },
          imunisasi: { value: "Campak", confidence: 0.86 },
          asi_eksklusif: { value: true, confidence: 0.98 },
        },
      ],
      catatan_ekstraksi: null,
    };
    const parsed = kiaExtractionOutputSchema.safeParse(sample);
    expect(parsed.success).toBe(true);

    // Verifikasi kepatuhan OpenAI Structured Outputs (strict: true)
    expect(OPENAI_KIA_RESPONSE_FORMAT.type).toBe("json_schema");
    expect(OPENAI_KIA_RESPONSE_FORMAT.json_schema.strict).toBe(true);
    expect(KIA_EXTRACTION_JSON_SCHEMA.additionalProperties).toBe(false);

    const rootProps = Object.keys(KIA_EXTRACTION_JSON_SCHEMA.properties);
    for (const key of rootProps) {
      expect(KIA_EXTRACTION_JSON_SCHEMA.required).toContain(key);
    }

    const rowItemSchema = KIA_EXTRACTION_JSON_SCHEMA.properties.baris_kunjungan.items;
    expect(rowItemSchema.additionalProperties).toBe(false);

    const rowProps = Object.keys(rowItemSchema.properties);
    for (const key of rowProps) {
      expect(rowItemSchema.required).toContain(key);
      const fieldObj = rowItemSchema.properties[key as keyof typeof rowItemSchema.properties];
      if (fieldObj.type === "object") {
        expect(fieldObj.additionalProperties).toBe(false);
        expect(fieldObj.required).toEqual(["value", "confidence"]);
      }
    }
  });
});
