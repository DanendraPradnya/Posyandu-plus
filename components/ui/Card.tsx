import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "white" | "surface" | "mesh";
  padding?: "none" | "sm" | "md" | "lg";
}

const variantMap: Record<NonNullable<CardProps["variant"]>, string> = {
  white: "bg-white border border-[#D5ECEF] shadow-[0_1px_3px_rgba(15,41,46,0.04)]",
  surface: "bg-[#EDF8FA] border border-[#C5E4E8]",
  mesh: "bg-synora-mesh text-[#0F292E] border border-[#60C0D0]/40 shadow-sm",
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
  tone?: "default" | "warning" | "success" | "danger";
  subtitle?: string;
}

const toneValueMap: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-[#0F292E]",
  warning: "text-amber-700",
  success: "text-[#009E94]",
  danger: "text-[#B91C1C]",
};

export function StatCard({
  value,
  label,
  tone = "default",
  subtitle,
}: StatCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-[#D5ECEF] bg-white p-3.5 shadow-[0_1px_2px_rgba(15,41,46,0.04)]">
      <div
        className={[
          "text-2xl leading-tight font-bold tracking-tight tabular-nums",
          toneValueMap[tone],
        ].join(" ")}
      >
        {value}
      </div>
      <div className="my-2 border-t border-[#EDF8FA]" />
      <div>
        <p className="text-xs font-medium leading-snug text-[#4A666C]">{label}</p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-[#648288]">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
