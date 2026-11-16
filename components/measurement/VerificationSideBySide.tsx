"use client";

import React, { useState } from "react";
import { Button, Card } from "@/components/ui";
import { PLAUSIBILITY_LIMITS } from "@/lib/ai/extraction-schema";
import type { ExtractedVisitRow, MeasurementMethod } from "@/lib/types";

export interface EditableVerifiedRow {
  baris_index: number;
  selected: boolean;
  is_duplicate: boolean;
  plausibility_warnings: string[];
  tgl_ukur: string;
  bb_kg: string;
  pb_tb_cm: string;
  cara_ukur: MeasurementMethod | "";
  lk_cm: string;
  lila_cm: string;
  imunisasi: string;
  asi_eksklusif: "" | "ya" | "tidak";
  confidences: {
    tgl_ukur: number;
    bb_kg: number;
    pb_tb_cm: number;
    cara_ukur: number;
    lk_cm: number;
    lila_cm: number;
  };
}

export interface VerificationSideBySideProps {
  photoUrl: string;
  rows: ExtractedVisitRow[];
  budgetWarning?: boolean;
  onConfirmSave: (
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
  ) => Promise<void>;
  onSwitchToManual: () => void;
  onRetakePhoto: () => void;
  isSaving?: boolean;
  saveError?: string | null;
}

function toEditableRows(rows: ExtractedVisitRow[]): EditableVerifiedRow[] {
  return rows.map((row) => ({
    baris_index: row.baris_index,
    selected: !row.is_duplicate,
    is_duplicate: Boolean(row.is_duplicate),
    plausibility_warnings: row.plausibility_warnings ?? [],
    tgl_ukur: row.tgl_ukur.value ?? "",
    bb_kg: row.bb_kg.value !== null ? String(row.bb_kg.value) : "",
    pb_tb_cm: row.pb_tb_cm.value !== null ? String(row.pb_tb_cm.value) : "",
    cara_ukur: row.cara_ukur.value ?? "",
    lk_cm: row.lk_cm.value !== null ? String(row.lk_cm.value) : "",
    lila_cm: row.lila_cm.value !== null ? String(row.lila_cm.value) : "",
    imunisasi: row.imunisasi.value ?? "",
    asi_eksklusif:
      row.asi_eksklusif.value === true
        ? "ya"
        : row.asi_eksklusif.value === false
          ? "tidak"
          : "",
    confidences: {
      tgl_ukur: row.tgl_ukur.confidence,
      bb_kg: row.bb_kg.confidence,
      pb_tb_cm: row.pb_tb_cm.confidence,
      cara_ukur: row.cara_ukur.confidence,
      lk_cm: row.lk_cm.confidence,
      lila_cm: row.lila_cm.confidence,
    },
  }));
}

function isLowConf(score: number, hasValue: boolean): boolean {
  return hasValue && score < PLAUSIBILITY_LIMITS.LOW_CONFIDENCE_THRESHOLD;
}

function isOutOfRange(valStr: string, min: number, max: number): boolean {
  if (!valStr.trim()) return false;
  const num = Number(valStr);
  return Number.isNaN(num) || num < min || num > max;
}

export function VerificationSideBySide({
  photoUrl,
  rows,
  budgetWarning = false,
  onConfirmSave,
  onSwitchToManual,
  onRetakePhoto,
  isSaving = false,
  saveError = null,
}: VerificationSideBySideProps) {
  const [editableRows, setEditableRows] = useState<EditableVerifiedRow[]>(() =>
    toEditableRows(rows)
  );
  const [zoomed, setZoomed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const updateRow = (idx: number, patch: Partial<EditableVerifiedRow>) => {
    setEditableRows((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const chosen = editableRows.filter((r) => r.selected);
    if (chosen.length === 0) {
      setLocalError("Pilih minimal satu baris pengukuran untuk disimpan.");
      return;
    }

    const parsed = [];
    for (const r of chosen) {
      if (!r.tgl_ukur.trim()) {
        setLocalError(`Baris #${r.baris_index}: Tanggal ukur wajib diisi.`);
        return;
      }
      const bb = Number(r.bb_kg);
      if (!r.bb_kg.trim() || Number.isNaN(bb)) {
        setLocalError(`Baris #${r.baris_index}: Berat badan (kg) wajib berupa angka.`);
        return;
      }

      parsed.push({
        baris_index: r.baris_index,
        tgl_ukur: r.tgl_ukur.trim(),
        bb_kg: bb,
        pb_tb_cm: r.pb_tb_cm.trim() ? Number(r.pb_tb_cm) : null,
        cara_ukur: r.cara_ukur ? r.cara_ukur : null,
        lk_cm: r.lk_cm.trim() ? Number(r.lk_cm) : null,
        lila_cm: r.lila_cm.trim() ? Number(r.lila_cm) : null,
        imunisasi: r.imunisasi.trim() || null,
        asi_eksklusif:
          r.asi_eksklusif === "ya"
            ? true
            : r.asi_eksklusif === "tidak"
              ? false
              : null,
      });
    }

    await onConfirmSave(parsed);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-[#C5E4E8] bg-[#EDF8FA] p-3.5 text-xs text-[#0F292E] space-y-1">
        <p className="font-bold">Verifikasi Kader Wajib (Human-in-the-Loop)</p>
        <p className="text-[#4A666C]">
          Cocokkan angka hasil ekstraksi AI dengan foto asli Buku KIA. Kolom berwarna kuning
          menandakan keyakinan AI rendah dan perlu dicek ulang.
        </p>
      </div>

      {budgetWarning && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Peringatan: Penggunaan anggaran ekstraksi AI bulan ini telah melampaui 70%.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* Panel Kiri / Atas: Foto Asli KIA */}
        <Card variant="white" padding="sm" className="space-y-2 md:sticky md:top-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[#0F292E]">Foto Buku KIA Asli</span>
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              className="text-xs font-semibold text-[#00857C] hover:underline min-h-[36px] px-2"
            >
              {zoomed ? "Perkecil" : "Perbesar"}
            </button>
          </div>
          <div className="overflow-auto rounded-xl border border-[#DCEEEF] bg-black/5 max-h-[380px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt="Foto Buku KIA untuk verifikasi"
              className={
                zoomed
                  ? "w-[160%] max-w-none object-contain"
                  : "w-full max-h-[340px] object-contain mx-auto"
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              fullWidth
              onClick={onRetakePhoto}
            >
              Foto Ulang
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              fullWidth
              onClick={onSwitchToManual}
            >
              Input Manual
            </Button>
          </div>
        </Card>

        {/* Panel Kanan / Bawah: Daftar Baris Kunjungan */}
        <div className="space-y-3">
          {editableRows.length === 0 ? (
            <Card variant="white" padding="md" className="space-y-3 text-center">
              <p className="text-sm font-semibold text-[#0F292E]">
                Tidak ada baris pengukuran yang terbaca dari foto.
              </p>
              <Button type="button" variant="primary" fullWidth onClick={onSwitchToManual}>
                Lanjut ke Input Manual
              </Button>
            </Card>
          ) : (
            editableRows.map((row, idx) => {
              const bbOut = isOutOfRange(
                row.bb_kg,
                PLAUSIBILITY_LIMITS.BB_KG_MIN,
                PLAUSIBILITY_LIMITS.BB_KG_MAX
              );
              const pbOut = isOutOfRange(
                row.pb_tb_cm,
                PLAUSIBILITY_LIMITS.PB_TB_CM_MIN,
                PLAUSIBILITY_LIMITS.PB_TB_CM_MAX
              );
              const lkOut = isOutOfRange(
                row.lk_cm,
                PLAUSIBILITY_LIMITS.LK_CM_MIN,
                PLAUSIBILITY_LIMITS.LK_CM_MAX
              );
              const lilaOut = isOutOfRange(row.lila_cm, 5.0, 30.0);

              return (
                <Card key={row.baris_index} variant="white" padding="md" className="space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-[#EDF8FA] pb-2">
                    <label className="flex items-center gap-2.5 text-sm font-bold text-[#0F292E] min-h-[48px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        disabled={row.is_duplicate}
                        onChange={(e) =>
                          updateRow(idx, { selected: e.target.checked })
                        }
                        className="h-5 w-5 accent-[#00B9AD] rounded"
                      />
                      <span>Baris Kunjungan #{row.baris_index}</span>
                    </label>

                    {row.is_duplicate && (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                        Duplikat Tanggal
                      </span>
                    )}
                  </div>

                  {row.plausibility_warnings.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 space-y-0.5">
                      {row.plausibility_warnings.map((w, wIdx) => (
                        <p key={wIdx}>- {w}</p>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Tanggal Ukur */}
                    <label className="space-y-1">
                      <span className="font-semibold text-[#0F292E] flex justify-between">
                        <span>Tanggal Ukur *</span>
                        {isLowConf(row.confidences.tgl_ukur, Boolean(row.tgl_ukur)) && (
                          <span className="text-amber-700">Ragu</span>
                        )}
                      </span>
                      <input
                        type="date"
                        value={row.tgl_ukur}
                        onChange={(e) => updateRow(idx, { tgl_ukur: e.target.value })}
                        className={`w-full min-h-[48px] rounded-xl border px-3 text-sm tabular-nums ${
                          isLowConf(row.confidences.tgl_ukur, Boolean(row.tgl_ukur))
                            ? "border-amber-400 bg-amber-50"
                            : "border-[#C5E4E8] bg-white"
                        }`}
                      />
                    </label>

                    {/* Berat Badan */}
                    <label className="space-y-1">
                      <span className="font-semibold text-[#0F292E] flex justify-between">
                        <span>Berat Badan (kg) *</span>
                        {isLowConf(row.confidences.bb_kg, Boolean(row.bb_kg)) && (
                          <span className="text-amber-700">Ragu</span>
                        )}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={row.bb_kg}
                        onChange={(e) => updateRow(idx, { bb_kg: e.target.value })}
                        className={`w-full min-h-[48px] rounded-xl border px-3 text-sm tabular-nums ${
                          bbOut
                            ? "border-red-500 bg-red-50"
                            : isLowConf(row.confidences.bb_kg, Boolean(row.bb_kg))
                              ? "border-amber-400 bg-amber-50"
                              : "border-[#C5E4E8] bg-white"
                        }`}
                      />
                    </label>

                    {/* Panjang / Tinggi Badan */}
                    <label className="space-y-1">
                      <span className="font-semibold text-[#0F292E] flex justify-between">
                        <span>PB / TB (cm)</span>
                        {isLowConf(row.confidences.pb_tb_cm, Boolean(row.pb_tb_cm)) && (
                          <span className="text-amber-700">Ragu</span>
                        )}
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        value={row.pb_tb_cm}
                        onChange={(e) => updateRow(idx, { pb_tb_cm: e.target.value })}
                        className={`w-full min-h-[48px] rounded-xl border px-3 text-sm tabular-nums ${
                          pbOut
                            ? "border-red-500 bg-red-50"
                            : isLowConf(row.confidences.pb_tb_cm, Boolean(row.pb_tb_cm))
                              ? "border-amber-400 bg-amber-50"
                              : "border-[#C5E4E8] bg-white"
                        }`}
                      />
                    </label>

                    {/* Cara Ukur */}
                    <label className="space-y-1">
                      <span className="font-semibold text-[#0F292E]">Cara Ukur</span>
                      <select
                        value={row.cara_ukur}
                        onChange={(e) =>
                          updateRow(idx, {
                            cara_ukur: e.target.value as MeasurementMethod | "",
                          })
                        }
                        className="w-full min-h-[48px] rounded-xl border border-[#C5E4E8] bg-white px-3 text-sm"
                      >
                        <option value="">Otomatis sesuai usia</option>
                        <option value="berbaring">Berbaring (PB)</option>
                        <option value="berdiri">Berdiri (TB)</option>
                      </select>
                    </label>

                    {/* Lingkar Kepala */}
                    <label className="space-y-1">
                      <span className="font-semibold text-[#0F292E]">Lingkar Kepala (cm)</span>
                      <input
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        value={row.lk_cm}
                        onChange={(e) => updateRow(idx, { lk_cm: e.target.value })}
                        className={`w-full min-h-[48px] rounded-xl border px-3 text-sm tabular-nums ${
                          lkOut
                            ? "border-red-500 bg-red-50"
                            : isLowConf(row.confidences.lk_cm, Boolean(row.lk_cm))
                              ? "border-amber-400 bg-amber-50"
                              : "border-[#C5E4E8] bg-white"
                        }`}
                      />
                    </label>

                    {/* LiLA */}
                    <label className="space-y-1">
                      <span className="font-semibold text-[#0F292E]">LiLA (cm)</span>
                      <input
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        value={row.lila_cm}
                        onChange={(e) => updateRow(idx, { lila_cm: e.target.value })}
                        className={`w-full min-h-[48px] rounded-xl border px-3 text-sm tabular-nums ${
                          lilaOut
                            ? "border-red-500 bg-red-50"
                            : isLowConf(row.confidences.lila_cm, Boolean(row.lila_cm))
                              ? "border-amber-400 bg-amber-50"
                              : "border-[#C5E4E8] bg-white"
                        }`}
                      />
                    </label>

                    {/* Imunisasi */}
                    <label className="space-y-1">
                      <span className="font-semibold text-[#0F292E]">Imunisasi</span>
                      <input
                        type="text"
                        value={row.imunisasi}
                        onChange={(e) => updateRow(idx, { imunisasi: e.target.value })}
                        placeholder="Contoh: DPT-HB-Hib 2"
                        className="w-full min-h-[48px] rounded-xl border border-[#C5E4E8] bg-white px-3 text-sm"
                      />
                    </label>

                    {/* ASI Eksklusif */}
                    <label className="space-y-1">
                      <span className="font-semibold text-[#0F292E]">ASI Eksklusif</span>
                      <select
                        value={row.asi_eksklusif}
                        onChange={(e) =>
                          updateRow(idx, {
                            asi_eksklusif: e.target.value as "" | "ya" | "tidak",
                          })
                        }
                        className="w-full min-h-[48px] rounded-xl border border-[#C5E4E8] bg-white px-3 text-sm"
                      >
                        <option value="">Tidak tercatat</option>
                        <option value="ya">Ya</option>
                        <option value="tidak">Tidak</option>
                      </select>
                    </label>
                  </div>
                </Card>
              );
            })
          )}

          {(localError || saveError) && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {localError ?? saveError}
            </div>
          )}

          {editableRows.length > 0 && (
            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isSaving}
            >
              Konfirmasi &amp; Simpan Data
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
