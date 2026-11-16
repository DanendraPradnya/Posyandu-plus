"use client";

import React from "react";
import { Card } from "@/components/ui";
import { CRITICAL_FIXED_TEMPLATE } from "@/lib/rules";
import type { HealthProfile, OverallHealthStatus } from "@/lib/types";

export interface HealthProfileCardProps {
  profile: HealthProfile | null;
}

const STATUS_STYLE: Record<
  OverallHealthStatus,
  { bg: string; border: string; badge: string; label: string }
> = {
  Normal: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    badge: "bg-emerald-600 text-white",
    label: "Normal (Hijau)",
  },
  Waspada: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    badge: "bg-amber-500 text-white",
    label: "Waspada (Kuning)",
  },
  Berisiko: {
    bg: "bg-orange-50",
    border: "border-orange-300",
    badge: "bg-orange-600 text-white",
    label: "Berisiko (Oranye)",
  },
  Kritis: {
    bg: "bg-red-50",
    border: "border-red-300",
    badge: "bg-red-600 text-white",
    label: "Kritis (Merah)",
  },
};

export function HealthProfileCard({ profile }: HealthProfileCardProps) {
  if (!profile) {
    return (
      <Card variant="white" padding="md" className="space-y-1">
        <h2 className="text-sm font-bold text-[#0F292E]">
          Profil Kesehatan Balita
        </h2>
        <p className="text-xs text-[#4A666C]">
          Belum ada profil kesehatan. Catat minimal satu pengukuran untuk melihat status gizi
          dan deteksi dini risiko stunting.
        </p>
      </Card>
    );
  }

  const style = STATUS_STYLE[profile.status_keseluruhan] ?? STATUS_STYLE.Normal;
  const indicators = Object.values(profile.status_per_indikator ?? {}).filter(
    (z): z is NonNullable<typeof z> => Boolean(z)
  );

  return (
    <Card variant="white" padding="md" className="space-y-3">
      <div className={`rounded-2xl border p-3.5 space-y-2 ${style.bg} ${style.border}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-[#0F292E]">
            Status Kesehatan Keseluruhan
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${style.badge}`}>
            {style.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-[#0F292E]">
          <span>
            Tren BB: <strong>{profile.tren_bb ?? "-"}</strong>
          </span>
          {profile.status_lila && (
            <span>
              Skrining LiLA: <strong>{profile.status_lila}</strong>
            </span>
          )}
        </div>
      </div>

      {profile.status_keseluruhan === "Kritis" && (
        <div className="rounded-xl border border-red-300 bg-red-600 p-3 text-xs font-semibold text-white">
          {CRITICAL_FIXED_TEMPLATE}
        </div>
      )}

      {profile.aturan_terpicu && profile.aturan_terpicu.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-[#0F292E]">
            Alasan &amp; Peringatan Terpicu ({profile.aturan_terpicu.length})
          </h3>
          <ul className="space-y-1.5">
            {profile.aturan_terpicu.map((rule) => (
              <li
                key={rule.kode}
                className="rounded-xl border border-[#DCEEEF] bg-[#F7FBFC] p-2.5 text-xs text-[#0F292E]"
              >
                <span className="font-bold mr-1.5">[{rule.kode} - {rule.tingkat}]</span>
                <span>{rule.alasan_awam}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {indicators.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-[#0F292E]">
            Status Per Indikator (Pengukuran Terbaru)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {indicators.map((z) => (
              <div
                key={z.indikator}
                className="rounded-xl border border-[#DCEEEF] bg-white p-2.5 text-xs space-y-0.5"
              >
                <div className="flex items-center justify-between font-bold text-[#0F292E]">
                  <span>{z.indikator}</span>
                  <span className="tabular-nums">
                    {z.nilai_z !== null ? `${z.nilai_z.toFixed(2)} SD` : "-"}
                  </span>
                </div>
                <p className="text-[11px] text-[#00857C] font-semibold">
                  {z.klasifikasi}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

