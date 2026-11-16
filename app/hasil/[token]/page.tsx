import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { hashShareToken, maskChildName } from "@/lib/share/token";
import { calculateAgeInMonths } from "@/lib/zscore/age";
import { BrandLogo, Card, StatusBadge } from "@/components/ui";
import { HealthProfileCard } from "@/components/health/HealthProfileCard";
import { KmsChart } from "@/components/kms/KmsChart";
import type { HealthProfile, Measurement, Sex } from "@/lib/types";

export const metadata: Metadata = {
  title: "Hasil Pemantauan Pertumbuhan | Posyandu+",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export const dynamic = "force-dynamic";

function NeutralInvalidView() {
  return (
    <main className="min-h-screen px-4 py-10 flex items-center justify-center bg-[#F7FBFC]">
      <Card variant="white" padding="lg" className="max-w-md w-full text-center space-y-2">
        <h1 className="text-lg font-bold text-[#0F292E]">
          Tautan Tidak Tersedia
        </h1>
        <p className="text-sm text-[#4A666C]">
          Tautan hasil pemantauan ini tidak valid, telah kedaluwarsa, atau sudah dicabut oleh
          petugas Posyandu.
        </p>
      </Card>
    </main>
  );
}

/**
 * Halaman Hasil Anak Publik Read-Only via Token (FR13, Fase 3 - B10 & C9).
 * Tanpa login, diindeks noindex, dan tanpa PII (tanpa nama lengkap, NIK, atau kontak).
 */
export default async function PublicShareResultPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return <NeutralInvalidView />;
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return <NeutralInvalidView />;
  }

  const tokenHash = hashShareToken(token);
  const { data: link } = await adminClient
    .from("share_links")
    .select("id, child_id, expires_at, revoked_at, access_count")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!link) {
    return <NeutralInvalidView />;
  }

  const isRevoked = Boolean(link.revoked_at);
  const isExpired = new Date(link.expires_at).getTime() <= Date.now();
  if (isRevoked || isExpired) {
    return <NeutralInvalidView />;
  }

  // Catat akses tautan
  await adminClient
    .from("share_links")
    .update({
      access_count: (link.access_count ?? 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq("id", link.id);

  const [{ data: child }, { data: measurements }, { data: healthProfile }] =
    await Promise.all([
      adminClient
        .from("children")
        .select("nama, tgl_lahir, jenis_kelamin")
        .eq("id", link.child_id)
        .maybeSingle(),
      adminClient
        .from("measurements")
        .select("*")
        .eq("child_id", link.child_id)
        .order("tgl_ukur", { ascending: true }),
      adminClient
        .from("health_profiles")
        .select("*")
        .eq("child_id", link.child_id)
        .order("dihitung_pada", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!child) {
    return <NeutralInvalidView />;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const ageMonths = Math.max(0, calculateAgeInMonths(child.tgl_lahir, todayIso));
  const maskedName = maskChildName(child.nama);

  return (
    <main className="min-h-screen px-4 sm:px-6 py-5 space-y-5 pb-12 max-w-2xl mx-auto">
      <header className="bg-synora-mesh rounded-[24px] p-5 border border-[#C5E4E8] text-[#0F292E] shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <BrandLogo href={undefined} size="sm" subtitle="Hasil Pemantauan" />
          <div className="flex items-center gap-2">
            <StatusBadge status={child.jenis_kelamin as Sex} />
            <span className="text-xs font-semibold tabular-nums text-[#00857C]">
              Usia: {ageMonths} bulan
            </span>
          </div>
        </div>
        <h1 className="text-xl font-bold text-[#0F292E]">
          Hasil Pertumbuhan: {maskedName}
        </h1>
        <p className="text-xs text-[#4A666C]">
          Ringkasan pemantauan Posyandu+ (tautan hanya-baca, berlaku s.d.{" "}
          {link.expires_at.slice(0, 10)}).
        </p>
      </header>

      <HealthProfileCard profile={(healthProfile ?? null) as HealthProfile | null} />

      <KmsChart
        sex={child.jenis_kelamin as Sex}
        currentAgeMonths={ageMonths}
        measurements={(measurements ?? []) as Measurement[]}
      />

      <Card variant="white" padding="md" className="space-y-1.5">
        <h2 className="text-sm font-bold text-[#0F292E]">Catatan Penting</h2>
        <p className="text-xs text-[#4A666C]">
          Informasi ini merupakan hasil skrining awal Posyandu dan bukan pengganti konsultasi
          dengan bidan atau dokter.
        </p>
      </Card>
    </main>
  );
}

