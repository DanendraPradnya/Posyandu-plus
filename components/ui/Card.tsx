import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "white" | "surface" | "mesh";
  padding?: "none" | "sm" | "md" | "lg";
}

const variantMap: Record<NonNullable<CardProps["variant"]>, string> = {
  white: "bg-white border border-gray-200 shadow-sm",
  surface: "bg-synora-surface border border-gray-200/80",
  mesh: "bg-synora-mesh border border-gray-200/60",
};

const paddingMap: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-3.5",
  md: "p-4",
  lg: "p-5",
};

export function Card({
  variant = "white",
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "rounded-2xl",
        variantMap[variant],
        paddingMap[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export interface StatCardProps {
  value: number | string;
  label: string;
  tone?: "default" | "warning" | "success";
  subtitle?: string;
}

const toneValueMap: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-gray-900",
  warning: "text-amber-800",
  success: "text-green-800",
};

/**
 * Kartu Metrik Ringkas gaya Synora:
 * Angka besar tabular-nums di bagian atas, garis pemisah tipis, dan label penjelas di bawah.
 */
export function StatCard({
  value,
  label,
  tone = "default",
  subtitle,
}: StatCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm">
      <div
        className={[
          "text-[28px] leading-tight font-bold tracking-tight tabular-nums",
          toneValueMap[tone],
        ].join(" ")}
      >
        {value}
      </div>
      <div className="my-2 border-t border-gray-100" />
      <div>
        <p className="text-xs font-medium leading-snug text-gray-700">{label}</p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-gray-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

