import React from "react";
import Link from "next/link";

const HERO_METRICS = [
  {
    value: "672+",
    label: "Titik Uji Permenkes",
  },
  {
    value: "7",
    label: "Indikator WHO 2006",
  },
  {
    value: "0–59",
    label: "Rentang Usia (Bulan)",
  },
  {
    value: "100%",
    label: "Kepatuhan UU PDP",
  },
];

const FEATURE_CARDS = [
  {
    step: "01",
    tag: "Registrasi",
    title: "Pendaftaran & Buku KIA",
    description:
      "Pencatatan identitas balita, orang tua/wali, banjar, serta persetujuan eksplisit sesuai UU PDP.",
    href: "/balita/baru",
    action: "Daftarkan Balita",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    step: "02",
    tag: "Antropometri",
    title: "Pemantauan Balita Aktif",
    description:
      "Daftar seluruh balita per wilayah Posyandu lengkap dengan status gizi dan riwayat timbang terakhir.",
    href: "/balita",
    action: "Buka Daftar Balita",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    step: "03",
    tag: "Kalkulasi LMS",
    title: "Diagnostik Z-Score WHO",
    description:
      "Evaluasi deterministik 7 indeks antropometri beserta deteksi dini gagal tumbuh (growth faltering).",
    href: "/balita",
    action: "Lihat Evaluasi",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    step: "04",
    tag: "Tata Kelola",
    title: "Supervisi Bidan & Kader",
    description:
      "Pengaturan penugasan Posyandu, kontrol status aktif petugas, serta pencatatan audit log klinis.",
    href: "/bidan/kader",
    action: "Buka Panel Bidan",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
];

const SPECIALTY_MODULES = [
  {
    title: "Berat Badan / Umur (BB/U)",
    subtitle: "Deteksi berat badan kurang",
    code: "BB/U",
  },
  {
    title: "Panjang & Tinggi (PB/TB)",
    subtitle: "Skrining dini risiko stunting",
    code: "PB/TB",
  },
  {
    title: "Proporsi Gizi (BB/PB)",
    subtitle: "Identifikasi wasting / gizi lebih",
    code: "BB/PB",
  },
  {
    title: "Indeks Massa Tubuh (IMT/U)",
    subtitle: "Pemantauan kurva adipositas",
    code: "IMT/U",
  },
  {
    title: "Lingkar Kepala (LK/U)",
    subtitle: "Pantau pertumbuhan kepala",
    code: "LK/U",
  },
  {
    title: "Lingkar Lengan Atas (LiLA)",
    subtitle: "Skrining cadangan gizi balita",
    code: "LiLA",
  },
  {
    title: "Standar KBM Bulanan",
    subtitle: "Peringatan tren T1 / T2 / T3",
    code: "KBM",
  },
  {
    title: "Pelindungan Data UU PDP",
    subtitle: "Rekam persetujuan wali sah",
    code: "PDP",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen px-4 sm:px-6 py-4 sm:py-5 space-y-10 pb-14">
      {/* =====================================================================
          SECTION 1: COMPACT & AIRY CLINICAL HERO
         ===================================================================== */}
      <section
        aria-label="Hero Posyandu+"
        className="bg-synora-mesh relative overflow-hidden rounded-[24px] border border-[#C5E4E8] p-4 sm:p-6 lg:p-7 shadow-sm space-y-6"
      >
        {/* Top Floating Pill Navbar */}
        <header className="relative z-10 flex items-center justify-between gap-3 rounded-full bg-white/90 backdrop-blur-md border border-[#D5ECEF] px-4 sm:px-5 py-2 shadow-[0_1px_2px_rgba(15,41,46,0.04)]">
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

          <nav
            aria-label="Navigasi Utama"
            className="hidden md:flex items-center gap-6 text-xs font-medium text-[#4A666C]"
          >
            <Link href="/" className="text-[#0F292E] font-semibold">
              Beranda
            </Link>
            <Link href="#layanan" className="hover:text-[#00B9AD] transition-colors">
              Modul Layanan
            </Link>
            <Link href="#indikator" className="hover:text-[#00B9AD] transition-colors">
              Indikator WHO
            </Link>
            <Link href="/balita" className="hover:text-[#00B9AD] transition-colors">
              Daftar Balita
            </Link>
            <Link href="/bidan/kader" className="hover:text-[#00B9AD] transition-colors">
              Panel Bidan
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#0F292E] hover:bg-[#EDF8FA] transition-colors"
            >
              Masuk
            </Link>
            <Link
              href="/balita"
              className="inline-flex items-center justify-center rounded-full bg-[#00B9AD] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#009E94] transition-colors shadow-sm"
            >
              Buka Posyandu
            </Link>
          </div>
        </header>

        {/* Main Hero Content Grid */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-7 items-center pt-1">
          {/* Left Copy Column */}
          <div className="lg:col-span-6 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#60C0D0]/50 bg-white/85 px-3 py-1 text-[11px] font-semibold text-[#00857C]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00B9AD]" aria-hidden="true" />
              <span>Posyandu Digital • Desa Kerobokan</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-bold tracking-tight leading-[1.2] text-[#0F292E]">
              Pemantauan Tumbuh Kembang Balita yang{" "}
              <span className="text-[#009E94]">Terukur &amp; Terpadu</span>
            </h1>

            <p className="max-w-lg text-xs sm:text-sm leading-relaxed text-[#4A666C]">
              Pendampingan penimbangan bulanan dan deteksi dini risiko stunting usia 0–59 bulan berbasis kurva LMS WHO 2006 serta Permenkes RI No. 2 Tahun 2020.
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-2.5">
              <Link
                href="/balita"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#00B9AD] px-5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#009E94]"
              >
                <span>Buka Daftar Balita</span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#C5E4E8] bg-white px-5 text-xs font-semibold text-[#0F292E] transition-colors hover:bg-[#EDF8FA]"
              >
                <span>Masuk Petugas</span>
              </Link>
            </div>
          </div>

          {/* Center Clinical Preview Card */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-[#C5E4E8] bg-white/95 p-4 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#009E94]">
                    Pratinjau KMS Digital
                  </p>
                  <p className="text-sm font-bold text-[#0F292E]">
                    Kurva Z-Score WHO 2006
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] border border-green-300 px-2.5 py-0.5 text-[11px] font-semibold text-[#15803D]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#15803D]" />
                  Normal (-0.4 SD)
                </span>
              </div>

              {/* Clean SVG Growth Curve Visualization */}
              <div className="rounded-xl bg-[#F4FAFB] border border-[#DCEEEF] p-3">
                <svg
                  viewBox="0 0 260 90"
                  className="w-full h-20 overflow-visible"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="tealArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00B9AD" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#60C0D0" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {/* Reference grid lines */}
                  <line x1="0" y1="20" x2="260" y2="20" stroke="#D5ECEF" strokeDasharray="3 3" />
                  <line x1="0" y1="45" x2="260" y2="45" stroke="#D5ECEF" strokeDasharray="3 3" />
                  <line x1="0" y1="70" x2="260" y2="70" stroke="#D5ECEF" strokeDasharray="3 3" />
                  {/* Area under curve */}
                  <path
                    d="M 10 72 Q 65 56, 120 46 T 250 22 L 250 82 L 10 82 Z"
                    fill="url(#tealArea)"
                  />
                  {/* Smooth trajectory line */}
                  <path
                    d="M 10 72 Q 65 56, 120 46 T 250 22"
                    fill="none"
                    stroke="#00B9AD"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {/* Data points */}
                  <circle cx="10" cy="72" r="3.5" fill="#FFFFFF" stroke="#00B9AD" strokeWidth="2" />
                  <circle cx="70" cy="57" r="3.5" fill="#FFFFFF" stroke="#00B9AD" strokeWidth="2" />
                  <circle cx="130" cy="45" r="3.5" fill="#FFFFFF" stroke="#00B9AD" strokeWidth="2" />
                  <circle cx="190" cy="33" r="3.5" fill="#FFFFFF" stroke="#00B9AD" strokeWidth="2" />
                  <circle cx="250" cy="22" r="4" fill="#00B9AD" stroke="#FFFFFF" strokeWidth="1.5" />
                </svg>
                <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-[#4A666C] tabular-nums">
                  <span>0 bln</span>
                  <span>12 bln</span>
                  <span>24 bln</span>
                  <span>36 bln</span>
                  <span>48 bln</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-[#EDF8FA] px-2 py-1.5">
                  <p className="text-[10px] font-medium text-[#4A666C]">BB/U</p>
                  <p className="text-xs font-bold text-[#0F292E] tabular-nums">Normal</p>
                </div>
                <div className="rounded-lg bg-[#EDF8FA] px-2 py-1.5">
                  <p className="text-[10px] font-medium text-[#4A666C]">PB/TB</p>
                  <p className="text-xs font-bold text-[#0F292E] tabular-nums">Sesuai</p>
                </div>
                <div className="rounded-lg bg-[#EDF8FA] px-2 py-1.5">
                  <p className="text-[10px] font-medium text-[#4A666C]">Tren KBM</p>
                  <p className="text-xs font-bold text-[#009E94] tabular-nums">Naik (N)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Stacked Metrics Column */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-3 lg:border-l lg:border-[#60C0D0]/35 lg:pl-5">
            {HERO_METRICS.map((item, idx) => (
              <div
                key={item.value}
                className={[
                  "lg:text-right",
                  idx < HERO_METRICS.length - 1
                    ? "lg:border-b lg:border-[#60C0D0]/25 lg:pb-2.5"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F292E] tabular-nums leading-none">
                  {item.value}
                </p>
                <p className="mt-1 text-[11px] font-medium text-[#4A666C] leading-snug">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: 4 MODUL LAYANAN UTAMA
         ===================================================================== */}
      <section id="layanan" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#009E94]">
              Alur Kerja Terpadu
            </p>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-[#0F292E]">
              Semua kebutuhan pantau gizi dalam satu tempat
            </h2>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-[#4A666C]">
            Menghubungkan registrasi Buku KIA, kalkulasi Z-Score otomatis, dan pengawasan Bidan Desa tanpa pencatatan berulang.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURE_CARDS.map((card) => (
            <Link
              key={card.step}
              href={card.href}
              className="group flex flex-col justify-between rounded-2xl border border-[#D5ECEF] bg-white p-4 shadow-[0_1px_3px_rgba(15,41,46,0.04)] transition-all hover:border-[#60C0D0] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B9AD]"
            >
              <div>
                {/* Compact Visual Header in #00B9AD & #60C0D0 */}
                <div className="relative flex h-24 flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br from-[#00B9AD] to-[#60C0D0] p-3.5 text-white">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/15"
                  />
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-white/20 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      {card.tag}
                    </span>
                    <span className="text-xs font-bold opacity-85 tabular-nums">
                      {card.step}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                      {card.icon}
                    </span>
                  </div>
                </div>

                <h3 className="mt-3.5 text-sm font-bold text-[#0F292E] group-hover:text-[#009E94] transition-colors">
                  {card.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#4A666C]">
                  {card.description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#EDF8FA] pt-2.5 text-xs font-semibold text-[#009E94]">
                <span>{card.action}</span>
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                  &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: 8 INDIKATOR & STANDAR KLINIS
         ===================================================================== */}
      <section id="indikator" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#009E94]">
              Standar WHO 2006 &amp; Permenkes 2/2020
            </p>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-[#0F292E]">
              Cakupan evaluasi di setiap indikator pertumbuhan
            </h2>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/balita"
              className="inline-flex h-9 items-center justify-center rounded-full bg-[#00B9AD] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#009E94] transition-colors"
            >
              Buka Daftar Balita
            </Link>
            <Link
              href="/bidan/kader"
              className="inline-flex h-9 items-center justify-center rounded-full border border-[#C5E4E8] bg-white px-4 text-xs font-semibold text-[#0F292E] hover:bg-[#EDF8FA] transition-colors"
            >
              Panel Bidan
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SPECIALTY_MODULES.map((mod) => (
            <div
              key={mod.title}
              className="flex items-center gap-3 rounded-xl border border-[#D5ECEF] bg-white p-3 shadow-[0_1px_2px_rgba(15,41,46,0.03)] transition-colors hover:border-[#60C0D0] hover:bg-[#EDF8FA]/40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#C5E4E8] bg-[#EDF8FA] text-[11px] font-bold text-[#00857C] tabular-nums">
                {mod.code}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-[#0F292E] leading-snug truncate">
                  {mod.title}
                </h3>
                <p className="mt-0.5 text-[11px] text-[#4A666C] leading-snug truncate">
                  {mod.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
