-- ==============================================================================
-- Migrasi 005: Peran Pengguna Orang Tua / Wali (orang_tua) & RLS Read-Only
-- Acuan: PRD Posyandu+ v2.2 Bab 3, Bab 5 (FR1, FR2, FR6A, FR8, FR9), Issue #17
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PERLUAS CONSTRAINT PERAN PADA TABEL USERS
-- ------------------------------------------------------------------------------

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_peran_check;

ALTER TABLE public.users
    ADD CONSTRAINT users_peran_check
    CHECK (peran IN ('kader', 'bidan', 'orang_tua'));

-- ------------------------------------------------------------------------------
-- 2. TAMBAHKAN RELASI ORANG TUA (parent_user_id) PADA TABEL CHILDREN
--    Satu akun orang_tua dapat ditautkan ke satu atau lebih balita.
-- ------------------------------------------------------------------------------

ALTER TABLE public.children
    ADD COLUMN IF NOT EXISTS parent_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_children_parent_user
    ON public.children(parent_user_id);

-- ------------------------------------------------------------------------------
-- 3. KEBIJAKAN RLS READ-ONLY (FOR SELECT SAJA) UNTUK PERAN ORANG_TUA
--    Catatan: TIDAK ADA kebijakan INSERT, UPDATE, atau DELETE untuk orang_tua
--    pada tabel klinis mana pun.
-- ------------------------------------------------------------------------------

-- Kader & Bidan aktif dapat membaca daftar akun orang_tua untuk menautkan saat registrasi
DROP POLICY IF EXISTS "users_read_parents_by_staff" ON public.users;
CREATE POLICY "users_read_parents_by_staff"
    ON public.users FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() IN ('kader', 'bidan')
        AND public.current_user_is_active() = true
        AND peran = 'orang_tua'
    );

-- Children: Orang tua hanya dapat melihat balita miliknya sendiri
DROP POLICY IF EXISTS "children_parent_select" ON public.children;
CREATE POLICY "children_parent_select"
    ON public.children FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() = 'orang_tua'
        AND public.current_user_is_active() = true
        AND parent_user_id = auth.uid()
    );

-- Measurements: Read-only untuk kunjungan milik anak sendiri
DROP POLICY IF EXISTS "measurements_parent_select" ON public.measurements;
CREATE POLICY "measurements_parent_select"
    ON public.measurements FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() = 'orang_tua'
        AND public.current_user_is_active() = true
        AND child_id IN (
            SELECT id FROM public.children WHERE parent_user_id = auth.uid()
        )
    );

-- Z-Scores: Read-only untuk hasil Z-Score milik anak sendiri
DROP POLICY IF EXISTS "zscores_parent_select" ON public.zscores;
CREATE POLICY "zscores_parent_select"
    ON public.zscores FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() = 'orang_tua'
        AND public.current_user_is_active() = true
        AND measurement_id IN (
            SELECT m.id
            FROM public.measurements m
            JOIN public.children c ON m.child_id = c.id
            WHERE c.parent_user_id = auth.uid()
        )
    );

-- Health Profiles: Read-only untuk profil kesehatan milik anak sendiri
DROP POLICY IF EXISTS "health_profiles_parent_select" ON public.health_profiles;
CREATE POLICY "health_profiles_parent_select"
    ON public.health_profiles FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() = 'orang_tua'
        AND public.current_user_is_active() = true
        AND child_id IN (
            SELECT id FROM public.children WHERE parent_user_id = auth.uid()
        )
    );

-- Alerts: Read-only untuk peringatan dini milik anak sendiri
DROP POLICY IF EXISTS "alerts_parent_select" ON public.alerts;
CREATE POLICY "alerts_parent_select"
    ON public.alerts FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() = 'orang_tua'
        AND public.current_user_is_active() = true
        AND child_id IN (
            SELECT id FROM public.children WHERE parent_user_id = auth.uid()
        )
    );

-- Education: Read-only untuk rekomendasi edukasi AI berstatus 'aktif' milik anak sendiri
DROP POLICY IF EXISTS "education_parent_select" ON public.education;
CREATE POLICY "education_parent_select"
    ON public.education FOR SELECT
    TO authenticated
    USING (
        public.current_user_role() = 'orang_tua'
        AND public.current_user_is_active() = true
        AND status_review = 'aktif'
        AND child_id IN (
            SELECT id FROM public.children WHERE parent_user_id = auth.uid()
        )
    );
