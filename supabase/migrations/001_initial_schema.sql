-- ==============================================================================
-- Migrasi 001: Skema Awal Tabel MVP Posyandu+ (F1-01 & F1-02)
-- Acuan: PRD Posyandu+ v2.2 Bab 7 & Kontrak Tipe Data code/lib/types/index.ts
-- ==============================================================================

-- Aktifkan ekstensi UUID jika belum aktif
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. TABEL REFERENSI (WHO 2006, Permenkes 2/2020, Buku KIA)
-- ------------------------------------------------------------------------------

-- Tabel LMS (WHO 2006 / Permenkes 2/2020)
CREATE TABLE IF NOT EXISTS public.ref_lms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indikator TEXT NOT NULL,
    jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('M', 'F')),
    x NUMERIC NOT NULL,
    l NUMERIC NOT NULL,
    m NUMERIC NOT NULL,
    s NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ref_lms UNIQUE (indikator, jenis_kelamin, x)
);

-- Tabel KBM (Kenaikan Berat Minimal per bulan)
CREATE TABLE IF NOT EXISTS public.ref_kbm (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('M', 'F')),
    usia_bulan_min INT NOT NULL,
    usia_bulan_max INT NOT NULL,
    kbm_gram INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ref_kbm UNIQUE (jenis_kelamin, usia_bulan_min, usia_bulan_max)
);

-- Tabel Garis KMS BB/U (Merah & Oranye)
CREATE TABLE IF NOT EXISTS public.ref_kms_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('M', 'F')),
    grafik TEXT NOT NULL CHECK (grafik IN ('0-2', '2-5')),
    usia_bulan INT NOT NULL,
    garis_merah_kg NUMERIC NOT NULL,
    garis_oranye_kg NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ref_kms_line UNIQUE (jenis_kelamin, grafik, usia_bulan)
);

-- ------------------------------------------------------------------------------
-- 2. TABEL WILAYAH & PENGGUNA (Posyandu, Users, Audit)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.posyandu (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL,
    dusun_banjar TEXT NOT NULL,
    wilayah_puskesmas TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profil pengguna publik berelasi 1-ke-1 dengan auth.users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    peran TEXT NOT NULL CHECK (peran IN ('kader', 'bidan')),
    nama TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    status_aktif BOOLEAN NOT NULL DEFAULT true,
    posyandu_ditugaskan UUID REFERENCES public.posyandu(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. TABEL DATA BALITA & PENGUKURAN ANTROPOMETRI
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL,
    tgl_lahir DATE NOT NULL,
    jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('M', 'F')),
    nik_no_kia TEXT,
    nama_ortu TEXT NOT NULL,
    kontak_ortu TEXT,
    posyandu_id UUID NOT NULL REFERENCES public.posyandu(id) ON DELETE RESTRICT,
    banjar TEXT NOT NULL,
    consent_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    tgl_ukur DATE NOT NULL,
    usia_bulan INT NOT NULL CHECK (usia_bulan BETWEEN 0 AND 59),
    bb_kg NUMERIC NOT NULL CHECK (bb_kg BETWEEN 1.0 AND 30.0),
    pb_tb_cm NUMERIC CHECK (pb_tb_cm IS NULL OR (pb_tb_cm BETWEEN 40.0 AND 130.0)),
    cara_ukur TEXT CHECK (cara_ukur IS NULL OR cara_ukur IN ('berbaring', 'berdiri')),
    lk_cm NUMERIC CHECK (lk_cm IS NULL OR (lk_cm BETWEEN 25.0 AND 60.0)),
    lila_cm NUMERIC CHECK (lila_cm IS NULL OR (lila_cm BETWEEN 5.0 AND 30.0)),
    imunisasi TEXT,
    asi_eksklusif BOOLEAN,
    sumber TEXT NOT NULL CHECK (sumber IN ('AI', 'manual')),
    verified_by UUID NOT NULL REFERENCES public.users(id),
    verified_at TIMESTAMPTZ NOT NULL,
    foto_ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- F1-02: Pencegahan pengukuran ganda pada tanggal yang sama
    CONSTRAINT uq_measurements_child_date UNIQUE (child_id, tgl_ukur)
);

CREATE TABLE IF NOT EXISTS public.zscores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measurement_id UUID NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,
    indikator TEXT NOT NULL CHECK (indikator IN ('BB/U', 'PB/U', 'TB/U', 'BB/PB', 'BB/TB', 'IMT/U', 'LK/U')),
    nilai_z NUMERIC,
    klasifikasi TEXT NOT NULL,
    flag_biologis_tidak_mungkin BOOLEAN NOT NULL DEFAULT false,
    koreksi_cara_ukur_cm NUMERIC NOT NULL DEFAULT 0,
    versi_tabel TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_zscores_measurement_indicator UNIQUE (measurement_id, indikator)
);

CREATE TABLE IF NOT EXISTS public.health_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    measurement_id UUID NOT NULL UNIQUE REFERENCES public.measurements(id) ON DELETE CASCADE,
    status_keseluruhan TEXT NOT NULL CHECK (status_keseluruhan IN ('Normal', 'Waspada', 'Berisiko', 'Kritis')),
    status_per_indikator JSONB NOT NULL DEFAULT '{}'::jsonb,
    status_lila TEXT,
    aturan_terpicu JSONB NOT NULL DEFAULT '[]'::jsonb,
    tren_bb TEXT,
    dihitung_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 4. TABEL EKSTRAKSI FOTO KIA & LOGGING (AI & Human Verification)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.extraction_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    foto_ref TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('diunggah', 'diproses', 'siap_verifikasi', 'disimpan', 'gagal', 'ditolak_validasi')),
    idempotency_key TEXT NOT NULL UNIQUE,
    hasil_ekstraksi JSONB,
    pesan_galat TEXT,
    verified_at TIMESTAMPTZ,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.extraction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measurement_id UUID REFERENCES public.measurements(id) ON DELETE SET NULL,
    extraction_job_id UUID REFERENCES public.extraction_jobs(id) ON DELETE SET NULL,
    model TEXT NOT NULL,
    versi_prompt TEXT NOT NULL,
    keyakinan JSONB,
    field_dikoreksi JSONB,
    latensi_ms INT,
    estimasi_biaya_usd NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. TABEL PERINGATAN (ALERTS), EDUKASI, & TAUTAN BAGIKAN (SHARE LINKS)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    measurement_id UUID NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,
    kode_aturan TEXT NOT NULL CHECK (kode_aturan IN ('R1', 'R2', 'R3a', 'R3b', 'R4', 'R5', 'R6', 'R7', 'R8')),
    tingkat TEXT NOT NULL CHECK (tingkat IN ('Waspada', 'Berisiko', 'Kritis')),
    pesan_awam TEXT NOT NULL,
    status_kirim TEXT NOT NULL DEFAULT 'ditampilkan_aplikasi',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- F1-02: Pencegahan duplikasi alert untuk kunjungan dan aturan yang sama
    CONSTRAINT uq_alerts_measurement_rule UNIQUE (measurement_id, kode_aturan)
);

CREATE TABLE IF NOT EXISTS public.education (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    measurement_id UUID NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,
    tips JSONB NOT NULL,
    anjuran_kritis_tetap TEXT,
    disclaimer TEXT NOT NULL,
    versi_prompt TEXT NOT NULL,
    is_fallback_statis BOOLEAN NOT NULL DEFAULT false,
    status_review TEXT NOT NULL DEFAULT 'aktif' CHECK (status_review IN ('aktif', 'dinonaktifkan', 'ditinjau')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    access_count INT NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 6. TABEL AUDIT LOG (PERMANEN / APPEND-ONLY)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aktor UUID NOT NULL REFERENCES public.users(id),
    aksi TEXT NOT NULL,
    entitas TEXT NOT NULL,
    entitas_id UUID NOT NULL,
    nilai_lama JSONB,
    nilai_baru JSONB,
    alasan TEXT NOT NULL CHECK (length(trim(alasan)) > 0),
    waktu TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 7. INDEKS PERFORMA & PENCARIAN (F1-02)
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_children_posyandu_nama ON public.children(posyandu_id, nama);
CREATE INDEX IF NOT EXISTS idx_measurements_child_date ON public.measurements(child_id, tgl_ukur DESC);
CREATE INDEX IF NOT EXISTS idx_zscores_measurement ON public.zscores(measurement_id);
CREATE INDEX IF NOT EXISTS idx_health_profiles_child ON public.health_profiles(child_id);
CREATE INDEX IF NOT EXISTS idx_alerts_child_tingkat ON public.alerts(child_id, tingkat);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON public.share_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_waktu ON public.audit_logs(waktu DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_child ON public.extraction_jobs(child_id, dibuat_pada DESC);

