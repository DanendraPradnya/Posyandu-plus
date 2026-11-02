-- ==============================================================================
-- Migrasi 004: Setup Supabase Storage Privat untuk Foto KIA (F1-09)
-- Acuan: PRD Posyandu+ v2.2 Bab 6 (NFR2), Bab 7, Bab 10
-- ==============================================================================

-- 1. Buat bucket penyimpanan privat 'kia-photos' jika belum ada
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'kia-photos',
    'kia-photos',
    false, -- Wajib privat (NFR2: akses hanya melalui Signed URL)
    2097152, -- 2 MB batas maksimal
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Kebijakan Keamanan Storage pada tabel storage.objects
-- Pengguna aktif (Kader & Bidan) dapat mengunggah foto ke bucket kia-photos
CREATE POLICY "kia_photos_insert_active_users"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'kia-photos'
        AND public.current_user_is_active() = true
    );

-- Pengguna aktif dapat membaca objek di bucket kia-photos (hanya via signed URL di aplikasi)
CREATE POLICY "kia_photos_select_active_users"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'kia-photos'
        AND public.current_user_is_active() = true
    );

-- Service role atau Bidan dapat menghapus foto untuk siklus retensi 30 hari (F1-09)
CREATE POLICY "kia_photos_delete_bidan_or_service"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'kia-photos'
        AND (public.current_user_role() = 'bidan' AND public.current_user_is_active() = true)
    );

