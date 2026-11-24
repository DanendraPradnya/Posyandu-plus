"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateAgeInMonths } from "@/lib/zscore/age";
import type { OverallHealthStatus, Posyandu, Sex, UserProfile } from "@/lib/types";
import {
  BrandLogo,
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

      if (!user) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          router.replace("/login");
          return;
        }
        throw new Error(
          authErr?.message ??
            "Gagal memverifikasi sesi karena kendala jaringan. Silakan coba lagi."
        );
      }

      const { data: userProfile, error: profileErr } = await supabase
        .from("users")
        .select("id, peran, nama, email, status_aktif, posyandu_ditugaskan")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr || !userProfile) {
        setErrorMsg("Gagal memuat profil pengguna Posyandu+.");
        setIsLoading(false);
        return;
      }

      if (userProfile.status_aktif === false) {
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
    if (profile.peran === "orang_tua") {
      return "Portal Perkembangan Anak (Akses Baca)";
    }
    if (profile.peran === "bidan") {
      return "Seluruh Posyandu Wilayah Kerobokan";
    }
    if (profile.posyandu_ditugaskan && posyanduMap[profile.posyandu_ditugaskan]) {
      return posyanduMap[profile.posyandu_ditugaskan]?.nama ?? "Posyandu Ditugaskan";
    }
    return "Posyandu Wilayah";
  }, [profile, posyanduMap]);

  const isParent = profile?.peran === "orang_tua";
  const roleLabel =
    profile?.peran === "bidan"
      ? "Bidan Desa"
      : profile?.peran === "orang_tua"
        ? "Orang Tua / Wali"
        : "Kader Posyandu";

  return (
    <div className="min-h-screen px-4 sm:px-6 py-4 sm:py-5 space-y-6 pb-14">
      {/* Area Header Klinis (1 per layar) */}
      <header className="bg-synora-mesh relative overflow-hidden rounded-[24px] p-4 sm:p-6 border border-[#C5E4E8] text-[#0F292E] shadow-sm space-y-5">
        {/* Top Floating Pill Navbar */}
        <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-3 rounded-full bg-white/95 backdrop-blur-md border border-[#D5ECEF] px-3 sm:px-4 py-1.5 text-[#0F292E] shadow-[0_1px_2px_rgba(15,41,46,0.04)] min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo href="/" size="md" />
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#EDF8FA] border border-[#C5E4E8] px-2.5 py-0.5 text-[11px] font-semibold text-[#00857C]">
              {roleLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {profile?.peran === "bidan" && (
              <Link
                href="/bidan/kader"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#C5E4E8] bg-white px-3.5 sm:px-4 text-xs font-semibold text-[#0F292E] hover:bg-[#EDF8FA] whitespace-nowrap"
              >
                Kelola Kader
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#0F292E] px-3.5 sm:px-4 text-xs font-semibold text-white hover:bg-[#1E4249] disabled:opacity-50 whitespace-nowrap"
            >
              {isSigningOut ? "Keluar..." : "Keluar"}
            </button>
          </div>
        </div>

        {/* Hero Main Split */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-7 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#00857C]">
              {assignedPosyanduName} •{" "}
              {profile
                ? `${isParent ? "Akun" : "Petugas"}: ${profile.nama}`
                : "Memuat sesi..."}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F292E]">
              {isParent
                ? "Perkembangan Balita Saya"
                : "Daftar Balita & Pemantauan Gizi"}
            </h1>
            <div className="pt-1 flex flex-wrap items-center gap-2.5">
              {!isParent && (
                <Link
                  href="/balita/baru"
                  className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full bg-[#00B9AD] px-5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#009E94]"
                >
                  <span aria-hidden="true" className="text-sm leading-none">+</span>
                  <span>Daftarkan Balita Baru</span>
                </Link>
              )}
              <Link
                href="/"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#C5E4E8] bg-white px-4 text-xs font-semibold text-[#0F292E] transition-colors hover:bg-[#EDF8FA]"
              >
                Beranda
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <StatCard
              value={isLoading ? 0 : metrics.total}
              label="Total Balita"
              tone="default"
            />
            <StatCard
              value={isLoading ? 0 : metrics.weighedThisMonth}
              label="Ditimbang Bln Ini"
              tone="success"
            />
            <div className="col-span-2 sm:col-span-1">
              <StatCard
                value={isLoading ? 0 : metrics.needsAttention}
                label="Perlu Perhatian"
                tone={metrics.needsAttention > 0 ? "warning" : "default"}
              />
            </div>
          </div>
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

      {deniedParam === "parent_readonly" && (
        <Toast
          tone="warning"
          message="Akun Orang Tua/Wali hanya memiliki akses baca. Input atau perubahan data balita dilakukan oleh Kader Posyandu atau Bidan Desa."
        />
      )}

      {/* Bar Pencarian dan Pengurutan (hanya tampil jika relevan bagi data & peran) */}
      {!isLoading && !errorMsg && childrenList.length > 0 && (!isParent || childrenList.length > 1) && (
        <Card
          variant="white"
          padding="sm"
          className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0 overflow-hidden"
        >
          <div className="flex-1 min-w-0">
            <label htmlFor="search-balita" className="sr-only">
              Cari nama balita, orang tua, atau banjar
            </label>
            <input
              id="search-balita"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama balita, orang tua, atau banjar..."
              className="w-full min-w-0 max-w-full min-h-[48px] rounded-full border border-[#C5E4E8] bg-[#F7FBFC] px-4 text-base sm:text-sm text-[#0F292E] placeholder:text-[#7A969C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B9AD]"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-72 md:shrink-0 min-w-0">
            <label
              htmlFor="sort-balita"
              className="text-xs font-semibold text-[#4A666C] shrink-0"
            >
              Urutkan:
            </label>
            <select
              id="sort-balita"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="min-h-[48px] w-full min-w-0 max-w-full flex-1 truncate text-ellipsis rounded-full border border-[#C5E4E8] bg-white pl-3.5 pr-8 text-base sm:text-sm font-medium text-[#0F292E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B9AD]"
            >
              <option value="terbaru">Kunjungan / Pendaftaran Terbaru</option>
              <option value="nama">Nama Balita (A - Z)</option>
            </select>
          </div>
        </Card>
      )}

      {/* Daftar Anak dengan 3 State Eksplisit: Loading, Error, Empty */}
      <section aria-label="Daftar Anak" className="space-y-3.5">
        {isLoading ? (
          <SkeletonCard count={3} lines={3} />
        ) : errorMsg ? (
          <ErrorBox
            title="Gagal Memuat Daftar Balita"
            message={errorMsg}
            onRetry={loadDashboardData}
          />
        ) : childrenList.length === 0 ? (
          isParent ? (
            <EmptyState
              title="Belum Ada Data Balita Tertaut"
              description="Akun Orang Tua/Wali Anda belum ditautkan ke profil balita mana pun. Hubungi Kader Posyandu atau Bidan Desa untuk menautkan akun Anda."
            />
          ) : (
            <EmptyState
              title="Belum Ada Balita Terdaftar"
              description="Mulai pencatatan Posyandu dengan mendaftarkan profil balita pertama beserta persetujuan orang tua/wali."
              actionLabel="Daftarkan Balita Pertama"
              onAction={() => router.push("/balita/baru")}
            />
          )
        ) : filteredChildren.length === 0 ? (
          <EmptyState
            title="Tidak Ditemukan Hasil Pencarian"
            description={`Tidak ada balita yang cocok dengan kata kunci "${searchQuery}".`}
            actionLabel="Reset Pencarian"
            onAction={() => setSearchQuery("")}
          />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
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
                    className="flex h-full flex-col justify-between rounded-2xl border border-[#D5ECEF] bg-white p-4 shadow-[0_1px_2px_rgba(15,41,46,0.03)] transition-all hover:border-[#60C0D0] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B9AD]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-bold text-[#0F292E]">
                          {child.nama}
                        </h2>
                        <p className="mt-0.5 text-xs text-[#4A666C]">
                          Orang Tua: {child.nama_ortu} • {child.banjar}
                        </p>
                      </div>
                      <StatusBadge status={badgeStatus} />
                    </div>

                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#EDF8FA] pt-2.5 text-xs text-[#4A666C]">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={child.jenis_kelamin} />
                        <span className="font-semibold tabular-nums text-[#0F292E]">
                          {ageMonths} bln
                        </span>
                      </div>

                      <div className="text-right tabular-nums text-[11px] text-[#4A666C]">
                        {child.latestMeasureDate ? (
                          <span>
                            {child.latestMeasureDate} ({child.latestWeightKg} kg)
                          </span>
                        ) : (
                          <span>Belum diukur</span>
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

