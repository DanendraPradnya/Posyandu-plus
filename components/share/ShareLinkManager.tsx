"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";

interface ShareLinkItem {
  id: string;
  child_id: string;
  expires_at: string;
  revoked_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
}

export interface ShareLinkManagerProps {
  childId: string;
}

export function ShareLinkManager({ childId }: ShareLinkManagerProps) {
  const [links, setLinks] = useState<ShareLinkItem[]>([]);
  const [latestUrl, setLatestUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/share-links?child_id=${encodeURIComponent(childId)}`);
      const data = await res.json();
      if (res.ok) {
        setLinks((data.shareLinks ?? []) as ShareLinkItem[]);
      }
    } catch {
      // Abaikan jika gagal memuat daftar awal
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const handleCreateLink = async () => {
    setIsCreating(true);
    setErrorMsg(null);
    setCopied(false);

    try {
      const res = await fetch("/api/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ child_id: childId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Gagal membuat tautan bagikan.");
      }

      setLatestUrl(data.shareUrl as string);
      await loadLinks();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal membuat tautan bagikan."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/share-links/${linkId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Gagal mencabut tautan.");
      }
      await loadLinks();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal mencabut tautan."
      );
    }
  };

  const handleCopy = async () => {
    if (!latestUrl) return;
    try {
      await navigator.clipboard.writeText(latestUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card variant="white" padding="md" className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-bold text-[#0F292E]">
          Tautan Bagikan untuk Orang Tua (Read-Only)
        </h2>
        <p className="text-xs text-[#4A666C]">
          Tautan ini dapat dibuka Orang Tua di ponsel tanpa login, berlaku 30 hari, dan tidak
          menampilkan nama lengkap, NIK, atau kontak.
        </p>
      </div>

      <Button
        type="button"
        variant="primary"
        fullWidth
        onClick={handleCreateLink}
        isLoading={isCreating}
      >
        Buat Tautan Bagikan Baru
      </Button>

      {latestUrl && (
        <div className="rounded-xl border border-[#00B9AD] bg-[#EDF8FA] p-3 space-y-2">
          <p className="text-xs font-bold text-[#0F292E]">
            Tautan Siap Dibagikan (simpan sekarang, token tidak ditampilkan ulang):
          </p>
          <p className="break-all rounded-lg bg-white p-2 text-xs font-mono text-[#0F292E] border border-[#C5E4E8]">
            {latestUrl}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? "Tersalin!" : "Salin Tautan"}
            </Button>
            <a
              href={latestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#00B9AD] px-4 py-2 text-xs font-semibold text-white hover:bg-[#009E94] transition-colors"
            >
              Buka Pratinjau
            </a>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      {!isLoading && links.length > 0 && (
        <div className="space-y-2 pt-1">
          <h3 className="text-xs font-bold text-[#0F292E]">
            Riwayat Tautan ({links.length})
          </h3>
          <ul className="space-y-2">
            {links.map((item) => {
              const isRevoked = Boolean(item.revoked_at);
              const isExpired = new Date(item.expires_at).getTime() <= Date.now();
              const isActive = !isRevoked && !isExpired;

              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#DCEEEF] p-2.5 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {isRevoked ? "Dicabut" : isExpired ? "Kedaluwarsa" : "Aktif"}
                      </span>
                      <span className="text-[#4A666C] tabular-nums">
                        Dibuka {item.access_count}x
                      </span>
                    </div>
                    <p className="text-[11px] text-[#4A666C] tabular-nums">
                      Berlaku s.d. {item.expires_at.slice(0, 10)}
                    </p>
                  </div>

                  {isActive && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleRevoke(item.id)}
                    >
                      Cabut
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

