"use client";

import React, { useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import {
  checkMeasurementAnomalies,
  validateMeasurementRow,
} from "@/lib/validation/measurement";
import type { Measurement, MeasurementMethod, Sex } from "@/lib/types";

export interface ManualMeasurementFormProps {
  childBirthDate: string;
  childSex?: Sex;
  previousMeasurements?: Measurement[];
  onSubmitManual: (row: {
    tgl_ukur: string;
    bb_kg: number;
    pb_tb_cm: number | null;
    cara_ukur: MeasurementMethod | null;
    lk_cm: number | null;
    lila_cm: number | null;
    imunisasi: string | null;
    asi_eksklusif: boolean | null;
  }) => Promise<void>;
  isSaving?: boolean;
  serverError?: string | null;
}

function getTodayIsoLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ManualMeasurementForm({
  childBirthDate,
  childSex = "M",
  previousMeasurements = [],
  onSubmitManual,
  isSaving = false,
  serverError = null,
}: ManualMeasurementFormProps) {
  const [tglUkur, setTglUkur] = useState(getTodayIsoLocal);
  const [bbKg, setBbKg] = useState("");
  const [pbTbCm, setPbTbCm] = useState("");
  const [caraUkur, setCaraUkur] = useState<MeasurementMethod | "">("");
  const [lkCm, setLkCm] = useState("");
  const [lilaCm, setLilaCm] = useState("");
  const [imunisasi, setImunisasi] = useState("");
  const [asiEksklusif, setAsiEksklusif] = useState<"" | "ya" | "tidak">("");
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [anomalyWarnings, setAnomalyWarnings] = useState<string[]>([]);
  const [anomalyConfirmed, setAnomalyConfirmed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors([]);

    const bbNum = bbKg.trim() ? Number(bbKg) : null;
    const pbNum = pbTbCm.trim() ? Number(pbTbCm) : null;
    const lkNum = lkCm.trim() ? Number(lkCm) : null;
    const lilaNum = lilaCm.trim() ? Number(lilaCm) : null;

    const rowInput = {
      tgl_ukur: tglUkur,
      bb_kg: bbNum,
      pb_tb_cm: pbNum,
      cara_ukur: caraUkur || null,
      lk_cm: lkNum,
      lila_cm: lilaNum,
      imunisasi: imunisasi.trim() || null,
      asi_eksklusif:
        asiEksklusif === "ya" ? true : asiEksklusif === "tidak" ? false : null,
    };

    const check = validateMeasurementRow(rowInput, childBirthDate);

    if (!check.valid || bbNum === null) {
      setFormErrors(check.errors);
      return;
    }

    const anomalyCheck = checkMeasurementAnomalies(
      rowInput,
      childBirthDate,
      childSex,
      previousMeasurements
    );

    if (anomalyCheck.hasAnomalies && !anomalyConfirmed) {
      setAnomalyWarnings(anomalyCheck.anomalyWarnings);
      return;
    }

    await onSubmitManual({
      tgl_ukur: tglUkur,
      bb_kg: bbNum,
      pb_tb_cm: pbNum,
      cara_ukur: caraUkur || null,
      lk_cm: lkNum,
      lila_cm: lilaNum,
      imunisasi: imunisasi.trim() || null,
      asi_eksklusif:
        asiEksklusif === "ya" ? true : asiEksklusif === "tidak" ? false : null,
    });
  };

  return (
    <Card variant="white" padding="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-[#0F292E]">
            Input Manual Pengukuran Antropometri
          </h2>
          <p className="text-xs text-[#4A666C]">
            Gunakan formulir ini jika foto KIA tidak tersedia, buram, atau kuota AI sedang penuh.
          </p>
        </div>

        <Input
          label="Tanggal Pengukuran *"
          type="date"
          value={tglUkur}
          onChange={(e) => setTglUkur(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Berat Badan (kg) *"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="Contoh: 8.4"
            value={bbKg}
            onChange={(e) => setBbKg(e.target.value)}
            helperText="Rentang wajar: 1 - 30 kg"
            required
          />

          <Input
            label="Panjang / Tinggi Badan (cm)"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="Contoh: 74.5"
            value={pbTbCm}
            onChange={(e) => setPbTbCm(e.target.value)}
            helperText="Rentang wajar: 40 - 130 cm"
          />
        </div>

        <div className="space-y-1.5 min-w-0">
          <label className="block text-sm font-medium text-[#0F292E]">
            Cara Ukur Panjang / Tinggi
          </label>
          <select
            value={caraUkur}
            onChange={(e) => setCaraUkur(e.target.value as MeasurementMethod | "")}
            className="w-full min-w-0 max-w-full min-h-[48px] truncate text-ellipsis rounded-xl border border-[#C5E4E8] bg-white pl-3.5 pr-8 py-2.5 text-base sm:text-sm text-[#0F292E]"
          >
            <option value="">Otomatis sesuai usia (&lt; 24 bln berbaring, &gt;= 24 bln berdiri)</option>
            <option value="berbaring">Berbaring (PB)</option>
            <option value="berdiri">Berdiri (TB)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
          <Input
            label="Lingkar Kepala (cm)"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="Contoh: 44.5"
            value={lkCm}
            onChange={(e) => setLkCm(e.target.value)}
          />

          <Input
            label="Lingkar Lengan Atas / LiLA (cm)"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="Contoh: 13.5"
            value={lilaCm}
            onChange={(e) => setLilaCm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
          <Input
            label="Catatan Imunisasi (Opsional)"
            type="text"
            placeholder="Contoh: Campak-Rubella"
            value={imunisasi}
            onChange={(e) => setImunisasi(e.target.value)}
          />

          <div className="space-y-1.5 min-w-0">
            <label className="block text-sm font-medium text-[#0F292E]">
              Status ASI Eksklusif
            </label>
            <select
              value={asiEksklusif}
              onChange={(e) =>
                setAsiEksklusif(e.target.value as "" | "ya" | "tidak")
              }
              className="w-full min-w-0 max-w-full min-h-[48px] truncate text-ellipsis rounded-xl border border-[#C5E4E8] bg-white pl-3.5 pr-8 py-2.5 text-base sm:text-sm text-[#0F292E]"
            >
              <option value="">Tidak tercatat</option>
              <option value="ya">Ya (ASI Eksklusif)</option>
              <option value="tidak">Tidak</option>
            </select>
          </div>
        </div>

        {anomalyWarnings.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 space-y-2">
            <p className="font-bold">Angka Anomali Terdeteksi - Mohon Cek Ulang</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {anomalyWarnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
            <label className="flex items-center gap-2.5 pt-1 font-semibold cursor-pointer min-h-[48px]">
              <input
                type="checkbox"
                checked={anomalyConfirmed}
                onChange={(e) => setAnomalyConfirmed(e.target.checked)}
                className="h-5 w-5 accent-amber-600 rounded"
              />
              <span>Saya sudah cek ulang buku KIA/timbangan, angka sudah benar</span>
            </label>
          </div>
        )}

        {(formErrors.length > 0 || serverError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1">
            {formErrors.map((err, idx) => (
              <p key={idx}>- {err}</p>
            ))}
            {serverError && <p>{serverError}</p>}
          </div>
        )}

        <Button type="submit" variant="primary" fullWidth isLoading={isSaving}>
          Simpan Pengukuran Manual
        </Button>
      </form>
    </Card>
  );
}

