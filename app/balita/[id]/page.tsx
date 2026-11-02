"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateAgeInMonths } from "@/lib/zscore/age";
import type { Child, Measurement, Posyandu } from "@/lib/types";
import {
  Card,
  EmptyState,
  ErrorBox,
  SkeletonCard,
  StatusBadge,
} from "@/components/ui";

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

      setMeasurements((mRows ?? []) as Measurement[]);
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
    <div className="min-h-screen p-4 space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <Link
          href="/balita"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
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
          <header className="bg-synora-mesh rounded-2xl p-5 border border-gray-200/80 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <StatusBadge status={child.jenis_kelamin} />
              <span className="text-xs font-semibold tabular-nums text-gray-800">
                Usia: {ageMonths} bulan
              </span>
            </div>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-gray-900">
                {child.nama}
              </h1>
              <p className="text-sm text-gray-700">
                Tanggal Lahir: <span className="tabular-nums font-medium">{child.tgl_lahir}</span>
              </p>
            </div>
          </header>

          <Card variant="white" padding="md" className="space-y-2.5">
            <h2 className="text-base font-semibold text-gray-900">
              Informasi Keluarga &amp; Posyandu
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between border-b border-gray-100 pb-1.5">
                <dt className="text-gray-600">Nama Orang Tua / Wali</dt>
                <dd className="font-medium text-gray-900">{child.nama_ortu}</dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1.5">
                <dt className="text-gray-600">Banjar / Dusun</dt>
                <dd className="font-medium text-gray-900">{child.banjar}</dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1.5">
                <dt className="text-gray-600">Posyandu</dt>
                <dd className="font-medium text-gray-900">
                  {posyandu?.nama ?? child.posyandu_id}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Persetujuan UU PDP</dt>
                <dd className="font-medium text-[#15803D] tabular-nums">
                  Tercatat ({child.consent_at.slice(0, 10)})
                </dd>
              </div>
            </dl>
          </Card>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900">
              Riwayat Kunjungan Antropometri ({measurements.length})
            </h2>
            {measurements.length === 0 ? (
              <EmptyState
                title="Belum Ada Riwayat Penimbangan"
                description="Balita ini telah terdaftar. Pencatatan kunjungan penimbangan dan grafik KMS akan tampil di bagian ini."
              />
            ) : (
              <ul className="space-y-2.5">
                {measurements.map((m) => (
                  <li key={m.id}>
                    <Card variant="white" padding="md" className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold tabular-nums text-gray-900">
                          Tanggal Ukur: {m.tgl_ukur}
                        </span>
                        <span className="text-xs font-medium tabular-nums text-gray-600">
                          Usia {m.usia_bulan} bln
                        </span>
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
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

