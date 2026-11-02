import React from "react";

export type BadgeStatusType =
  | "Normal"
  | "Waspada"
  | "Berisiko"
  | "Kritis"
  | "Belum Diukur"
  | "Aktif"
  | "Nonaktif"
  | "M"
  | "F";

export interface StatusBadgeProps {
  status: BadgeStatusType;
  label?: string;
  className?: string;
}

const badgeStyleMap: Record<
  BadgeStatusType,
  { bg: string; text: string; dot: string; defaultLabel: string }
> = {
  Normal: {
    bg: "bg-[#DCFCE7] border-green-300",
    text: "text-[#15803D]",
    dot: "bg-[#15803D]",
    defaultLabel: "Normal",
  },
  Waspada: {
    bg: "bg-[#FEF3C7] border-amber-300",
    text: "text-[#B45309]",
    dot: "bg-[#B45309]",
    defaultLabel: "Waspada",
  },
  Berisiko: {
    bg: "bg-[#FFEDD5] border-orange-300",
    text: "text-[#C2410C]",
    dot: "bg-[#C2410C]",
    defaultLabel: "Berisiko",
  },
  Kritis: {
    bg: "bg-[#FEE2E2] border-red-300",
    text: "text-[#B91C1C]",
    dot: "bg-[#B91C1C]",
    defaultLabel: "Kritis",
  },
  "Belum Diukur": {
    bg: "bg-gray-100 border-gray-300",
    text: "text-gray-700",
    dot: "bg-gray-500",
    defaultLabel: "Belum Diukur",
  },
  Aktif: {
    bg: "bg-[#DCFCE7] border-green-300",
    text: "text-[#15803D]",
    dot: "bg-[#15803D]",
    defaultLabel: "Aktif",
  },
  Nonaktif: {
    bg: "bg-[#FEE2E2] border-red-300",
    text: "text-[#B91C1C]",
    dot: "bg-[#B91C1C]",
    defaultLabel: "Nonaktif",
  },
  M: {
    bg: "bg-[#E0F2FE] border-sky-300",
    text: "text-[#0284C7]",
    dot: "bg-[#0284C7]",
    defaultLabel: "Laki-laki",
  },
  F: {
    bg: "bg-[#FCE7F3] border-pink-300",
    text: "text-[#DB2777]",
    dot: "bg-[#DB2777]",
    defaultLabel: "Perempuan",
  },
};

export function StatusBadge({ status, label, className = "" }: StatusBadgeProps) {
  const style = badgeStyleMap[status];

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
        style.bg,
        style.text,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={["h-1.5 w-1.5 rounded-full", style.dot].join(" ")}
        aria-hidden="true"
      />
      <span>{label ?? style.defaultLabel}</span>
    </span>
  );
}

