"use client";

import React, { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Card } from "@/components/ui";
import { REF_KMS_LINE, getAccumulativeKbmGrams } from "@/lib/rules/ref-data";
import { LMS_TABLE, type LmsPoint } from "@/lib/zscore/lms-data";
import type { Measurement, Sex } from "@/lib/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export type KmsChartTab = "bbu" | "pbtbu" | "bbpbtb";

export interface KmsChartProps {
  sex: Sex;
  currentAgeMonths: number;
  measurements: Measurement[];
}

function valueFromLms(point: LmsPoint, z: number): number {
  const { L, M, S } = point;
  if (Math.abs(L) < 1e-6) {
    return Number((M * Math.exp(S * z)).toFixed(2));
  }
  const base = 1 + L * S * z;
  if (base <= 0) return Number(M.toFixed(2));
  return Number((M * Math.pow(base, 1 / L)).toFixed(2));
}

export function KmsChart({
  sex,
  currentAgeMonths,
  measurements,
}: KmsChartProps) {
  const [activeTab, setActiveTab] = useState<KmsChartTab>("bbu");
  const [kmsRange, setKmsRange] = useState<"0-2" | "2-5">(
    currentAgeMonths <= 24 ? "0-2" : "2-5"
  );

  const sortedMeasurements = useMemo(
    () =>
      [...measurements].sort((a, b) => a.tgl_ukur.localeCompare(b.tgl_ukur)),
    [measurements]
  );

  // Hitung status N/T per kunjungan untuk tooltip KMS BB/U
  const ntByMeasurementId = useMemo(() => {
    const map = new Map<string, "N" | "T" | "-">();
    for (let i = 0; i < sortedMeasurements.length; i++) {
      const curr = sortedMeasurements[i]!;
      if (i === 0) {
        map.set(curr.id, "-");
        continue;
      }
      const prev = sortedMeasurements[i - 1]!;
      const gainGram = Math.round((curr.bb_kg - prev.bb_kg) * 1000);
      const reqKbm = getAccumulativeKbmGrams(
        sex,
        prev.usia_bulan,
        curr.usia_bulan
      );
      map.set(curr.id, curr.bb_kg > prev.bb_kg && gainGram >= reqKbm ? "N" : "T");
    }
    return map;
  }, [sortedMeasurements, sex]);

  const primaryColor = sex === "M" ? "#0284C7" : "#DB2777";
  const primaryLight = sex === "M" ? "rgba(2, 132, 199, 0.15)" : "rgba(219, 39, 119, 0.15)";

  // -------------------------------------------------------------------------
  // Data Grafik 1: KMS BB/U Gaya Buku KIA
  // -------------------------------------------------------------------------
  const bbuData = useMemo(() => {
    const lines = REF_KMS_LINE.filter(
      (p) => p.sex === sex && p.chart === kmsRange
    );
    const minAge = kmsRange === "0-2" ? 0 : 25;
    const maxAge = kmsRange === "0-2" ? 24 : 60;

    const childPoints = sortedMeasurements
      .filter((m) => m.usia_bulan >= minAge && m.usia_bulan <= maxAge)
      .map((m) => ({
        x: m.usia_bulan,
        y: m.bb_kg,
        tgl: m.tgl_ukur,
        nt: ntByMeasurementId.get(m.id) ?? "-",
      }));

    return {
      datasets: [
        {
          label: "Berat Badan Anak (kg)",
          data: childPoints,
          borderColor: primaryColor,
          backgroundColor: primaryColor,
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.15,
        },
        {
          label: "Garis Oranye (+1 SD)",
          data: lines.map((p) => ({ x: p.ageMonth, y: p.orangeLineKg })),
          borderColor: "#F97316",
          backgroundColor: "rgba(249, 115, 22, 0.08)",
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0.3,
        },
        {
          label: "Garis Merah (-2 SD)",
          data: lines.map((p) => ({ x: p.ageMonth, y: p.redLineKg })),
          borderColor: "#DC2626",
          backgroundColor: "rgba(220, 38, 38, 0.08)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
        },
      ],
    };
  }, [sex, kmsRange, sortedMeasurements, ntByMeasurementId, primaryColor]);

  // -------------------------------------------------------------------------
  // Data Grafik 2: PB/TB menurut Usia (-3 s.d. +3 SD)
  // -------------------------------------------------------------------------
  const pbtbuData = useMemo(() => {
    const isUnder2 = kmsRange === "0-2";
    const key = `${isUnder2 ? "PB/U" : "TB/U"}_${sex}`;
    const rawLms = (LMS_TABLE[key] ?? []).filter((_, idx) => idx % 2 === 0);
    const minAge = isUnder2 ? 0 : 24;
    const maxAge = isUnder2 ? 24 : 60;

    const childPoints = sortedMeasurements
      .filter(
        (m) =>
          m.pb_tb_cm !== null && m.usia_bulan >= minAge && m.usia_bulan <= maxAge
      )
      .map((m) => ({ x: m.usia_bulan, y: m.pb_tb_cm! }));

    const sdLevels = [
      { z: 3, label: "+3 SD", color: "#94A3B8", dash: [4, 4] },
      { z: 2, label: "+2 SD", color: "#F59E0B", dash: [4, 4] },
      { z: 0, label: "Median (0 SD)", color: "#10B981", dash: [] },
      { z: -2, label: "-2 SD (Pendek)", color: "#F97316", dash: [4, 4] },
      { z: -3, label: "-3 SD (Sangat Pendek)", color: "#DC2626", dash: [] },
    ];

    return {
      datasets: [
        {
          label: "PB/TB Anak (cm)",
          data: childPoints,
          borderColor: primaryColor,
          backgroundColor: primaryColor,
          borderWidth: 2.5,
          pointRadius: 5,
          tension: 0.15,
        },
        ...sdLevels.map((sd) => ({
          label: sd.label,
          data: rawLms.map((p) => ({ x: p.x, y: valueFromLms(p, sd.z) })),
          borderColor: sd.color,
          borderWidth: sd.z === 0 || sd.z === -3 ? 2 : 1.5,
          borderDash: sd.dash,
          pointRadius: 0,
          tension: 0.25,
        })),
      ],
    };
  }, [sex, kmsRange, sortedMeasurements, primaryColor]);

  // -------------------------------------------------------------------------
  // Data Grafik 3: BB menurut PB/TB (-3 s.d. +3 SD)
  // -------------------------------------------------------------------------
  const bbpbtbData = useMemo(() => {
    const isUnder2 = kmsRange === "0-2";
    const key = `${isUnder2 ? "BB/PB" : "BB/TB"}_${sex}`;
    const rawLms = (LMS_TABLE[key] ?? []).filter((_, idx) => idx % 4 === 0);

    const childPoints = sortedMeasurements
      .filter((m) => m.pb_tb_cm !== null)
      .map((m) => ({ x: m.pb_tb_cm!, y: m.bb_kg }))
      .sort((a, b) => a.x - b.x);

    const sdLevels = [
      { z: 3, label: "+3 SD (Obesitas)", color: "#9333EA", dash: [4, 4] },
      { z: 2, label: "+2 SD (Gizi Lebih)", color: "#F59E0B", dash: [4, 4] },
      { z: 0, label: "Median (0 SD)", color: "#10B981", dash: [] },
      { z: -2, label: "-2 SD (Gizi Kurang)", color: "#F97316", dash: [4, 4] },
      { z: -3, label: "-3 SD (Gizi Buruk)", color: "#DC2626", dash: [] },
    ];

    return {
      datasets: [
        {
          label: "Pengukuran Anak",
          data: childPoints,
          borderColor: primaryColor,
          backgroundColor: primaryColor,
          borderWidth: 2.5,
          pointRadius: 5,
          tension: 0.15,
        },
        ...sdLevels.map((sd) => ({
          label: sd.label,
          data: rawLms.map((p) => ({ x: p.x, y: valueFromLms(p, sd.z) })),
          borderColor: sd.color,
          borderWidth: sd.z === 0 || sd.z === -3 ? 2 : 1.5,
          borderDash: sd.dash,
          pointRadius: 0,
          tension: 0.25,
        })),
      ],
    };
  }, [sex, kmsRange, sortedMeasurements, primaryColor]);

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              const raw = ctx.raw as { tgl?: string; nt?: string };
              if (raw?.tgl) {
                return `Tgl: ${raw.tgl} | Status KMS: ${raw.nt ?? "-"}`;
              }
              return undefined;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text:
              activeTab === "bbpbtb"
                ? "Panjang / Tinggi Badan (cm)"
                : "Usia (bulan)",
            font: { size: 11, weight: "bold" },
          },
        },
        y: {
          title: {
            display: true,
            text: activeTab === "pbtbu" ? "PB / TB (cm)" : "Berat Badan (kg)",
            font: { size: 11, weight: "bold" },
          },
        },
      },
    }),
    [activeTab]
  );

  return (
    <Card variant="white" padding="md" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[#0F292E]">
            KMS Digital ({sex === "M" ? "Laki-laki" : "Perempuan"})
          </h2>
          <p className="text-[11px] text-[#4A666C]">
            Standar Buku KIA &amp; Permenkes No. 2 Tahun 2020
          </p>
        </div>

        <div className="flex rounded-xl border border-[#C5E4E8] p-0.5 bg-[#F7FBFC]">
          <button
            type="button"
            onClick={() => setKmsRange("0-2")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg min-h-[48px] ${
              kmsRange === "0-2"
                ? "bg-[#00B9AD] text-white"
                : "text-[#4A666C]"
            }`}
          >
            0-24 Bln
          </button>
          <button
            type="button"
            onClick={() => setKmsRange("2-5")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg min-h-[48px] ${
              kmsRange === "2-5"
                ? "bg-[#00B9AD] text-white"
                : "text-[#4A666C]"
            }`}
          >
            25-60 Bln
          </button>
        </div>
      </div>

      {/* Tab Indikator */}
      <div role="tablist" aria-label="Pilih grafik indikator KMS" className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#EDF8FA] p-1">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "bbu"}
          onClick={() => setActiveTab("bbu")}
          className={`min-h-[48px] rounded-lg px-2 text-xs font-bold transition-colors ${
            activeTab === "bbu"
              ? "bg-white text-[#0F292E] shadow-sm"
              : "text-[#4A666C]"
          }`}
        >
          KMS BB/U
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "pbtbu"}
          onClick={() => setActiveTab("pbtbu")}
          className={`min-h-[48px] rounded-lg px-2 text-xs font-bold transition-colors ${
            activeTab === "pbtbu"
              ? "bg-white text-[#0F292E] shadow-sm"
              : "text-[#4A666C]"
          }`}
        >
          PB/TB per Usia
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "bbpbtb"}
          onClick={() => setActiveTab("bbpbtb")}
          className={`min-h-[48px] rounded-lg px-2 text-xs font-bold transition-colors ${
            activeTab === "bbpbtb"
              ? "bg-white text-[#0F292E] shadow-sm"
              : "text-[#4A666C]"
          }`}
        >
          BB per PB/TB
        </button>
      </div>

      <div
        className="h-[290px] w-full rounded-xl border border-[#DCEEEF] p-2"
        style={{ backgroundColor: primaryLight }}
      >
        <Line
          data={
            activeTab === "bbu"
              ? bbuData
              : activeTab === "pbtbu"
                ? pbtbuData
                : bbpbtbData
          }
          options={options}
        />
      </div>

      {/* Ringkasan N/T jika ada riwayat */}
      {activeTab === "bbu" && sortedMeasurements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {sortedMeasurements.map((m) => {
            const nt = ntByMeasurementId.get(m.id) ?? "-";
            return (
              <span
                key={m.id}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  nt === "N"
                    ? "bg-emerald-100 text-emerald-800"
                    : nt === "T"
                      ? "bg-amber-100 text-amber-900"
                      : "bg-gray-100 text-gray-700"
                }`}
              >
                Bln {m.usia_bulan}: {m.bb_kg} kg ({nt})
              </span>
            );
          })}
        </div>
      )}
    </Card>
  );
}

