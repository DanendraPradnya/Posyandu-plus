/**
 * Utilitas Token Tautan Bagikan & Anonimisasi Nama (FR13, Fase 3 - B10)
 */

import crypto from "node:crypto";

const DEFAULT_EXPIRY_DAYS = 30;

export function getShareLinkExpiryDays(): number {
  const raw = Number(process.env.SHARE_LINK_DEFAULT_EXPIRY_DAYS ?? DEFAULT_EXPIRY_DAYS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_EXPIRY_DAYS;
  return Math.floor(raw);
}

export function generateShareToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string): string {
  const pepper = process.env.SHARE_LINK_TOKEN_PEPPER ?? "posyandu-plus-default-pepper";
  return crypto
    .createHmac("sha256", pepper)
    .update(token)
    .digest("hex");
}

/**
 * Mengubah nama lengkap menjadi nama panggilan/inisial agar halaman publik
 * tidak menampilkan nama lengkap, NIK, atau kontak (FR13).
 */
export function maskChildName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Ananda";
  if (parts.length === 1) {
    const first = parts[0]!;
    return first.length <= 2 ? first : `${first.slice(0, 3)}.`;
  }
  const first = parts[0]!;
  const restInitials = parts
    .slice(1)
    .map((p) => `${p.charAt(0).toUpperCase()}.`)
    .join(" ");
  return `${first} ${restInitials}`;
}

