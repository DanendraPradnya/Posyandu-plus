"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, StatusBadge, Toast } from "@/components/ui";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const loggedOutParam = searchParams.get("logged_out");
  const nextPath = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    errorParam === "account_inactive"
      ? "Akun Anda telah dinonaktifkan oleh Bidan Desa. Silakan hubungi Bidan Pembina Wilayah."
      : null
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage("Email dan kata sandi wajib diisi.");
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: authData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

      if (signInError || !authData.user) {
        setErrorMessage(
          "Email atau kata sandi tidak sesuai. Periksa kembali kredensial Anda."
        );
        setIsLoading(false);
        return;
      }

      // Periksa status aktif dan peran pada tabel public.users (F1-04 & F1-22)
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, peran, nama, status_aktif")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setErrorMessage(
          "Profil petugas tidak ditemukan pada sistem Posyandu+. Hubungi Bidan Desa."
        );
        setIsLoading(false);
        return;
      }

      if (!profile.status_aktif) {
        await supabase.auth.signOut();
        setErrorMessage(
          "Akun Anda berstatus nonaktif. Silakan hubungi Bidan Desa untuk pengaktifan kembali."
        );
        setIsLoading(false);
        return;
      }

      const targetRoute =
        nextPath && nextPath.startsWith("/") ? nextPath : "/balita";
      router.push(targetRoute);
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Terjadi kendala jaringan saat menghubungi server autentikasi."
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-4 flex flex-col justify-between space-y-6">
      <div className="space-y-5 pt-2">
        {/* Header Mesh Synora (maksimal 1 area per layar) */}
        <header className="bg-synora-mesh rounded-2xl p-5 border border-gray-200/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <StatusBadge status="Normal" label="Posyandu+ PWA" />
            <span className="text-xs font-medium text-gray-700">
              Desa Kerobokan
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-[22px] font-bold tracking-tight text-gray-900">
              Masuk Petugas
            </h1>
            <p className="text-sm text-gray-700">
              Sistem Deteksi Dini Pertumbuhan Balita (0-59 Bulan) untuk Kader Posyandu dan Bidan Desa.
            </p>
          </div>
        </header>

        {loggedOutParam === "1" && !errorMessage && (
          <Toast
            tone="info"
            message="Anda telah keluar dari sesi Posyandu+ dengan aman."
          />
        )}

        {errorMessage && (
          <div
            role="alert"
            className="rounded-2xl border border-red-300 bg-[#FEE2E2] p-4 text-sm font-medium text-[#B91C1C]"
          >
            {errorMessage}
          </div>
        )}

        <Card variant="white" padding="lg">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              id="login-email"
              label="Alamat Email Petugas"
              type="email"
              autoComplete="email"
              placeholder="nama@posyandu.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              id="login-password"
              label="Kata Sandi"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Masukkan kata sandi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword
                      ? "Sembunyikan kata sandi"
                      : "Tampilkan kata sandi"
                  }
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                >
                  {showPassword ? "Tutup" : "Lihat"}
                </button>
              }
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={isLoading}
              >
                {isLoading ? "Memverifikasi Akun..." : "Masuk"}
              </Button>
            </div>
          </form>
        </Card>

        <Card variant="surface" padding="md" className="space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
            Informasi Akses Petugas
          </h2>
          <p className="text-xs leading-relaxed text-gray-600">
            Pendaftaran akun Kader baru atau pengaturan ulang penugasan Posyandu dikelola langsung oleh Bidan Pembina Wilayah melalui panel manajemen petugas.
          </p>
        </Card>
      </div>

      <footer className="pb-2 text-center">
        <Link
          href="/"
          className="inline-flex min-h-[48px] items-center justify-center px-3 text-xs font-medium text-gray-600 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 rounded-lg"
        >
          Kembali ke Halaman Utama
        </Link>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4">
          <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}

