import React from "react";
import Link from "next/link";

export interface BrandLogoProps {
  href?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtitle?: string;
  className?: string;
}

const sizeDimensionMap: Record<NonNullable<BrandLogoProps["size"]>, { px: number; boxClass: string; textClass: string }> = {
  sm: {
    px: 30,
    boxClass: "h-8 w-8",
    textClass: "text-sm",
  },
  md: {
    px: 36,
    boxClass: "h-9 w-9",
    textClass: "text-base",
  },
  lg: {
    px: 44,
    boxClass: "h-11 w-11",
    textClass: "text-lg",
  },
};

/**
 * Identitas visual resmi Posyandu+ menggunakan `Posyandu-logo.png` (Ibu-Anak & Tunas Daun).
 */
export function BrandLogo({
  href = "/",
  size = "md",
  showText = true,
  subtitle,
  className = "",
}: BrandLogoProps) {
  const dim = sizeDimensionMap[size];

  const content = (
    <>
      <span
        className={[
          "inline-flex shrink-0 items-center justify-center rounded-xl bg-white p-1 border border-[#D5ECEF] shadow-sm",
          dim.boxClass,
        ].join(" ")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/posyandu-logo.png"
          alt="Logo Posyandu+"
          width={dim.px}
          height={dim.px}
          className="h-full w-full object-contain"
        />
      </span>
      {showText && (
        <span className="flex flex-col leading-tight">
          <span
            className={[
              "font-bold tracking-tight text-[#0F292E]",
              dim.textClass,
            ].join(" ")}
          >
            Posyandu<span className="text-[#00B9AD]">+</span>
          </span>
          {subtitle && (
            <span className="text-[11px] font-medium text-[#4A666C]">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </>
  );

  if (!href) {
    return (
      <div
        className={["inline-flex items-center gap-2.5", className]
          .filter(Boolean)
          .join(" ")}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={[
        "inline-flex min-h-[44px] items-center gap-2.5 rounded-xl pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B9AD]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {content}
    </Link>
  );
}

