export default function HomePage() {
  return (
    <div className="p-4 space-y-4">
      <header className="border-b pb-3">
        <h1 className="text-xl font-bold text-gray-900">Posyandu+</h1>
        <p className="text-sm text-gray-700">
          Deteksi Dini Pertumbuhan Balita (0-59 Bulan) — Desa Kerobokan
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 p-4 space-y-2">
        <h2 className="text-base font-semibold text-gray-900">Status Workspace Fase 0</h2>
        <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
          <li>Data referensi LMS WHO 2006 &amp; KBM: Siap (`ref/`)</li>
          <li>Garis Merah &amp; Oranye KMS BB/U: Siap (`ref/ref_kms_line.csv`)</li>
          <li>Fixture Uji Permenkes 2/2020 (672 titik): Siap (`tests/fixtures/`)</li>
          <li>Kontrak Tipe &amp; Skema JSON Ekstraksi KIA: Terkunci (`lib/`)</li>
        </ul>
      </section>
    </div>
  );
}
