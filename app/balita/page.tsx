"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateAgeInMonths } from "@/lib/zscore/age";
import type { OverallHealthStatus, Posyandu, Sex, UserProfile } from "@/lib/types";
import {
  Card,
  EmptyState,
  ErrorBox,
  SkeletonCard,
  StatCard,
  StatusBadge,
  Toast,
  type BadgeStatusType,
} from "@/components/ui";

interface ChildListItem {
  id: string;
  nama: string;
  tgl_lahir: string;
  jenis_kelamin: Sex;
  nama_ortu: string;
  banjar: string;
  posyandu_id: string;
  created_at: string;
  latestMeasureDate: string | null;
  latestWeightKg: number | null;
  latestStatus: OverallHealthStatus | null;
}

type SortOption = "terbaru" | "nama";

function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function DaftarBalitaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registeredParam = searchParams.get("registered");
  const deniedParam = searchParams.get("denied");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posyanduMap, setPosyanduMap] = useState<Record<string, Posyandu>>({});
  const [childrenList, setChildrenList] = useState<ChildListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("terbaru");

  const todayIso = useMemo(() => getTodayIso(), []);
  const currentYearMonth = useMemo(() => todayIso.slice(0, 7), [todayIso]);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

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

      const { data: userProfile, error: profileErr } = await supabase
        .from("users")
        .select("id, peran, nama, email, status_aktif, posyandu_ditugaskan")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr || !userProfile) {
        setErrorMsg("Gagal memuat profil petugas Posyandu+.");
        setIsLoading(false);
        return;
      }

      if (!userProfile.status_aktif) {
        await supabase.auth.signOut();
        router.replace("/login?error=account_inactive");
        return;
      }

      setProfile(userProfile as UserProfile);

      // Ambil daftar posyandu
      const { data: posyanduRows } = await supabase
        .from("posyandu")
        .select("id, nama, dusun_banjar, wilayah_puskesmas");

      const pMap: Record<string, Posyandu> = {};
      if (posyanduRows) {
        for (const p of posyanduRows) {
          pMap[p.id] = p as Posyandu;
        }
      }
      setPosyanduMap(pMap);

      // Ambil daftar balita sesuai RLS (Kader: posyandu sendiri, Bidan: semua posyandu)
      const { data: childrenRows, error: childrenErr } = await supabase
        .from("children")
        .select(
          "id, nama, tgl_lahir, jenis_kelamin, nama_ortu, banjar, posyandu_id, created_at"
        )
        .order("created_at", { ascending: false });

      if (childrenErr) {
        throw new Error(childrenErr.message);
      }

      const safeChildren = childrenRows ?? [];

      // Ambil pengukuran terbaru dan status kesehatan terbaru bila ada
      const childIds = safeChildren.map((c) => c.id);
      const latestMeasureByChild: Record<
        string,
        { tgl_ukur: string; bb_kg: number; id: string }
      > = {};
      const statusByMeasurement: Record<string, OverallHealthStatus> = {};

      if (childIds.length > 0) {
        const { data: measurementRows } = await supabase
          .from("measurements")
          .select("id, child_id, tgl_ukur, bb_kg")
          .in("child_id", childIds)
          .order("tgl_ukur", { ascending: false });

        if (measurementRows) {
          for (const m of measurementRows) {
            if (!latestMeasureByChild[m.child_id]) {
              latestMeasureByChild[m.child_id] = {
                id: m.id,
                tgl_ukur: m.tgl_ukur,
                bb_kg: Number(m.bb_kg),
              };
            }
          }
        }

        const latestMeasurementIds = Object.values(latestMeasureByChild).map(
          (m) => m.id
        );

        if (latestMeasurementIds.length > 0) {
          const { data: hpRows } = await supabase
            .from("health_profiles")
            .select("measurement_id, status_keseluruhan")
            .in("measurement_id", latestMeasurementIds);

          if (hpRows) {
            for (const hp of hpRows) {
              statusByMeasurement[hp.measurement_id] =
                hp.status_keseluruhan as OverallHealthStatus;
            }
          }
        }
      }

      const enriched: ChildListItem[] = safeChildren.map((child) => {
        const latestM = latestMeasureByChild[child.id];
        const latestStatus = latestM
          ? statusByMeasurement[latestM.id] ?? null
          : null;

        return {
          id: child.id,
          nama: child.nama,
          tgl_lahir: child.tgl_lahir,
          jenis_kelamin: child.jenis_kelamin as Sex,
          nama_ortu: child.nama_ortu,
          banjar: child.banjar,
          posyandu_id: child.posyandu_id,
          created_at: child.created_at,
          latestMeasureDate: latestM?.tgl_ukur ?? null,
          latestWeightKg: latestM?.bb_kg ?? null,
          latestStatus,
        };
      });

      setChildrenList(enriched);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil daftar balita."
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login?logged_out=1");
    } catch {
      setIsSigningOut(false);
    }
  }

  // Perhitungan metrik asli dari data basis data (tanpa angka fiktif)
  const metrics = useMemo(() => {
    const total = childrenList.length;
    const weighedThisMonth = childrenList.filter(
      (c) =>
        c.latestMeasureDate !== null &&
        c.latestMeasureDate.startsWith(currentYearMonth)
    ).length;
    const needsAttention = childrenList.filter(
      (c) =>
        c.latestStatus === "Waspada" ||
        c.latestStatus === "Berisiko" ||
        c.latestStatus === "Kritis"
    ).length;

    return { total, weighedThisMonth, needsAttention };
  }, [childrenList, currentYearMonth]);

  // Filter & pengurutan daftar anak
  const filteredChildren = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? childrenList.filter(
          (c) =>
            c.nama.toLowerCase().includes(query) ||
            c.nama_ortu.toLowerCase().includes(query) ||
            c.banjar.toLowerCase().includes(query)
        )
      : [...childrenList];

    filtered.sort((a, b) => {
      if (sortBy === "nama") {
        return a.nama.localeCompare(b.nama, "id");
      }
      const dateA = a.latestMeasureDate ?? a.created_at;
      const dateB = b.latestMeasureDate ?? b.created_at;
      return dateB.localeCompare(dateA);
    });

    return filtered;
  }, [childrenList, searchQuery, sortBy]);

  const assignedPosyanduName = useMemo(() => {
    if (!profile) return "Memuat Posyandu...";
    if (profile.peran === "bidan") {
      return "Seluruh Posyandu Wilayah Kerobokan";
    }
    if (profile.posyandu_ditugaskan && posyanduMap[profile.posyandu_ditugaskan]) {
      return posyanduMap[profile.posyandu_ditugaskan]?.nama ?? "Posyandu Ditugaskan";
    }
    return "Posyandu Wilayah";
  }, [profile, posyanduMap]);

  return (
    <div className="min-h-screen p-4 space-y-5 pb-10">
      {/* Area Header Synora Mesh (1 per layar) */}
      <header className="bg-synora-mesh rounded-2xl p-5 border border-gray-200/80 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <StatusBadge
              status="Normal"
              label={profile?.peran === "bidan" ? "Bidan Desa" : "Kader Posyandu"}
            />
            <span className="text-xs font-medium text-gray-700">
              {assignedPosyanduName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {profile?.peran === "bidan" && (
              <Link
                href="/bidan/kader"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
              >
                Kelola Kader
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-50"
            >
              {isSigningOut ? "Keluar..." : "Keluar"}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-[22px] font-bold tracking-tight text-gray-900">
            Daftar Balita Posyandu
          </h1>
          <p className="text-sm text-gray-700">
            {profile
              ? `Petugas aktif: ${profile.nama}`
              : "Memuat sesi petugas..."}
          </p>
        </div>
      </header>

      {registeredParam === "1" && (
        <Toast
          tone="success"
          message="Profil balita baru berhasil didaftarkan beserta persetujuan orang tua."
        />
      )}

      {deniedParam === "bidan_only" && (
        <Toast
          tone="warning"
          message="Halaman manajemen akun Kader hanya dapat diakses oleh Bidan Desa."
        />
      )}

      {/* 3 Kartu Metrik Ringkas (Data Asli) */}
      <section aria-label="Ringkasan Metrik Posyandu" className="grid grid-cols-3 gap-2.5">
        <StatCard
          value={isLoading ? 0 : metrics.total}
          label="Total Balita Terdaftar"
          tone="default"
        />
        <StatCard
          value={isLoading ? 0 : metrics.weighedThisMonth}
          label="Ditimbang Bulan Ini"
          tone="success"
        />
        <StatCard
          value={isLoading ? 0 : metrics.needsAttention}
          label="Perlu Perhatian"
          tone={metrics.needsAttention > 0 ? "warning" : "default"}
        />
      </section>

      {/* Tombol Utama Registrasi Balita Baru */}
      <div>
        <Link
          href="/balita/baru"
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-base font-medium text-white shadow-sm hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          <span>Daftarkan Balita Baru</span>
        </Link>
      </div>

      {/* Bar Pencarian dan Pengurutan */}
      <Card variant="white" padding="sm" className="space-y-3">
        <div>
          <label htmlFor="search-balita" className="sr-only">
            Cari nama balita, orang tua, atau banjar
          </label>
          <input
            id="search-balita"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama balita, orang tua, atau banjar..."
            className="w-full min-h-[48px] rounded-full border border-gray-300 bg-[#F8FAFC] px-4 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="sort-balita"
            className="text-xs font-medium text-gray-700 shrink-0"
          >
            Urutkan:
          </label>
          <select
            id="sort-balita"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="min-h-[48px] flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            <option value="terbaru">Kunjungan / Pendaftaran Terbaru</option>
            <option value="nama">Nama Balita (A - Z)</option>
          </select>
        </div>
      </Card>

      {/* Daftar Anak dengan 3 State Eksplisit: Loading, Error, Empty */}
      <section aria-label="Daftar Anak" className="space-y-3">
        {isLoading ? (
          <SkeletonCard count={4} lines={3} />
        ) : errorMsg ? (
          <ErrorBox
            title="Gagal Memuat Daftar Balita"
            message={errorMsg}
            onRetry={loadDashboardData}
          />
        ) : childrenList.length === 0 ? (
          <EmptyState
            title="Belum Ada Balita Terdaftar"
            description="Mulai pencatatan Posyandu dengan mendaftarkan profil balita pertama beserta persetujuan orang tua/wali."
            actionLabel="Daftarkan Balita Pertama"
            onAction={() => router.push("/balita/baru")}
          />
        ) : filteredChildren.length === 0 ? (
          <EmptyState
            title="Tidak Ditemukan Hasil Pencarian"
            description={`Tidak ada balita yang cocok dengan kata kunci "${searchQuery}".`}
            actionLabel="Reset Pencarian"
            onAction={() => setSearchQuery("")}
          />
        ) : (
          <ul className="space-y-3">
            {filteredChildren.map((child) => {
              let ageMonths = 0;
              try {
                ageMonths = Math.max(
                  0,
                  calculateAgeInMonths(child.tgl_lahir, todayIso)
                );
              } catch {
                ageMonths = 0;
              }

              const badgeStatus: BadgeStatusType =
                child.latestStatus ?? "Belum Diukur";

              return (
                <li key={child.id}>
                  <Link
                    href={`/balita/${child.id}`}
                    className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-base font-semibold text-gray-900">
                          {child.nama}
                        </h2>
                        <p className="mt-0.5 text-xs text-gray-600">
                          Orang Tua: {child.nama_ortu} • {child.banjar}
                        </p>
                      </div>
                      <StatusBadge status={badgeStatus} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5 text-xs text-gray-700">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={child.jenis_kelamin} />
                        <span className="font-semibold tabular-nums text-gray-900">
                          {ageMonths} bulan
                        </span>
                      </div>

                      <div className="text-right tabular-nums text-gray-600">
                        {child.latestMeasureDate ? (
                          <span>
                            Ukur terakhir: {child.latestMeasureDate} (
                            {child.latestWeightKg} kg)
                          </span>
                        ) : (
                          <span>Belum ada kunjungan ukur</span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function DaftarBalitaPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4">
          <SkeletonCard count={4} lines={3} />
        </div>
      }
    >
      <DaftarBalitaContent />
    </Suspense>
  );
}

