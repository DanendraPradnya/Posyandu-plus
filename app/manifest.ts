import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Posyandu+ | Deteksi Dini Risiko Stunting",
    short_name: "Posyandu+",
    description:
      "Sistem deteksi dini risiko stunting dan pemantauan pertumbuhan balita (0-59 bulan) berbasis Mobile-First PWA",
    start_url: "/balita",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#111827",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192x192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

