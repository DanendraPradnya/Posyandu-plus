"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Toast } from "@/components/ui";

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
    <div className="min-h-screen px-4 sm:px-6 py-4 sm:py-5 space-y-6">
      {/* Top Navbar */}
      <header className="flex items-center justify-between gap-3 rounded-full bg-white border border-[#D5ECEF] px-4 sm:px-5 py-2 shadow-[0_1px_2px_rgba(15,41,46,0.04)]">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#00B9AD] to-[#60C0D0] text-white shadow-sm">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </span>
          <span className="text-sm font-bold tracking-tight text-[#0F292E]">
            Posyandu<span className="text-[#00B9AD]">+</span>
          </span>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-[#C5E4E8] bg-[#EDF8FA] px-3.5 py-1.5 text-xs font-semibold text-[#0F292E] hover:bg-[#DCEEEF] transition-colors"
        >
          &larr; Beranda
        </Link>
      </header>

      {/* Main Split Card */}
      <div className="bg-synora-mesh rounded-[24px] border border-[#C5E4E8] p-5 sm:p-8 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Info Column */}
          <div className="lg:col-span-6 space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#60C0D0]/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-[#00857C]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00B9AD]" aria-hidden="true" />
              Portal Autentikasi Petugas
            </span>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F292E] leading-snug">
              Akses Klinis Terpadu untuk{" "}
              <span className="text-[#009E94]">Kader &amp; Bidan Desa</span>
            </h1>

            <p className="text-xs sm:text-sm leading-relaxed text-[#4A666C]">
              Masuk untuk mencatat hasil penimbangan bulanan, memantau kurva Z-Score WHO 2006, dan menindaklanjuti indikasi dini risiko stunting di wilayah Desa Kerobokan.
            </p>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-[#C5E4E8] bg-white/90 p-3">
                <p className="text-sm font-bold text-[#009E94]">RLS Aktif</p>
                <p className="mt-0.5 text-[11px] text-[#4A666C]">Isolasi per Posyandu</p>
              </div>
              <div className="rounded-xl border border-[#C5E4E8] bg-white/90 p-3">
                <p className="text-sm font-bold text-[#009E94]">UU PDP</p>
                <p className="mt-0.5 text-[11px] text-[#4A666C]">Privasi Terlindungi</p>
              </div>
              <div className="rounded-xl border border-[#C5E4E8] bg-white/90 p-3">
                <p className="text-sm font-bold text-[#009E94]">Audit Log</p>
                <p className="mt-0.5 text-[11px] text-[#4A666C]">Rekam Jejak Klinis</p>
              </div>
            </div>
          </div>

          {/* Right Form Card */}
          <div className="lg:col-span-6">
            <div className="mx-auto max-w-md rounded-2xl border border-[#D5ECEF] bg-white p-5 sm:p-6 shadow-sm space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold tracking-tight text-[#0F292E]">
                  Masuk Akun Petugas
                </h2>
                <p className="text-xs text-[#4A666C]">
                  Gunakan email resmi Kader Posyandu atau Bidan Desa.
                </p>
              </div>

              {loggedOutParam === "1" && !errorMessage && (
                <Toast
                  tone="info"
                  message="Anda telah keluar dari sesi Posyandu+ dengan aman."
                />
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-[#FEE2E2] p-3 text-xs font-medium text-[#B91C1C]"
                >
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
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
                      className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-xs font-semibold text-[#009E94] hover:bg-[#EDF8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B9AD]"
                    >
                      {showPassword ? "Tutup" : "Lihat"}
                    </button>
                  }
                />

                <div className="pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    isLoading={isLoading}
                  >
                    {isLoading ? "Memverifikasi Akun..." : "Masuk ke Sistem"}
                  </Button>
                </div>
              </form>

              <div className="rounded-xl bg-[#EDF8FA] border border-[#C5E4E8] p-3 space-y-0.5">
                <p className="text-[11px] font-semibold text-[#0F292E]">
                  Informasi Akses Petugas
                </p>
                <p className="text-[11px] leading-relaxed text-[#4A666C]">
                  Pendaftaran akun Kader baru atau pengaturan ulang penugasan Posyandu dikelola oleh Bidan Pembina Wilayah.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="h-64 animate-pulse rounded-2xl bg-[#EDF8FA]" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
