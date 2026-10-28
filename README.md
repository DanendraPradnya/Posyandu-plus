# Posyandu+ (`code/`)

Workspace aplikasi **Posyandu+** — Sistem deteksi dini risiko *stunting* dan pemantauan pertumbuhan balita (0-59 bulan) berbasis *Mobile-First Progressive Web App* (PWA).

## Struktur Folder (Fase 0)

- `app/` — Halaman dan Route Handlers Next.js (App Router, Mobile-First 360px)
- `lib/types/` — Kontrak API & tipe data bersama (`F0-09`)
- `lib/ai/` — Skema JSON *structured output* ekstraksi KIA & modul LLM (`F0-07`)
- `lib/zscore/` — Mesin hitung Z-Score deterministik metode LMS WHO 2006 / Permenkes 2/2020
- `lib/rules/` — Mesin aturan *growth faltering* & *Risk Alert* (`R1` s.d. `R8`)
- `ref/` — Tabel referensi resmi (`ref_lms.csv`, `ref_kbm.csv`, `ref_kms_line.csv`) (`F0-03`..`F0-05`)
- `eval/` — Template halaman KIA sintetis (`eval/templates/`) & skrip evaluasi Golden Set (`F0-08`)
- `tests/` — Unit test Vitest & fixture uji Permenkes 2/2020 (`tests/fixtures/permenkes.json`, 672 titik) (`F0-06`)

## Cara Menjalankan

1. Masuk ke direktori `code`:
   ```bash
   cd code
   ```
2. Salin variabel lingkungan:
   ```bash
   cp .env.example .env.local
   ```
3. Pasang dependensi dan jalankan server pengembangan:
   ```bash
   npm install
   npm run dev
   ```
4. Jalankan pengujian unit & verifikasi Gerbang Fase 0:
   ```bash
   npm test
   ```

## Aturan Branch & Pull Request (F0-01)

- Branch utama: `main` (dilindungi, hanya melalui Pull Request).
- Penamaan branch fitur mengikuti kode langkah kerja pada `plan/mvp_work_breakdown.md`:
  - `feat/F1-13-lms-engine` (Role B)
  - `feat/F2-01-gemini-vision-extraction` (Role A)
  - `feat/F1-21-pwa-layout` (Role C)
- Setiap PR wajib:
  1. Lolos `npm run typecheck` dan `npm test`.
  2. Ditinjau minimal oleh **1 anggota tim lain** (Code Review silang).
  3. Tidak menyertakan kunci API rahasia atau data pasien nyata.
