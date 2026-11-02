import Link from "next/link";
import { Card, StatusBadge } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="min-h-screen p-4 space-y-5">
      <header className="bg-synora-mesh rounded-2xl p-5 border border-gray-200/80 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status="Normal" label="PWA Siap Lapangan" />
          <span className="text-xs font-medium text-gray-700">Desa Kerobokan</span>
        </div>
        <div className="space-y-1">
          <h1 className="text-[22px] font-bold tracking-tight text-gray-900">
            Posyandu+
          </h1>
          <p className="text-sm text-gray-700">
            Deteksi Dini Pertumbuhan Balita (0-59 Bulan) sesuai standar WHO 2006 dan Permenkes RI No. 2 Tahun 2020.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <Link
            href="/balita"
            className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-gray-900 px-5 py-3 text-base font-medium text-white shadow-sm hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
          >
            Buka Daftar Balita
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-base font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
          >
            Masuk Akun Petugas
          </Link>
        </div>
      </header>

      <Card variant="white" padding="md" className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          Modul Inti Sistem
        </h2>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-[#15803D] shrink-0" />
            <span>
              <strong>Daftar &amp; Registrasi Balita:</strong> Pencatatan profil anak usia 0-59 bulan beserta persetujuan eksplisit orang tua/wali (UU PDP).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-[#15803D] shrink-0" />
            <span>
              <strong>Mesin Z-Score Deterministik:</strong> Perhitungan 7 indikator antropometri WHO 2006 dan Permenkes No. 2 Tahun 2020.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-[#15803D] shrink-0" />
            <span>
              <strong>Manajemen Akun Kader:</strong> Panel khusus Bidan untuk mengatur penugasan Posyandu dan status aktif petugas.
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
