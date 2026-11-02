-- ==============================================================================
-- Migrasi 002: Kebijakan Keamanan Row-Level Security (RLS) (F1-05)
-- Acuan: PRD Posyandu+ v2.2 Bab 3, Bab 5 (FR1), Bab 6 (NFR2)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNGSI BANTUAN SQL (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- Fungsi untuk mendapatkan peran pengguna saat ini
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT peran FROM public.users WHERE id = auth.uid();
$$;

-- Fungsi untuk mengecek apakah pengguna saat ini berstatus aktif
CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT status_aktif FROM public.users WHERE id = auth.uid()), false);
$$;

-- Fungsi untuk mendapatkan posyandu_ditugaskan pengguna saat ini
CREATE OR REPLACE FUNCTION public.current_user_posyandu()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT posyandu_ditugaskan FROM public.users WHERE id = auth.uid();
$$;

-- ------------------------------------------------------------------------------
-- 2. AKTIFKAN RLS PADA SELURUH TABEL
-- ------------------------------------------------------------------------------

ALTER TABLE public.ref_lms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_kbm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_kms_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posyandu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zscores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. KEBIJAKAN TABEL REFERENSI & POSYANDU (READ-ONLY UNTUK USER AKTIF)
-- ------------------------------------------------------------------------------

CREATE POLICY "ref_lms_read_active_users"
    ON public.ref_lms FOR SELECT
    TO authenticated
    USING (public.current_user_is_active() = true);

CREATE POLICY "ref_kbm_read_active_users"
    ON public.ref_kbm FOR SELECT
    TO authenticated
    USING (public.current_user_is_active() = true);

CREATE POLICY "ref_kms_line_read_active_users"
    ON public.ref_kms_line FOR SELECT
    TO authenticated
    USING (public.current_user_is_active() = true);

CREATE POLICY "posyandu_read_active_users"
    ON public.posyandu FOR SELECT
    TO authenticated
    USING (public.current_user_is_active() = true);

-- ------------------------------------------------------------------------------
-- 4. KEBIJAKAN TABEL USERS (PROFIL PENGGUNA)
-- ------------------------------------------------------------------------------

-- Pengguna aktif dapat membaca profilnya sendiri
CREATE POLICY "users_read_own_profile"
    ON public.users FOR SELECT
    TO authenticated
    USING (id = auth.uid() AND public.current_user_is_active() = true);

-- Bidan aktif dapat membaca seluruh profil pengguna di wilayahnya
CREATE POLICY "users_read_bidan_all"
    ON public.users FOR SELECT
    TO authenticated
    USING (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true);

-- Bidan aktif dapat mengelola akun kader (F1-08)
CREATE POLICY "users_insert_bidan"
    ON public.users FOR INSERT
    TO authenticated
    WITH CHECK (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true);

CREATE POLICY "users_update_bidan"
    ON public.users FOR UPDATE
    TO authenticated
    USING (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true)
    WITH CHECK (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true);

-- ------------------------------------------------------------------------------
-- 5. KEBIJAKAN TABEL CHILDREN (DATA BALITA)
-- ------------------------------------------------------------------------------

-- Kader aktif: hanya anak di posyandu ditugaskan
CREATE POLICY "children_kader_select"
    ON public.children FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND posyandu_id = public.current_user_posyandu()
    );

CREATE POLICY "children_kader_insert"
    ON public.children FOR INSERT
    TO authenticated
    WITH CHECK (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND posyandu_id = public.current_user_posyandu()
    );

CREATE POLICY "children_kader_update"
    ON public.children FOR UPDATE
    TO authenticated
    USING (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND posyandu_id = public.current_user_posyandu()
    )
    WITH CHECK (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND posyandu_id = public.current_user_posyandu()
    );

-- Bidan aktif: seluruh wilayah
CREATE POLICY "children_bidan_all"
    ON public.children FOR ALL
    TO authenticated
    USING (
        public.current_user_role() = 'bidan'
        AND public.current_user_is_active() = true
    )
    WITH CHECK (
        public.current_user_role() = 'bidan'
        AND public.current_user_is_active() = true
    );

-- ------------------------------------------------------------------------------
-- 6. KEBIJAKAN DATA PENGUKURAN & HASIL KLINIS (MEASUREMENTS, ZSCORES, HEALTH_PROFILES)
-- ------------------------------------------------------------------------------

-- Helper query berbasis posyandu anak
-- Measurements
CREATE POLICY "measurements_kader_select"
    ON public.measurements FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND child_id IN (SELECT id FROM public.children WHERE posyandu_id = public.current_user_posyandu())
    );

CREATE POLICY "measurements_kader_insert"
    ON public.measurements FOR INSERT
    TO authenticated
    WITH CHECK (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND child_id IN (SELECT id FROM public.children WHERE posyandu_id = public.current_user_posyandu())
    );

CREATE POLICY "measurements_bidan_all"
    ON public.measurements FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true)
    WITH CHECK (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true);

-- ZScores
CREATE POLICY "zscores_kader_select"
    ON public.zscores FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND measurement_id IN (
            SELECT m.id FROM public.measurements m
            JOIN public.children c ON m.child_id = c.id
            WHERE c.posyandu_id = public.current_user_posyandu()
        )
    );

CREATE POLICY "zscores_bidan_all"
    ON public.zscores FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true)
    WITH CHECK (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true);

-- Health Profiles
CREATE POLICY "health_profiles_kader_select"
    ON public.health_profiles FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND child_id IN (SELECT id FROM public.children WHERE posyandu_id = public.current_user_posyandu())
    );

CREATE POLICY "health_profiles_bidan_all"
    ON public.health_profiles FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true)
    WITH CHECK (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true);

-- ------------------------------------------------------------------------------
-- 7. KEBIJAKAN ALERTS, EDUCATION, & SHARE_LINKS
-- ------------------------------------------------------------------------------

-- Alerts
CREATE POLICY "alerts_kader_select"
    ON public.alerts FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND child_id IN (SELECT id FROM public.children WHERE posyandu_id = public.current_user_posyandu())
    );

CREATE POLICY "alerts_bidan_all"
    ON public.alerts FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true)
    WITH CHECK (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true);

-- Education
CREATE POLICY "education_kader_select"
    ON public.education FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND child_id IN (SELECT id FROM public.children WHERE posyandu_id = public.current_user_posyandu())
    );

CREATE POLICY "education_bidan_all"
    ON public.education FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true)
    WITH CHECK (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true);

-- Share links (Hanya bisa dibuat oleh Kader/Bidan untuk posyandunya)
CREATE POLICY "share_links_kader_all"
    ON public.share_links FOR ALL
    TO authenticated
    USING (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND child_id IN (SELECT id FROM public.children WHERE posyandu_id = public.current_user_posyandu())
    )
    WITH CHECK (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND child_id IN (SELECT id FROM public.children WHERE posyandu_id = public.current_user_posyandu())
    );

CREATE POLICY "share_links_bidan_all"
    ON public.share_links FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true)
    WITH CHECK (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true);

-- Akses publik tanpa login untuk pembacaan tautan bagikan berdasarkan token_hash (FR13)
CREATE POLICY "share_links_public_read_by_token"
    ON public.share_links FOR SELECT
    TO anon
    USING (revoked_at IS NULL AND expires_at > now());

-- ------------------------------------------------------------------------------
-- 8. KEBIJAKAN EXTRACTION_JOBS & EXTRACTION_LOGS
-- ------------------------------------------------------------------------------

CREATE POLICY "extraction_jobs_kader_all"
    ON public.extraction_jobs FOR ALL
    TO authenticated
    USING (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND child_id IN (SELECT id FROM public.children WHERE posyandu_id = public.current_user_posyandu())
    )
    WITH CHECK (
        public.current_user_role() = 'kader'
        AND public.current_user_is_active() = true
        AND child_id IN (SELECT id FROM public.children WHERE posyandu_id = public.current_user_posyandu())
    );

CREATE POLICY "extraction_jobs_bidan_all"
    ON public.extraction_jobs FOR ALL
    TO authenticated
    USING (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true)
    WITH CHECK (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true);

CREATE POLICY "extraction_logs_read_bidan"
    ON public.extraction_logs FOR SELECT
    TO authenticated
    USING (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true);

-- ------------------------------------------------------------------------------
-- 9. KEBIJAKAN AUDIT LOGS (APPEND-ONLY, HANYA BIDAN DAPAT SELECT, TIDAK BISA UPDATE/DELETE)
-- ------------------------------------------------------------------------------

CREATE POLICY "audit_logs_select_bidan"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true);

CREATE POLICY "audit_logs_insert_authenticated"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.current_user_is_active() = true);

-- Catatan: TIDAK ADA POLICY UPDATE ATAU DELETE pada audit_logs.
-- Dengan demikian, tidak ada peran pengguna mana pun yang dapat memodifikasi atau menghapus jejak audit.

