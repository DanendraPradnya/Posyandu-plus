import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sistem warna klinis Posyandu+ sesuai DESIGN.md (WCAG AA >= 4.5:1)
        status: {
          normal: "#15803D",    // green-700
          normalBg: "#DCFCE7",  // green-100
          waspada: "#B45309",   // amber-700
          waspadaBg: "#FEF3C7", // amber-100
          berisiko: "#C2410C",  // orange-700
          berisikoBg: "#FFEDD5",// orange-100
          kritis: "#B91C1C",    // red-700
          kritisBg: "#FEE2E2",  // red-100
        },
        gender: {
          male: "#0284C7",      // sky-600
          maleBg: "#E0F2FE",    // sky-100
          female: "#DB2777",    // pink-600
          femaleBg: "#FCE7F3",  // pink-100
        },
        synora: {
          canvas: "#F7FBFC",
          card: "#FFFFFF",
          surface: "#EDF8FA",
          sand: "#DCEEEF",
          sandBorder: "#C5E4E8",
          forest: "#00B9AD",
          evergreen: "#0F292E",
          aqua: "#60C0D0",
          teal: "#00B9AD",
          ink: "#0F292E",
          muted: "#4A666C",
        },
        botanical: {
          cream: "#F7FBFC",
          ivory: "#FFFFFF",
          sand: "#EDF8FA",
          sandBorder: "#C5E4E8",
          forest: "#00B9AD",
          evergreen: "#0F292E",
          muted: "#4A666C",
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
