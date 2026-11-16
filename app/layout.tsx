import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Posyandu+ | Deteksi Dini Risiko Stunting",
  description:
    "Sistem deteksi dini risiko stunting dan pemantauan pertumbuhan balita (0-59 bulan) berbasis Mobile-First PWA",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/posyandu-logo.png",
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00B9AD",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={plusJakartaSans.variable}>
      <body className="min-h-screen bg-[#F7FBFC] text-[#0F292E] antialiased selection:bg-[#60C0D0]/30 selection:text-[#0F292E]">
        <main className="mx-auto min-h-screen w-full max-w-[1120px] bg-[#F7FBFC]">
          {children}
        </main>
      </body>
    </html>
  );
}
