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
      className="space-y-3"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-2.5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-2/5 rounded bg-gray-200" />
            <div className="h-5 w-20 rounded-full bg-gray-200" />
          </div>
          {Array.from({ length: Math.max(1, lines - 1) }).map((__, lineIdx) => (
            <div
              key={lineIdx}
              className="h-3.5 w-3/4 rounded bg-gray-100"
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
      className="rounded-2xl border border-red-300 bg-[#FEE2E2]/60 p-4 text-left space-y-3"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-[#B91C1C]">{title}</h3>
        <p className="text-sm text-gray-800">{message}</p>
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
    <div className="rounded-2xl border border-dashed border-gray-300 bg-synora-surface p-6 text-center space-y-3">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-700">
        <svg
          className="h-6 w-6"
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
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-1">
          <Button variant="primary" onClick={onAction}>
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
  info: "border-sky-300 bg-[#E0F2FE] text-[#0284C7]",
};

export function Toast({ tone = "info", message, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm",
        toastToneStyles[tone],
      ].join(" ")}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup pemberitahuan"
          className="inline-flex min-h-[48px] min-w-[48px] -my-2 -mr-2 items-center justify-center rounded-lg text-current hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
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

