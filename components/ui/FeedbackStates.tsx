import React from "react";
import { Button } from "./Button";

export interface SkeletonCardProps {
  lines?: number;
  count?: number;
}

export function SkeletonCard({ lines = 3, count = 3 }: SkeletonCardProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Sedang memuat data"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-2xl border border-[#D5ECEF] bg-white p-4 shadow-sm space-y-2.5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-2/5 rounded bg-[#EDF8FA]" />
            <div className="h-5 w-20 rounded-full bg-[#EDF8FA]" />
          </div>
          {Array.from({ length: Math.max(1, lines - 1) }).map((__, lineIdx) => (
            <div
              key={lineIdx}
              className="h-3.5 w-3/4 rounded bg-[#F4FAFB]"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export interface ErrorBoxProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorBox({
  title = "Gagal memuat data",
  message,
  onRetry,
  retryLabel = "Coba Lagi",
}: ErrorBoxProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-[#FEE2E2]/60 p-4 text-left space-y-3"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-[#B91C1C]">{title}</h3>
        <p className="text-xs text-[#0F292E]">{message}</p>
      </div>
      {onRetry && (
        <div>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[#C5E4E8] bg-[#EDF8FA]/60 p-6 text-center space-y-3">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-[#C5E4E8] text-[#00B9AD] shadow-sm">
        <svg
          className="h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.75}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
          />
        </svg>
      </div>
      <div className="space-y-1 max-w-md mx-auto">
        <h3 className="text-sm font-semibold text-[#0F292E]">{title}</h3>
        <p className="text-xs text-[#4A666C]">{description}</p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-1">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export interface ToastProps {
  tone?: "success" | "warning" | "error" | "info";
  message: string;
  onDismiss?: () => void;
}

const toastToneStyles: Record<NonNullable<ToastProps["tone"]>, string> = {
  success: "border-green-300 bg-[#DCFCE7] text-[#15803D]",
  warning: "border-amber-300 bg-[#FEF3C7] text-[#B45309]",
  error: "border-red-300 bg-[#FEE2E2] text-[#B91C1C]",
  info: "border-[#60C0D0] bg-[#EDF8FA] text-[#00857C]",
};

export function Toast({ tone = "info", message, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs font-medium shadow-sm",
        toastToneStyles[tone],
      ].join(" ")}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup pemberitahuan"
          className="inline-flex h-8 w-8 -my-1 -mr-1 items-center justify-center rounded-lg text-current hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B9AD]"
        >
          <svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
