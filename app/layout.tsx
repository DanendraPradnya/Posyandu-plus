import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Posyandu+ | Deteksi Dini Risiko Stunting",
  description:
    "Sistem deteksi dini risiko stunting dan pemantauan pertumbuhan balita (0-59 bulan) berbasis Mobile-First PWA",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-[#F8FAFC] text-[#111827] antialiased">
        <main className="mx-auto min-h-screen w-full max-w-[420px] md:max-w-[768px] bg-[#F8FAFC]">
          {children}
        </main>
      </body>
    </html>
  );
}
