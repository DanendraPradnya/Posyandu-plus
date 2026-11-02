import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Verifikasi Fase 1.1: Database PostgreSQL via Supabase & Keamanan (F1-01 s.d. F1-11)", () => {
  const baseDir = path.resolve(__dirname, "..");
  const migrationsDir = path.join(baseDir, "supabase", "migrations");

  // --------------------------------------------------------------------------
  // F1-01 & F1-02: Skema Tabel, Constraint, dan Indeks
  // --------------------------------------------------------------------------
  it("F1-01: File migrasi 001_initial_schema.sql mendefinisikan seluruh tabel Bab 7 PRD", () => {
    const schemaFile = path.join(migrationsDir, "001_initial_schema.sql");
    expect(fs.existsSync(schemaFile)).toBe(true);

    const sqlContent = fs.readFileSync(schemaFile, "utf-8");
    const requiredTables = [
      "ref_lms",
      "ref_kbm",
      "ref_kms_line",
      "posyandu",
      "users",
      "children",
      "measurements",
      "zscores",
      "health_profiles",
      "extraction_jobs",
      "extraction_logs",
      "alerts",
      "education",
      "share_links",
      "audit_logs",
    ];

    for (const table of requiredTables) {
      expect(sqlContent).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it("F1-02: Constraint unik dan CHECK rentang nilai terdefinisi pada skema", () => {
    const schemaFile = path.join(migrationsDir, "001_initial_schema.sql");
    const sqlContent = fs.readFileSync(schemaFile, "utf-8");

    // Unik (child_id, tgl_ukur) di measurements
    expect(sqlContent).toMatch(/uq_measurements_child_date UNIQUE \(child_id, tgl_ukur\)/);

    // Unik idempotency_key di extraction_jobs
    expect(sqlContent).toMatch(/idempotency_key TEXT NOT NULL UNIQUE/);

    // Unik (measurement_id, kode_aturan) di alerts
    expect(sqlContent).toMatch(/uq_alerts_measurement_rule UNIQUE \(measurement_id, kode_aturan\)/);

    // CHECK rentang usia 0-59 dan BB 1-30 kg di measurements
    expect(sqlContent).toMatch(/usia_bulan BETWEEN 0 AND 59/);
    expect(sqlContent).toMatch(/bb_kg BETWEEN 1.0 AND 30.0/);

    // Indeks penting terpasang
    expect(sqlContent).toContain("idx_children_posyandu_nama");
    expect(sqlContent).toContain("idx_measurements_child_date");
    expect(sqlContent).toContain("idx_alerts_child_tingkat");
    expect(sqlContent).toContain("idx_share_links_token");
  });

  // --------------------------------------------------------------------------
  // F1-05 & F1-06: Kebijakan Keamanan Row-Level Security (RLS)
  // --------------------------------------------------------------------------
  it("F1-05: File migrasi 002_rls_policies.sql mengaktifkan RLS pada seluruh tabel dan mengatur aturan hak akses", () => {
    const rlsFile = path.join(migrationsDir, "002_rls_policies.sql");
    expect(fs.existsSync(rlsFile)).toBe(true);

    const sqlContent = fs.readFileSync(rlsFile, "utf-8");

    // RLS aktif pada tabel anak dan rekam medis
    expect(sqlContent).toContain("ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;");
    expect(sqlContent).toContain("ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;");
    expect(sqlContent).toContain("ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;");

    // Helper functions RLS
    expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.current_user_role()");
    expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.current_user_is_active()");
    expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.current_user_posyandu()");

    // Isolasi Kader per posyandu
    expect(sqlContent).toContain("children_kader_select");
    expect(sqlContent).toContain("posyandu_id = public.current_user_posyandu()");

    // Bidan akses seluruh wilayah
    expect(sqlContent).toContain("children_bidan_all");

    // Audit logs hanya bisa dibaca Bidan dan append-only
    expect(sqlContent).toContain("audit_logs_select_bidan");
    expect(sqlContent).not.toContain("CREATE POLICY \"audit_logs_update");
    expect(sqlContent).not.toContain("CREATE POLICY \"audit_logs_delete");
  });

  // --------------------------------------------------------------------------
  // F1-07: Pemicu Audit Perubahan oleh Bidan
  // --------------------------------------------------------------------------
  it("F1-07: File migrasi 003_audit_triggers.sql menerapkan pemicu audit dan mewajibkan alasan pada perubahan Bidan", () => {
    const auditFile = path.join(migrationsDir, "003_audit_triggers.sql");
    expect(fs.existsSync(auditFile)).toBe(true);

    const sqlContent = fs.readFileSync(auditFile, "utf-8");

    // Fungsi audit dan trigger
    expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.audit_bidan_changes()");
    expect(sqlContent).toContain("Koreksi data rekam medis oleh Bidan wajib menyertakan alasan");
    expect(sqlContent).toContain("trg_audit_measurements");
    expect(sqlContent).toContain("trg_audit_children");
    expect(sqlContent).toContain("trg_audit_education");
  });

  // --------------------------------------------------------------------------
  // F1-08: Endpoint Manajemen Akun Kader
  // --------------------------------------------------------------------------
  it("F1-08: Endpoint API /api/admin/kader terimplementasi dengan proteksi peran Bidan dan penanganan audit", () => {
    const endpointFile = path.join(baseDir, "app", "api", "admin", "kader", "route.ts");
    expect(fs.existsSync(endpointFile)).toBe(true);

    const content = fs.readFileSync(endpointFile, "utf-8");
    expect(content).toContain("session.profile.peran !== \"bidan\"");
    expect(content).toContain("action === \"create\"");
    expect(content).toContain("action === \"toggle_status\"");
    expect(content).toContain("action === \"reassign\"");
    expect(content).toContain("audit_logs");
  });

  // --------------------------------------------------------------------------
  // F1-09: Storage Privat Foto KIA & Hapus Otomatis (30 Hari)
  // --------------------------------------------------------------------------
  it("F1-09: Migrasi storage 004_storage_setup.sql dan skrip pembersihan foto 30 hari tersedia", () => {
    const storageSql = path.join(migrationsDir, "004_storage_setup.sql");
    expect(fs.existsSync(storageSql)).toBe(true);

    const sqlContent = fs.readFileSync(storageSql, "utf-8");
    expect(sqlContent).toContain("'kia-photos'");
    expect(sqlContent).toContain("public = false");

    const cleanupFile = path.join(baseDir, "lib", "storage", "cleanup-expired-photos.ts");
    expect(fs.existsSync(cleanupFile)).toBe(true);

    const cleanupContent = fs.readFileSync(cleanupFile, "utf-8");
    expect(cleanupContent).toContain("cleanupExpiredPhotos");
    expect(cleanupContent).toContain("lte(\"verified_at\", cutoffIso)");
  });

  // --------------------------------------------------------------------------
  // F1-10 & F1-11: Endpoint Health-Check, Logger, dan Workflow Backup
  // --------------------------------------------------------------------------
  it("F1-10 & F1-11: Endpoint /api/health, logger terstruktur, dan workflow GitHub Actions tersedia", () => {
    const healthFile = path.join(baseDir, "app", "api", "health", "route.ts");
    expect(fs.existsSync(healthFile)).toBe(true);

    const loggerFile = path.join(baseDir, "lib", "logger.ts");
    expect(fs.existsSync(loggerFile)).toBe(true);

    const workflowFile = path.join(baseDir, ".github", "workflows", "db-maintenance.yml");
    expect(fs.existsSync(workflowFile)).toBe(true);

    const workflowContent = fs.readFileSync(workflowFile, "utf-8");
    expect(workflowContent).toContain("pg_dump");
    expect(workflowContent).toContain("retention-days: 7");
  });
});

