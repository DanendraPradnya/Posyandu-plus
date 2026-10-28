import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Posyandu+ | Deteksi Dini Risiko Stunting",
  description:
    "Sistem deteksi dini risiko stunting dan pemantauan pertumbuhan balita (0-59 bulan) berbasis Mobile-First PWA",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#15803d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <main className="mx-auto max-w-[420px] min-h-screen bg-white shadow-sm">
          {children}
        </main>
      </body>
    </html>
  );
}
