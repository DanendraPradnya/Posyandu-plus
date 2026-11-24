"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateAgeInMonths } from "@/lib/zscore/age";
import { BrandLogo, Card, ErrorBox, SkeletonCard, StatusBadge } from "@/components/ui";
import { HealthProfileCard } from "@/components/health/HealthProfileCard";
import { KmsChart } from "@/components/kms/KmsChart";
import { ShareLinkManager } from "@/components/share/ShareLinkManager";
import type {
  Child,
  EducationRecord,
  HealthProfile,
  Measurement,
  UserRole,
} from "@/lib/types";

const DEFAULT_DISCLAIMER =
  "Informasi ini bukan pengganti konsultasi dengan bidan atau dokter.";

export default function HalamanHasilAnakPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const childId = params.id;

  const [child, setChild] = useState<Child | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [education, setEducation] = useState<EducationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadResultData = useCallback(async () => {
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

      const { data: userRow } = await supabase
        .from("users")
        .select("peran, status_aktif")
        .eq("id", user.id)
        .maybeSingle();

      if (userRow && !userRow.status_aktif) {
        await supabase.auth.signOut();
        router.replace("/login?error=account_inactive");
        return;
      }

      if (userRow?.peran) {
        setUserRole(userRow.peran as UserRole);
      }

      const { data: childData, error: childErr } = await supabase
        .from("children")
        .select("*")
        .eq("id", childId)
        .maybeSingle();

      if (childErr) throw new Error(childErr.message);
      if (!childData) {
        setErrorMsg("Data balita tidak ditemukan atau berada di luar hak akses akun Anda.");
        return;
      }

      setChild(childData as Child);

      const [{ data: mRows }, { data: hpRow }, { data: eduRow }] = await Promise.all([
        supabase
          .from("measurements")
          .select("*")
          .eq("child_id", childId)
          .order("tgl_ukur", { ascending: true }),
        supabase
          .from("health_profiles")
          .select("*")
          .eq("child_id", childId)
          .order("dihitung_pada", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("education")
          .select("*")
          .eq("child_id", childId)
          .eq("status_review", "aktif")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setMeasurements((mRows ?? []) as Measurement[]);
      setHealthProfile((hpRow ?? null) as HealthProfile | null);
      setEducation((eduRow ?? null) as EducationRecord | null);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal memuat halaman hasil anak."
      );
    } finally {
      setIsLoading(false);
    }
  }, [childId, router]);

  useEffect(() => {
    void loadResultData();
  }, [loadResultData]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const ageMonths =
    child !== null ? Math.max(0, calculateAgeInMonths(child.tgl_lahir, todayIso)) : 0;

  const isParent = userRole === "orang_tua";
  const educationTips = Array.isArray(education?.tips) ? education.tips : [];

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

      {isLoading ? (
        <SkeletonCard count={2} lines={4} />
      ) : errorMsg || !child ? (
        <ErrorBox
          title="Halaman Hasil Tidak Tersedia"
          message={errorMsg ?? "Data balita tidak ditemukan."}
          onRetry={loadResultData}
        />
      ) : (
        <>
          <header className="bg-synora-mesh rounded-[24px] p-5 border border-[#C5E4E8] text-[#0F292E] shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <StatusBadge status={child.jenis_kelamin} />
              <span className="text-xs font-semibold tabular-nums text-[#00857C]">
                Usia: {ageMonths} bulan
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#0F292E]">
              Hasil Pertumbuhan &amp; Rekomendasi AI: {child.nama}
            </h1>
            <p className="text-xs text-[#4A666C]">
              {isParent
                ? "Ringkasan status gizi, grafik KMS, serta saran perawatan harian khusus untuk Ananda (akses baca)."
                : "Tampilan ini dapat diperlihatkan langsung kepada Orang Tua atau dibagikan melalui tautan aman di bawah."}
            </p>
          </header>

          <HealthProfileCard profile={healthProfile} />

          <KmsChart
            sex={child.jenis_kelamin}
            currentAgeMonths={ageMonths}
            measurements={measurements}
          />

          {/* Kartu Rekomendasi Edukasi AI (FR9) */}
          <Card variant="white" padding="md" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#0F292E]">
                Rekomendasi Gizi &amp; Perawatan AI
              </h2>
              {education && (
                <span className="rounded-full bg-[#EDF8FA] border border-[#C5E4E8] px-2.5 py-0.5 text-[11px] font-semibold text-[#00857C]">
                  {education.is_fallback_statis ? "Panduan Standar" : "Hasil AI"}
                </span>
              )}
            </div>

            {education?.anjuran_kritis_tetap && (
              <div
                role="alert"
                className="rounded-xl border border-red-300 bg-[#FEE2E2] p-3 text-xs font-semibold text-[#B91C1C]"
              >
                {education.anjuran_kritis_tetap}
              </div>
            )}

            {educationTips.length > 0 ? (
              <ol className="space-y-2.5">
                {educationTips.map((tip, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 rounded-xl border border-[#DCEEEF] bg-[#F7FBFC] p-3 text-xs sm:text-sm text-[#0F292E]"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#00B9AD] text-xs font-bold text-white tabular-nums">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="rounded-xl border border-dashed border-[#C5E4E8] bg-[#F7FBFC] p-4 text-xs text-[#4A666C]">
                Rekomendasi edukasi personal AI belum tersedia untuk kunjungan terbaru. Setelah pengukuran baru diproses, 3 saran gizi harian akan tampil otomatis di sini.
              </div>
            )}

            <p className="rounded-xl bg-[#EDF8FA] px-3 py-2 text-[11px] font-medium text-[#4A666C]">
              {education?.disclaimer ?? DEFAULT_DISCLAIMER}
            </p>
          </Card>

          {!isParent && <ShareLinkManager childId={child.id} />}
        </>
      )}
    </div>
  );
}
