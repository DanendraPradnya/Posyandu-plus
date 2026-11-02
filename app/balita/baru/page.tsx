"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateAgeInMonths, validateAgeInMonths } from "@/lib/zscore/age";
import {
  findPotentialDuplicates,
  validateChildRegistration,
  type ExistingChildSummary,
} from "@/lib/validation/child-registration";
import type { Posyandu, Sex, UserProfile } from "@/lib/types";
import {
  Button,
  Card,
  ErrorBox,
  Input,
  Select,
  SkeletonCard,
  StatusBadge,
} from "@/components/ui";

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function RegistrasiBalitaBaruPage() {
  const router = useRouter();
  const todayIso = useMemo(() => getTodayIso(), []);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posyanduList, setPosyanduList] = useState<Posyandu[]>([]);
  const [existingChildren, setExistingChildren] = useState<
    ExistingChildSummary[]
  >([]);

  const [isLoadingInit, setIsLoadingInit] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // State input form
  const [nama, setNama] = useState("");
  const [tglLahir, setTglLahir] = useState("");
  const [jenisKelamin, setJenisKelamin] = useState<Sex | "">("");
  const [nikNoKia, setNikNoKia] = useState("");
  const [namaOrtu, setNamaOrtu] = useState("");
  const [kontakOrtu, setKontakOrtu] = useState("");
  const [posyanduId, setPosyanduId] = useState("");
  const [banjar, setBanjar] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadInitialFormContext = useCallback(async () => {
    setIsLoadingInit(true);
    setInitError(null);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();

      if (authErr || !user) {
        router.replace("/login");
        return;
      }

      const { data: userProfile, error: profErr } = await supabase
        .from("users")
        .select("id, peran, nama, email, status_aktif, posyandu_ditugaskan")
        .eq("id", user.id)
        .maybeSingle();

      if (profErr || !userProfile) {
        throw new Error("Profil petugas tidak ditemukan.");
      }

      if (!userProfile.status_aktif) {
        await supabase.auth.signOut();
        router.replace("/login?error=account_inactive");
        return;
      }

      const typedProfile = userProfile as UserProfile;
      setProfile(typedProfile);

      const { data: posRows, error: posErr } = await supabase
        .from("posyandu")
        .select("id, nama, dusun_banjar, wilayah_puskesmas")
        .order("nama", { ascending: true });

      if (posErr) {
        throw new Error(posErr.message);
      }

      const posList = (posRows ?? []) as Posyandu[];
      setPosyanduList(posList);

      // Default posyandu & banjar otomatis untuk Kader sesuai penugasan
      if (typedProfile.peran === "kader" && typedProfile.posyandu_ditugaskan) {
        setPosyanduId(typedProfile.posyandu_ditugaskan);
        const assignedPos = posList.find(
          (p) => p.id === typedProfile.posyandu_ditugaskan
        );
        if (assignedPos) {
          setBanjar(assignedPos.dusun_banjar);
        }
      } else if (posList[0]) {
        setPosyanduId(posList[0].id);
        setBanjar(posList[0].dusun_banjar);
      }

      // Ambil daftar ringkas balita untuk pemeriksaan duplikat nama + tgl_lahir
      const { data: childRows } = await supabase
        .from("children")
        .select("id, nama, tgl_lahir, nama_ortu, banjar");

      setExistingChildren((childRows ?? []) as ExistingChildSummary[]);
    } catch (err: unknown) {
      setInitError(
        err instanceof Error
          ? err.message
          : "Gagal memuat data referensi Posyandu."
      );
    } finally {
      setIsLoadingInit(false);
    }
  }, [router]);

  useEffect(() => {
    void loadInitialFormContext();
  }, [loadInitialFormContext]);

  // Perhitungan & validasi usia real-time saat tglLahir berubah
  const liveAgeCheck = useMemo(() => {
    if (!tglLahir) return null;
    try {
      const months = calculateAgeInMonths(tglLahir, todayIso);
      return validateAgeInMonths(months);
    } catch {
      return {
        ageMonths: -1,
        isValid: false,
        errorMessage: "Format tanggal lahir tidak valid.",
      };
    }
  }, [tglLahir, todayIso]);

  // Peringatan duplikat nama + tanggal lahir secara inline
  const duplicateMatches = useMemo(() => {
    return findPotentialDuplicates(nama, tglLahir, existingChildren);
  }, [nama, tglLahir, existingChildren]);

  // Validasi menyeluruh untuk menentukan apakah tombol simpan diaktifkan
  const validationState = useMemo(() => {
    return validateChildRegistration({
      nama,
      tgl_lahir: tglLahir,
      jenis_kelamin: jenisKelamin,
      nik_no_kia: nikNoKia,
      nama_ortu: namaOrtu,
      kontak_ortu: kontakOrtu,
      posyandu_id: posyanduId,
      banjar,
      consent_given: consentGiven,
      referenceDate: todayIso,
    });
  }, [
    nama,
    tglLahir,
    jenisKelamin,
    nikNoKia,
    namaOrtu,
    kontakOrtu,
    posyanduId,
    banjar,
    consentGiven,
    todayIso,
  ]);

  function handlePosyanduChange(newPosyanduId: string) {
    setPosyanduId(newPosyanduId);
    const matched = posyanduList.find((p) => p.id === newPosyanduId);
    if (matched && !banjar.trim()) {
      setBanjar(matched.dusun_banjar);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    if (!validationState.isValid) {
      const firstError = Object.values(validationState.errors)[0];
      setSubmitError(
        firstError ?? "Mohon lengkapi seluruh kolom wajib dan centang persetujuan."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const consentTimestamp = new Date().toISOString();

      const { error: insertErr } = await supabase.from("children").insert({
        nama: nama.trim(),
        tgl_lahir: tglLahir,
        jenis_kelamin: jenisKelamin as Sex,
        nik_no_kia: nikNoKia.trim() ? nikNoKia.trim() : null,
        nama_ortu: namaOrtu.trim(),
        kontak_ortu: kontakOrtu.trim() ? kontakOrtu.trim() : null,
        posyandu_id: posyanduId,
        banjar: banjar.trim(),
        consent_at: consentTimestamp,
      });

      if (insertErr) {
        setSubmitError(`Gagal menyimpan data balita: ${insertErr.message}`);
        setIsSubmitting(false);
        return;
      }

      router.push("/balita?registered=1");
      router.refresh();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menyimpan data registrasi balita."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen p-4 space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <Link
          href="/balita"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
        >
          <span aria-hidden="true">&larr;</span>
          <span>Batal &amp; Kembali</span>
        </Link>
      </div>

      {/* Header Synora Mesh (1 per layar) */}
      <header className="bg-synora-mesh rounded-2xl p-5 border border-gray-200/80 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status="Normal" label="Form Registrasi & UU PDP" />
          <span className="text-xs font-medium text-gray-700">
            Rentang 0-59 Bulan
          </span>
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-gray-900">
          Daftarkan Balita Baru
        </h1>
        <p className="text-sm text-gray-700">
          Lengkapi identitas balita dan konfirmasi persetujuan eksplisit orang tua/wali sebelum menyimpan profil.
        </p>
      </header>

      {isLoadingInit ? (
        <SkeletonCard count={3} lines={3} />
      ) : initError ? (
        <ErrorBox
          title="Gagal Memuat Formulir"
          message={initError}
          onRetry={loadInitialFormContext}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {submitError && (
            <div
              role="alert"
              className="rounded-2xl border border-red-300 bg-[#FEE2E2] p-4 text-sm font-medium text-[#B91C1C]"
            >
              {submitError}
            </div>
          )}

          {/* Peringatan Duplikat Inline */}
          {duplicateMatches.length > 0 && (
            <div
              role="alert"
              className="rounded-2xl border border-amber-300 bg-[#FEF3C7] p-4 space-y-2 text-sm text-[#B45309]"
            >
              <p className="font-semibold">
                Peringatan Kemungkinan Data Duplikat
              </p>
              <p className="text-xs text-gray-800">
                Ditemukan balita terdaftar dengan nama dan tanggal lahir yang sama:
              </p>
              <ul className="list-disc list-inside text-xs text-gray-900 space-y-1">
                {duplicateMatches.map((dup) => (
                  <li key={dup.id}>
                    <strong>{dup.nama}</strong> (Lahir: {dup.tgl_lahir}, Orang Tua:{" "}
                    {dup.nama_ortu}, {dup.banjar}){" "}
                    <Link
                      href={`/balita/${dup.id}`}
                      className="underline font-semibold text-gray-900"
                    >
                      Lihat Profil
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Card variant="white" padding="lg" className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              1. Identitas Balita
            </h2>

            <Input
              id="reg-nama"
              label="Nama Lengkap Balita"
              placeholder="Contoh: Putu Ayu Lestari"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              required
            />

            <div className="space-y-2">
              <Input
                id="reg-tgl-lahir"
                label="Tanggal Lahir Balita"
                type="date"
                max={todayIso}
                value={tglLahir}
                onChange={(e) => setTglLahir(e.target.value)}
                error={
                  liveAgeCheck && !liveAgeCheck.isValid
                    ? liveAgeCheck.errorMessage
                    : undefined
                }
                required
              />

              {liveAgeCheck && liveAgeCheck.isValid && (
                <div className="flex items-center justify-between rounded-xl border border-green-300 bg-[#DCFCE7]/70 px-3.5 py-2 text-xs font-medium text-[#15803D]">
                  <span>Usia terhitung saat ini:</span>
                  <span className="font-bold tabular-nums">
                    {liveAgeCheck.ageMonths} bulan (Memenuhi syarat 0-59 bulan)
                  </span>
                </div>
              )}
            </div>

            {/* Pilihan Jenis Kelamin (Kartu Radio >= 48px) */}
            <fieldset className="space-y-1.5">
              <legend className="block text-sm font-medium text-gray-900">
                Jenis Kelamin <span className="text-red-700">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <label
                  htmlFor="sex-m"
                  className={[
                    "flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors",
                    jenisKelamin === "M"
                      ? "border-[#0284C7] bg-[#E0F2FE] text-[#0284C7] ring-2 ring-[#0284C7]"
                      : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <input
                    id="sex-m"
                    type="radio"
                    name="jenis_kelamin"
                    value="M"
                    checked={jenisKelamin === "M"}
                    onChange={() => setJenisKelamin("M")}
                    className="sr-only"
                  />
                  <span>Laki-laki (L)</span>
                </label>

                <label
                  htmlFor="sex-f"
                  className={[
                    "flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors",
                    jenisKelamin === "F"
                      ? "border-[#DB2777] bg-[#FCE7F3] text-[#DB2777] ring-2 ring-[#DB2777]"
                      : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <input
                    id="sex-f"
                    type="radio"
                    name="jenis_kelamin"
                    value="F"
                    checked={jenisKelamin === "F"}
                    onChange={() => setJenisKelamin("F")}
                    className="sr-only"
                  />
                  <span>Perempuan (P)</span>
                </label>
              </div>
            </fieldset>

            <Input
              id="reg-nik-kia"
              label="NIK atau Nomor Buku KIA (Opsional)"
              placeholder="Nomor identitas pada Buku KIA"
              value={nikNoKia}
              onChange={(e) => setNikNoKia(e.target.value)}
              helperText="Kosongkan apabila orang tua belum membawa Buku KIA fisik."
            />
          </Card>

          <Card variant="white" padding="lg" className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              2. Data Orang Tua &amp; Lokasi Posyandu
            </h2>

            <Input
              id="reg-nama-ortu"
              label="Nama Ibu / Orang Tua / Wali"
              placeholder="Contoh: Ni Made Sari"
              value={namaOrtu}
              onChange={(e) => setNamaOrtu(e.target.value)}
              required
            />

            <Input
              id="reg-kontak-ortu"
              label="Nomor Telepon / WhatsApp Orang Tua (Opsional)"
              type="tel"
              placeholder="Contoh: 081234567890"
              value={kontakOrtu}
              onChange={(e) => setKontakOrtu(e.target.value)}
            />

            <Select
              id="reg-posyandu"
              label="Posyandu Tempat Pencatatan"
              value={posyanduId}
              onChange={(e) => handlePosyanduChange(e.target.value)}
              disabled={
                profile?.peran === "kader" &&
                Boolean(profile.posyandu_ditugaskan)
              }
              options={posyanduList.map((p) => ({
                value: p.id,
                label: `${p.nama} (${p.dusun_banjar})`,
              }))}
              helperText={
                profile?.peran === "kader"
                  ? "Posyandu dikunci otomatis sesuai penugasan akun Kader Anda."
                  : "Pilih Posyandu tempat balita terdaftar."
              }
              required
            />

            <Input
              id="reg-banjar"
              label="Banjar / Dusun Tempat Tinggal"
              placeholder="Contoh: Banjar Kaja"
              value={banjar}
              onChange={(e) => setBanjar(e.target.value)}
              required
            />
          </Card>

          {/* Kotak Persetujuan Eksplisit Orang Tua / Wali (UU PDP No. 27 Tahun 2022) */}
          <Card variant="surface" padding="lg" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                3. Persetujuan Pelindungan Data Pribadi (UU PDP)
              </h2>
              <StatusBadge status="Waspada" label="Wajib" />
            </div>

            <p className="text-xs leading-relaxed text-gray-700">
              Sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, pencatatan data identitas dan pengukuran antropometri anak memerlukan persetujuan eksplisit dari orang tua atau wali yang sah untuk keperluan pemantauan tumbuh kembang di Posyandu dan Puskesmas.
            </p>

            <label
              htmlFor="reg-consent-checkbox"
              className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-gray-300 bg-white p-3.5 text-sm text-gray-900 hover:bg-gray-50 focus-within:ring-2 focus-within:ring-gray-900"
            >
              <input
                id="reg-consent-checkbox"
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-gray-400 text-gray-900 focus:ring-gray-900 shrink-0"
              />
              <span className="text-xs font-medium leading-relaxed text-gray-900">
                Orang tua / wali balita telah membaca atau menerima penjelasan dan memberikan persetujuan eksplisit atas pemrosesan data pertumbuhan anak di aplikasi Posyandu+.
              </span>
            </label>
          </Card>

          <div className="pt-1">
            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isSubmitting}
              disabled={!validationState.isValid || isSubmitting}
            >
              {isSubmitting
                ? "Menyimpan Profil Balita..."
                : "Simpan & Daftarkan Balita"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

