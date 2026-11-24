"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo, Button, Card, ErrorBox, SkeletonCard } from "@/components/ui";
import { CameraCaptureCrop } from "@/components/measurement/CameraCaptureCrop";
import { VerificationSideBySide } from "@/components/measurement/VerificationSideBySide";
import { ManualMeasurementForm } from "@/components/measurement/ManualMeasurementForm";
import type {
  Child,
  ExtractionJob,
  Measurement,
  MeasurementMethod,
  ZScoreResult,
} from "@/lib/types";

type InputMode = "foto" | "manual";

interface ExtractionApiResponse {
  job: ExtractionJob;
  signedPhotoUrl?: string | null;
  modelUsed?: string;
  promptVersion?: string;
  budgetWarning?: boolean;
  fallbackToManual?: boolean;
  errorMessage?: string;
  error?: string;
}

function UkurBalitaContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const childId = params.id;

  const initialMode: InputMode =
    searchParams.get("mode") === "manual" ? "manual" : "foto";

  const [mode, setMode] = useState<InputMode>(initialMode);
  const [child, setChild] = useState<Child | null>(null);
  const [previousMeasurements, setPreviousMeasurements] = useState<Measurement[]>([]);
  const [isLoadingChild, setIsLoadingChild] = useState(true);
  const [childError, setChildError] = useState<string | null>(null);

  // State ekstraksi foto
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ExtractionJob | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [promptVersion, setPromptVersion] = useState<string | null>(null);
  const [budgetWarning, setBudgetWarning] = useState(false);

  // State simpan pengukuran
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedZScores, setSavedZScores] = useState<ZScoreResult[] | null>(null);

  const loadChild = useCallback(async () => {
    setIsLoadingChild(true);
    setChildError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .select("peran, status_aktif")
        .eq("id", user.id)
        .maybeSingle();

      if (!userErr && userRow && userRow.status_aktif === false) {
        await supabase.auth.signOut();
        router.replace("/login?error=account_inactive");
        return;
      }

      if (userRow?.peran === "orang_tua") {
        router.replace("/balita?denied=parent_readonly");
        return;
      }

      const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("id", childId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        setChildError(
          "Data balita tidak ditemukan atau berada di luar wilayah Posyandu Anda."
        );
        return;
      }

      setChild(data as Child);

      const { data: mRows } = await supabase
        .from("measurements")
        .select("*")
        .eq("child_id", childId)
        .order("tgl_ukur", { ascending: false });
      setPreviousMeasurements((mRows ?? []) as Measurement[]);
    } catch (err: unknown) {
      setChildError(
        err instanceof Error ? err.message : "Gagal memuat data balita."
      );
    } finally {
      setIsLoadingChild(false);
    }
  }, [childId, router]);

  useEffect(() => {
    void loadChild();
  }, [loadChild]);

  const handlePhotoReady = async (file: File, localPreviewUrl: string) => {
    setIsExtracting(true);
    setExtractionError(null);
    setSaveError(null);
    setPreviewPhotoUrl(localPreviewUrl);

    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${childId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const formData = new FormData();
      formData.append("child_id", childId);
      formData.append("idempotency_key", idempotencyKey);
      formData.append("file", file);

      const res = await fetch("/api/extractions", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as ExtractionApiResponse;

      if (!res.ok) {
        throw new Error(data.error ?? "Gagal memproses ekstraksi foto KIA.");
      }

      if (data.signedPhotoUrl) {
        setPreviewPhotoUrl(data.signedPhotoUrl);
      }

      setModelUsed(data.modelUsed ?? null);
      setPromptVersion(data.promptVersion ?? null);
      setBudgetWarning(Boolean(data.budgetWarning));

      if (
        data.fallbackToManual ||
        data.job.status === "gagal" ||
        data.job.status === "ditolak_validasi"
      ) {
        setActiveJob(null);
        setExtractionError(
          data.errorMessage ??
            data.job.pesan_galat ??
            "Ekstraksi AI gagal. Silakan coba foto ulang atau gunakan Input Manual."
        );
        return;
      }

      setActiveJob(data.job);
    } catch (err: unknown) {
      setActiveJob(null);
      setExtractionError(
        err instanceof Error
          ? err.message
          : "Terjadi gangguan jaringan saat mengekstrak foto. Anda dapat menggunakan Input Manual."
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirmSaveVerified = async (
    selectedRows: Array<{
      baris_index: number;
      tgl_ukur: string;
      bb_kg: number;
      pb_tb_cm: number | null;
      cara_ukur: MeasurementMethod | null;
      lk_cm: number | null;
      lila_cm: number | null;
      imunisasi: string | null;
      asi_eksklusif: boolean | null;
    }>
  ) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          child_id: childId,
          sumber: "AI",
          foto_ref: activeJob?.foto_ref ?? null,
          extraction_job_id: activeJob?.id ?? null,
          model_used: modelUsed,
          prompt_version: promptVersion,
          original_rows: activeJob?.hasil_ekstraksi?.baris_kunjungan ?? [],
          rows: selectedRows,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Gagal menyimpan hasil verifikasi.");
      }

      setSavedZScores((data.zscores ?? []) as ZScoreResult[]);
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : "Gagal menyimpan data pengukuran."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitManual = async (row: {
    tgl_ukur: string;
    bb_kg: number;
    pb_tb_cm: number | null;
    cara_ukur: MeasurementMethod | null;
    lk_cm: number | null;
    lila_cm: number | null;
    imunisasi: string | null;
    asi_eksklusif: boolean | null;
  }) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          child_id: childId,
          sumber: "manual",
          rows: [row],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Gagal menyimpan pengukuran manual.");
      }

      setSavedZScores((data.zscores ?? []) as ZScoreResult[]);
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : "Gagal menyimpan pengukuran manual."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen px-4 sm:px-6 py-4 sm:py-5 space-y-5 pb-12">
      <div className="flex items-center justify-between gap-3 rounded-full bg-white border border-[#D5ECEF] px-3 sm:px-4 py-1.5 shadow-[0_1px_2px_rgba(15,41,46,0.04)]">
        <BrandLogo href="/" size="md" />
        <Link
          href={`/balita/${childId}`}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#C5E4E8] bg-white px-4 text-xs font-semibold text-[#0F292E] hover:bg-[#EDF8FA]"
        >
          <span aria-hidden="true">&larr;</span>
          <span>Kembali ke Profil Balita</span>
        </Link>
      </div>

      {isLoadingChild ? (
        <SkeletonCard count={2} lines={4} />
      ) : childError || !child ? (
        <ErrorBox
          title="Profil Balita Tidak Tersedia"
          message={childError ?? "Data balita tidak ditemukan."}
          onRetry={loadChild}
        />
      ) : savedZScores ? (
        <Card variant="white" padding="md" className="space-y-4">
          <div className="space-y-1">
            <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              Data Pengukuran Tersimpan
            </span>
            <h1 className="text-lg font-bold text-[#0F292E]">
              Hasil Z-Score Awal: {child.nama}
            </h1>
            <p className="text-xs text-[#4A666C]">
              Dihitung otomatis secara deterministik berdasarkan Permenkes No. 2 Tahun 2020 (WHO
              2006).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {savedZScores.map((z, idx) => (
              <div
                key={`${z.indikator}-${idx}`}
                className="rounded-xl border border-[#DCEEEF] bg-[#F7FBFC] p-3 space-y-1"
              >
                <div className="flex items-center justify-between text-xs font-bold text-[#0F292E]">
                  <span>{z.indikator}</span>
                  <span className="tabular-nums">
                    {z.nilai_z !== null ? `${z.nilai_z.toFixed(2)} SD` : "-"}
                  </span>
                </div>
                <p className="text-xs text-[#00857C] font-semibold">
                  {z.klasifikasi}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                setSavedZScores(null);
                setActiveJob(null);
                setPreviewPhotoUrl(null);
                setExtractionError(null);
              }}
            >
              Tambah Pengukuran Lagi
            </Button>
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={() => router.push(`/balita/${childId}`)}
            >
              Lihat Profil &amp; Riwayat
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <header className="space-y-1">
            <h1 className="text-xl font-bold text-[#0F292E]">
              Catat Pengukuran: {child.nama}
            </h1>
            <p className="text-xs text-[#4A666C]">
              Pilih metode Foto Buku KIA (ekstraksi otomatis dengan verifikasi) atau Input Manual.
            </p>
          </header>

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#EDF8FA] p-1.5 border border-[#C5E4E8]">
            <button
              type="button"
              onClick={() => {
                setMode("foto");
                setSaveError(null);
              }}
              className={`min-h-[48px] rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                mode === "foto"
                  ? "bg-[#00B9AD] text-white shadow-sm"
                  : "text-[#0F292E] hover:bg-white/70"
              }`}
            >
              Foto Buku KIA
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("manual");
                setSaveError(null);
              }}
              className={`min-h-[48px] rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                mode === "manual"
                  ? "bg-[#00B9AD] text-white shadow-sm"
                  : "text-[#0F292E] hover:bg-white/70"
              }`}
            >
              Input Manual
            </button>
          </div>

          {mode === "foto" && (
            <>
              {extractionError && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-2.5">
                  <p className="font-bold">Ekstraksi Foto Tidak Berhasil</p>
                  <p>{extractionError}</p>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setMode("manual");
                      setExtractionError(null);
                    }}
                  >
                    Beralih ke Input Manual
                  </Button>
                </div>
              )}

              {activeJob && previewPhotoUrl ? (
                <VerificationSideBySide
                  photoUrl={previewPhotoUrl}
                  rows={activeJob.hasil_ekstraksi?.baris_kunjungan ?? []}
                  budgetWarning={budgetWarning}
                  onConfirmSave={handleConfirmSaveVerified}
                  onSwitchToManual={() => setMode("manual")}
                  onRetakePhoto={() => {
                    setActiveJob(null);
                    setPreviewPhotoUrl(null);
                    setExtractionError(null);
                  }}
                  isSaving={isSaving}
                  saveError={saveError}
                />
              ) : (
                <CameraCaptureCrop
                  onPhotoReady={handlePhotoReady}
                  onSwitchToManual={() => setMode("manual")}
                  isSubmitting={isExtracting}
                />
              )}
            </>
          )}

          {mode === "manual" && (
            <ManualMeasurementForm
              childBirthDate={child.tgl_lahir}
              childSex={child.jenis_kelamin}
              previousMeasurements={previousMeasurements}
              onSubmitManual={handleSubmitManual}
              isSaving={isSaving}
              serverError={saveError}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function UkurBalitaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen px-4 sm:px-6 py-4 sm:py-5">
          <SkeletonCard count={2} lines={4} />
        </div>
      }
    >
      <UkurBalitaContent />
    </Suspense>
  );
}
