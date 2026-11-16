"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateAgeInMonths } from "@/lib/zscore/age";
import type {
  Child,
  HealthProfile,
  Measurement,
  Posyandu,
  ZScoreResult,
} from "@/lib/types";
import {
  Card,
  EmptyState,
  ErrorBox,
  SkeletonCard,
  StatusBadge,
} from "@/components/ui";
import { HealthProfileCard } from "@/components/health/HealthProfileCard";
import { KmsChart } from "@/components/kms/KmsChart";

function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DetailBalitaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const childId = params.id;

  const [child, setChild] = useState<Child | null>(null);
  const [posyandu, setPosyandu] = useState<Posyandu | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [zscoresByMeasurement, setZscoresByMeasurement] = useState<
    Record<string, ZScoreResult[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadChildDetail = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: childData, error: childErr } = await supabase
        .from("children")
        .select("*")
        .eq("id", childId)
        .maybeSingle();

      if (childErr) {
        throw new Error(childErr.message);
      }

      if (!childData) {
        setErrorMsg("Data balita tidak ditemukan atau berada di luar wilayah Posyandu Anda.");
        setIsLoading(false);
        return;
      }

      setChild(childData as Child);

      const { data: posData } = await supabase
        .from("posyandu")
        .select("id, nama, dusun_banjar, wilayah_puskesmas")
        .eq("id", childData.posyandu_id)
        .maybeSingle();

      if (posData) {
        setPosyandu(posData as Posyandu);
      }

      const { data: mRows, error: mErr } = await supabase
        .from("measurements")
        .select("*")
        .eq("child_id", childId)
        .order("tgl_ukur", { ascending: false });

      if (mErr) {
        throw new Error(mErr.message);
      }

      const loadedMeasurements = (mRows ?? []) as Measurement[];
      setMeasurements(loadedMeasurements);

      if (loadedMeasurements.length > 0) {
        const measurementIds = loadedMeasurements.map((m) => m.id);
        const { data: zRows } = await supabase
          .from("zscores")
          .select("*")
          .in("measurement_id", measurementIds);

        const grouped: Record<string, ZScoreResult[]> = {};
        for (const z of (zRows ?? []) as ZScoreResult[]) {
          const mid = z.measurement_id ?? "";
          if (!grouped[mid]) grouped[mid] = [];
          grouped[mid].push(z);
        }
        setZscoresByMeasurement(grouped);
      } else {
        setZscoresByMeasurement({});
      }

      const { data: hpRow } = await supabase
        .from("health_profiles")
        .select("*")
        .eq("child_id", childId)
        .order("dihitung_pada", { ascending: false })
        .limit(1)
        .maybeSingle();

      setHealthProfile((hpRow ?? null) as HealthProfile | null);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Gagal memuat detail profil balita."
      );
    } finally {
      setIsLoading(false);
    }
  }, [childId, router]);

  useEffect(() => {
    void loadChildDetail();
  }, [loadChildDetail]);

  const todayIso = getTodayIso();
  const ageMonths =
    child !== null
      ? Math.max(0, calculateAgeInMonths(child.tgl_lahir, todayIso))
      : 0;

  return (
    <div className="min-h-screen px-4 sm:px-6 py-4 sm:py-5 space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <Link
          href="/balita"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-[#C5E4E8] bg-white px-4 text-xs font-semibold text-[#0F292E] hover:bg-[#EDF8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B9AD]"
        >
          <span aria-hidden="true">&larr;</span>
          <span>Kembali ke Daftar Balita</span>
        </Link>
      </div>

      {isLoading ? (
        <SkeletonCard count={2} lines={4} />
      ) : errorMsg || !child ? (
        <ErrorBox
          title="Profil Balita Tidak Tersedia"
          message={errorMsg ?? "Data balita tidak ditemukan."}
          onRetry={loadChildDetail}
        />
      ) : (
        <>
          <header className="bg-synora-mesh rounded-[24px] p-5 border border-[#C5E4E8] text-[#0F292E] shadow-sm space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <StatusBadge status={child.jenis_kelamin} />
              <span className="text-xs font-semibold tabular-nums text-[#00857C]">
                Usia: {ageMonths} bulan
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0F292E]">
                {child.nama}
              </h1>
              <p className="text-xs sm:text-sm text-[#4A666C]">
                Tanggal Lahir: <span className="tabular-nums font-semibold text-[#0F292E]">{child.tgl_lahir}</span>
              </p>
            </div>
          </header>

          <Card variant="white" padding="md" className="space-y-2.5">
            <h2 className="text-sm font-bold text-[#0F292E]">
              Informasi Keluarga &amp; Posyandu
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-xs sm:text-sm">
              <div className="flex justify-between border-b border-[#EDF8FA] pb-1.5">
                <dt className="text-[#4A666C]">Nama Orang Tua / Wali</dt>
                <dd className="font-semibold text-[#0F292E]">{child.nama_ortu}</dd>
              </div>
              <div className="flex justify-between border-b border-[#EDF8FA] pb-1.5">
                <dt className="text-[#4A666C]">Banjar / Dusun</dt>
                <dd className="font-semibold text-[#0F292E]">{child.banjar}</dd>
              </div>
              <div className="flex justify-between border-b border-[#EDF8FA] pb-1.5">
                <dt className="text-[#4A666C]">Posyandu</dt>
                <dd className="font-semibold text-[#0F292E]">
                  {posyandu?.nama ?? child.posyandu_id}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#4A666C]">Persetujuan UU PDP</dt>
                <dd className="font-semibold text-[#009E94] tabular-nums">
                  Tercatat ({child.consent_at.slice(0, 10)})
                </dd>
              </div>
            </dl>
          </Card>

          <HealthProfileCard profile={healthProfile} />

          <KmsChart
            sex={child.jenis_kelamin}
            currentAgeMonths={ageMonths}
            measurements={measurements}
          />

          <section className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href={`/balita/${child.id}/ukur?mode=foto`}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#00B9AD] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#009E94] active:bg-[#00857C]"
              >
                Scan Foto Buku KIA
              </Link>
              <Link
                href={`/balita/${child.id}/ukur?mode=manual`}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#C5E4E8] bg-white px-5 py-2.5 text-sm font-semibold text-[#0F292E] hover:bg-[#EDF8FA]"
              >
                Input Manual
              </Link>
              <Link
                href={`/balita/${child.id}/hasil`}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#00B9AD] bg-[#EDF8FA] px-5 py-2.5 text-sm font-semibold text-[#00857C] hover:bg-[#DCEEEF]"
              >
                Halaman Hasil &amp; Bagikan
              </Link>
            </div>

            <h2 className="text-sm font-bold text-[#0F292E]">
              Riwayat Kunjungan Antropometri ({measurements.length})
            </h2>
            {measurements.length === 0 ? (
              <EmptyState
                title="Belum Ada Riwayat Penimbangan"
                description="Balita ini telah terdaftar. Pencatatan kunjungan penimbangan dan grafik KMS akan tampil di bagian ini."
              />
            ) : (
              <ul className="space-y-2.5">
                {measurements.map((m) => {
                  const rowZScores = zscoresByMeasurement[m.id] ?? [];
                  return (
                    <li key={m.id}>
                      <Card variant="white" padding="md" className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-semibold tabular-nums text-gray-900">
                            Tanggal Ukur: {m.tgl_ukur}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-[#EDF8FA] px-2.5 py-0.5 text-[11px] font-semibold text-[#00857C]">
                              {m.sumber === "AI" ? "Foto KIA" : "Manual"}
                            </span>
                            <span className="text-xs font-medium tabular-nums text-gray-600">
                              Usia {m.usia_bulan} bln
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-700 tabular-nums">
                          <span>BB: <strong>{m.bb_kg} kg</strong></span>
                          {m.pb_tb_cm !== null && (
                            <span>PB/TB: <strong>{m.pb_tb_cm} cm</strong></span>
                          )}
                          {m.lk_cm !== null && (
                            <span>LK: <strong>{m.lk_cm} cm</strong></span>
                          )}
                          {m.lila_cm !== null && (
                            <span>LiLA: <strong>{m.lila_cm} cm</strong></span>
                          )}
                        </div>
                        {rowZScores.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#EDF8FA]">
                            {rowZScores.map((z, idx) => (
                              <span
                                key={`${z.indikator}-${idx}`}
                                className="rounded-lg bg-[#F7FBFC] border border-[#DCEEEF] px-2 py-1 text-[11px] text-[#0F292E] tabular-nums"
                              >
                                <strong>{z.indikator}</strong>:{" "}
                                {z.nilai_z !== null ? `${z.nilai_z.toFixed(2)} SD` : "-"} (
                                {z.klasifikasi})
                              </span>
                            ))}
                          </div>
                        )}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

