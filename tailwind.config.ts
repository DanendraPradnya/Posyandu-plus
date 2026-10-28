import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sistem warna sesuai PRD (hijau/kuning/merah status + biru/merah muda jenis kelamin)
        status: {
          normal: "#15803d",    // green-700 (kontras tinggi WCAG AA)
          waspada: "#b45309",   // amber-700
          berisiko: "#c2410c",  // orange-700
          kritis: "#b91c1c",    // red-700
        },
        gender: {
          male: "#1d4ed8",      // blue-700
          female: "#be185d",    // pink-700
        },
      },
      minHeight: {
        touch: "48px", // NFR5: target sentuh >= 48 px
      },
      minWidth: {
        touch: "48px",
      },
    },
  },
  plugins: [],
};

export default config;
