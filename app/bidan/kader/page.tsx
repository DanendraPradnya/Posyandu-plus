"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Posyandu, UserProfile } from "@/lib/types";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Input,
  Select,
  SkeletonCard,
  StatCard,
  StatusBadge,
  Toast,
} from "@/components/ui";

type ActiveDialog =
  | { type: "create" }
  | { type: "reassign"; kader: UserProfile }
  | { type: "toggle_status"; kader: UserProfile; targetStatus: boolean }
  | null;

export default function ManajemenKaderPage() {
  const router = useRouter();

  const [bidanProfile, setBidanProfile] = useState<UserProfile | null>(null);
  const [kaderList, setKaderList] = useState<UserProfile[]>([]);
  const [posyanduList, setPosyanduList] = useState<Posyandu[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastInfo, setToastInfo] = useState<{
    tone: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // State form dialog
  const [newNama, setNewNama] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedPosyanduId, setSelectedPosyanduId] = useState("");
  const [alasanAudit, setAlasanAudit] = useState("");

  const loadKaderData = useCallback(async () => {
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

      const { data: currentProfile, error: profErr } = await supabase
        .from("users")
        .select("id, peran, nama, email, status_aktif, posyandu_ditugaskan")
        .eq("id", user.id)
        .maybeSingle();

      if (profErr || !currentProfile) {
        throw new Error("Gagal memverifikasi profil petugas.");
      }

      if (!currentProfile.status_aktif) {
        await supabase.auth.signOut();
        router.replace("/login?error=account_inactive");
        return;
      }

      if (currentProfile.peran !== "bidan") {
        router.replace("/balita?denied=bidan_only");
        return;
      }

      setBidanProfile(currentProfile as UserProfile);

      const { data: posRows, error: posErr } = await supabase
        .from("posyandu")
        .select("id, nama, dusun_banjar, wilayah_puskesmas")
        .order("nama", { ascending: true });

      if (posErr) {
        throw new Error(posErr.message);
      }

      const safePos = (posRows ?? []) as Posyandu[];
      setPosyanduList(safePos);

      const { data: kaderRows, error: kaderErr } = await supabase
        .from("users")
        .select("id, peran, nama, email, status_aktif, posyandu_ditugaskan")
        .eq("peran", "kader")
        .order("nama", { ascending: true });

      if (kaderErr) {
        throw new Error(kaderErr.message);
      }

      setKaderList((kaderRows ?? []) as UserProfile[]);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat daftar akun Kader."
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadKaderData();
  }, [loadKaderData]);

  // Tutup dialog dengan tombol Escape (Aksesibilitas R-32)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && activeDialog && !isProcessingAction) {
        setActiveDialog(null);
        setActionError(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDialog, isProcessingAction]);

  const posyanduMap = useMemo(() => {
    const map: Record<string, Posyandu> = {};
    for (const p of posyanduList) {
      map[p.id] = p;
    }
    return map;
  }, [posyanduList]);

  const metrics = useMemo(() => {
    const total = kaderList.length;
    const active = kaderList.filter((k) => k.status_aktif).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [kaderList]);

  function openCreateDialog() {
    setNewNama("");
    setNewEmail("");
    setNewPassword("");
    setSelectedPosyanduId(posyanduList[0]?.id ?? "");
    setAlasanAudit("Penambahan petugas Kader Posyandu baru");
    setActionError(null);
    setActiveDialog({ type: "create" });
  }

  function openReassignDialog(kader: UserProfile) {
    setSelectedPosyanduId(
      kader.posyandu_ditugaskan ?? posyanduList[0]?.id ?? ""
    );
    setAlasanAudit("");
    setActionError(null);
    setActiveDialog({ type: "reassign", kader });
  }

  function openToggleStatusDialog(kader: UserProfile) {
    setAlasanAudit("");
    setActionError(null);
    setActiveDialog({
      type: "toggle_status",
      kader,
      targetStatus: !kader.status_aktif,
    });
  }

  async function handleDialogSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeDialog) return;

    setActionError(null);

    if (!alasanAudit.trim()) {
      setActionError(
        "Alasan audit wajib diisi untuk setiap perubahan akun oleh Bidan."
      );
      return;
    }

    let payload: Record<string, unknown> = {};

    if (activeDialog.type === "create") {
      if (
        !newNama.trim() ||
        !newEmail.trim() ||
        newPassword.length < 6 ||
        !selectedPosyanduId
      ) {
        setActionError(
          "Nama, email, Posyandu, dan kata sandi (minimal 6 karakter) wajib diisi."
        );
        return;
      }
      payload = {
        action: "create",
        nama: newNama.trim(),
        email: newEmail.trim(),
        password: newPassword,
        posyandu_id: selectedPosyanduId,
        alasan: alasanAudit.trim(),
      };
    } else if (activeDialog.type === "reassign") {
      if (!selectedPosyanduId) {
        setActionError("Posyandu tujuan wajib dipilih.");
        return;
      }
      payload = {
        action: "reassign",
        user_id: activeDialog.kader.id,
        posyandu_id: selectedPosyanduId,
        alasan: alasanAudit.trim(),
      };
    } else if (activeDialog.type === "toggle_status") {
      payload = {
        action: "toggle_status",
        user_id: activeDialog.kader.id,
        status_aktif: activeDialog.targetStatus,
        alasan: alasanAudit.trim(),
      };
    }

    setIsProcessingAction(true);
    try {
      const response = await fetch("/api/admin/kader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !result.success) {
        setActionError(
          result.error ?? "Gagal memproses perubahan akun Kader."
        );
        setIsProcessingAction(false);
        return;
      }

      setToastInfo({
        tone: "success",
        message: result.message ?? "Perubahan akun Kader berhasil disimpan.",
      });
      setActiveDialog(null);
      await loadKaderData();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan jaringan saat menghubungi server."
      );
    } finally {
      setIsProcessingAction(false);
    }
  }

  return (
    <div className="min-h-screen p-4 space-y-5 pb-12">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/balita"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
        >
          <span aria-hidden="true">&larr;</span>
          <span>Daftar Balita</span>
        </Link>
      </div>

      {/* Header Synora Mesh (1 per layar) */}
      <header className="bg-synora-mesh rounded-2xl p-5 border border-gray-200/80 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status="Normal" label="Panel Khusus Bidan" />
          <span className="text-xs font-medium text-gray-700">
            Audit Log Aktif
          </span>
        </div>
        <div className="space-y-1">
          <h1 className="text-[22px] font-bold tracking-tight text-gray-900">
            Manajemen Akun Kader
          </h1>
          <p className="text-sm text-gray-700">
            {bidanProfile
              ? `Bidan Pembina: ${bidanProfile.nama}`
              : "Kelola penugasan Posyandu dan status aktif akun Kader wilayah."}
          </p>
        </div>
      </header>

      {toastInfo && (
        <Toast
          tone={toastInfo.tone}
          message={toastInfo.message}
          onDismiss={() => setToastInfo(null)}
        />
      )}

      {/* 3 Kartu Metrik Ringkas */}
      <section aria-label="Ringkasan Akun Kader" className="grid grid-cols-3 gap-2.5">
        <StatCard
          value={isLoading ? 0 : metrics.total}
          label="Total Akun Kader"
          tone="default"
        />
        <StatCard
          value={isLoading ? 0 : metrics.active}
          label="Kader Aktif"
          tone="success"
        />
        <StatCard
          value={isLoading ? 0 : metrics.inactive}
          label="Nonaktif"
          tone={metrics.inactive > 0 ? "warning" : "default"}
        />
      </section>

      {/* Tombol Utama Tambah Kader Baru */}
      <div>
        <Button variant="primary" fullWidth onClick={openCreateDialog}>
          + Tambah Akun Kader Baru
        </Button>
      </div>

      {/* Panel Form Aksi Administratif (Modal / Inline Panel dengan Aksesibilitas Keyboard) */}
      {activeDialog && (
        <Card
          variant="white"
          padding="lg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-kader-title"
          className="border-2 border-gray-900 space-y-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2
                id="dialog-kader-title"
                className="text-base font-bold text-gray-900"
              >
                {activeDialog.type === "create" && "Tambah Akun Kader Baru"}
                {activeDialog.type === "reassign" &&
                  `Ubah Posyandu: ${activeDialog.kader.nama}`}
                {activeDialog.type === "toggle_status" &&
                  `${
                    activeDialog.targetStatus ? "Aktifkan" : "Nonaktifkan"
                  } Akun: ${activeDialog.kader.nama}`}
              </h2>
              <p className="text-xs text-gray-600">
                Setiap perubahan oleh Bidan dicatat otomatis ke tabel audit_logs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveDialog(null)}
              aria-label="Tutup panel formulir"
              className="inline-flex min-h-[48px] min-w-[48px] -mt-2 -mr-2 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
            >
              ✕
            </button>
          </div>

          {actionError && (
            <div
              role="alert"
              className="rounded-xl border border-red-300 bg-[#FEE2E2] p-3 text-xs font-medium text-[#B91C1C]"
            >
              {actionError}
            </div>
          )}

          <form onSubmit={handleDialogSubmit} className="space-y-3.5" noValidate>
            {activeDialog.type === "create" && (
              <>
                <Input
                  id="kader-new-nama"
                  label="Nama Lengkap Kader"
                  placeholder="Contoh: Ni Luh Putu Sari"
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  required
                />
                <Input
                  id="kader-new-email"
                  label="Email Login Kader"
                  type="email"
                  placeholder="kader.melati@posyandu.id"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
                <Input
                  id="kader-new-password"
                  label="Kata Sandi Awal"
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </>
            )}

            {(activeDialog.type === "create" ||
              activeDialog.type === "reassign") && (
              <Select
                id="kader-posyandu-select"
                label="Posyandu Ditugaskan"
                value={selectedPosyanduId}
                onChange={(e) => setSelectedPosyanduId(e.target.value)}
                options={posyanduList.map((p) => ({
                  value: p.id,
                  label: `${p.nama} (${p.dusun_banjar})`,
                }))}
                required
              />
            )}

            {activeDialog.type === "toggle_status" && (
              <div className="rounded-xl border border-amber-300 bg-[#FEF3C7] p-3 text-xs text-gray-900">
                {activeDialog.targetStatus
                  ? "Akun Kader akan diaktifkan kembali sehingga petugas dapat masuk ke aplikasi Posyandu+."
                  : "Penonaktifan akun akan langsung mencabut akses masuk petugas ini seketika (<= 1 menit sesuai F1-06)."}
              </div>
            )}

            <Input
              id="kader-audit-alasan"
              label="Alasan Perubahan (Wajib untuk Audit Log)"
              placeholder="Contoh: Rotasi tugas Posyandu bulanan"
              value={alasanAudit}
              onChange={(e) => setAlasanAudit(e.target.value)}
              required
            />

            <div className="flex items-center gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActiveDialog(null)}
                disabled={isProcessingAction}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant={
                  activeDialog.type === "toggle_status" &&
                  !activeDialog.targetStatus
                    ? "danger"
                    : "primary"
                }
                fullWidth
                isLoading={isProcessingAction}
              >
                Simpan Perubahan
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Daftar Kader dengan 3 State Eksplisit: Loading, Error, Empty */}
      <section aria-label="Daftar Akun Kader" className="space-y-3">
        {isLoading ? (
          <SkeletonCard count={3} lines={3} />
        ) : errorMsg ? (
          <ErrorBox
            title="Gagal Memuat Daftar Kader"
            message={errorMsg}
            onRetry={loadKaderData}
          />
        ) : kaderList.length === 0 ? (
          <EmptyState
            title="Belum Ada Akun Kader Terdaftar"
            description="Tambahkan akun Kader Posyandu pertama untuk menugaskan pencatatan di Posyandu wilayah."
            actionLabel="Tambah Kader Pertama"
            onAction={openCreateDialog}
          />
        ) : (
          <ul className="space-y-3">
            {kaderList.map((kader) => {
              const assignedPosyandu = kader.posyandu_ditugaskan
                ? posyanduMap[kader.posyandu_ditugaskan]
                : null;

              return (
                <li key={kader.id}>
                  <Card variant="white" padding="md" className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-base font-semibold text-gray-900">
                          {kader.nama}
                        </h2>
                        <p className="text-xs text-gray-600">{kader.email}</p>
                      </div>
                      <StatusBadge
                        status={kader.status_aktif ? "Aktif" : "Nonaktif"}
                      />
                    </div>

                    <div className="rounded-xl bg-[#F4F4F0] px-3 py-2 text-xs text-gray-800">
                      <span className="font-medium text-gray-600">
                        Posyandu Ditugaskan:{" "}
                      </span>
                      <strong className="text-gray-900">
                        {assignedPosyandu
                          ? `${assignedPosyandu.nama} (${assignedPosyandu.dusun_banjar})`
                          : "Belum Ditugaskan"}
                      </strong>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openReassignDialog(kader)}
                      >
                        Ubah Posyandu
                      </Button>
                      <Button
                        type="button"
                        variant={kader.status_aktif ? "danger" : "primary"}
                        size="sm"
                        onClick={() => openToggleStatusDialog(kader)}
                      >
                        {kader.status_aktif ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

