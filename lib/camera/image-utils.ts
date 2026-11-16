/**
 * Utilitas Kualitas Foto, Crop, dan Kompresi Sisi Klien (FR3, Fase 2 - C5)
 * Target kompresi <= 1 MB (1.000.000 byte) tanpa menurunkan keterbacaan tabel Buku KIA.
 */

export interface NormalizedCropRect {
  x: number; // 0..1
  y: number; // 0..1
  width: number; // 0..1
  height: number; // 0..1
}

export interface PhotoQualityReport {
  isDark: boolean;
  isBlurry: boolean;
  brightnessScore: number;
  sharpnessScore: number;
  warnings: string[];
}

export const TARGET_MAX_IMAGE_BYTES = 1_000_000;
const DARK_BRIGHTNESS_THRESHOLD = 55;
const BLUR_LAPLACIAN_THRESHOLD = 45;

/**
 * Menganalisis kecerahan (luminance) dan ketajaman (varians Laplacian) dari buffer piksel RGBA.
 * Fungsi murni agar dapat diuji langsung di Vitest tanpa DOM.
 */
export function analyzeImageDataQuality(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): PhotoQualityReport {
  if (width < 3 || height < 3 || rgba.length < width * height * 4) {
    return {
      isDark: false,
      isBlurry: false,
      brightnessScore: 128,
      sharpnessScore: 100,
      warnings: [],
    };
  }

  const totalPixels = width * height;
  const gray = new Float32Array(totalPixels);
  let brightnessSum = 0;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const r = rgba[offset] ?? 0;
    const g = rgba[offset + 1] ?? 0;
    const b = rgba[offset + 2] ?? 0;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = lum;
    brightnessSum += lum;
  }

  const brightnessScore = brightnessSum / totalPixels;

  // Hitung varians Laplacian 4-tetangga pada piksel interior
  let lapSum = 0;
  let lapSqSum = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const top = gray[idx - width] ?? 0;
      const bottom = gray[idx + width] ?? 0;
      const left = gray[idx - 1] ?? 0;
      const right = gray[idx + 1] ?? 0;
      const center = gray[idx] ?? 0;
      const lap = top + bottom + left + right - 4 * center;
      lapSum += lap;
      lapSqSum += lap * lap;
      count++;
    }
  }

  const mean = count > 0 ? lapSum / count : 0;
  const sharpnessScore = count > 0 ? lapSqSum / count - mean * mean : 100;

  const isDark = brightnessScore < DARK_BRIGHTNESS_THRESHOLD;
  const isBlurry = sharpnessScore < BLUR_LAPLACIAN_THRESHOLD;

  const warnings: string[] = [];
  if (isDark) {
    warnings.push("Foto terlihat terlalu gelap. Nyalakan lampu atau pindah ke tempat terang.");
  }
  if (isBlurry) {
    warnings.push("Foto terlihat buram/goyang. Tahan kamera stabil dan fokuskan ke angka tabel.");
  }

  return {
    isDark,
    isBlurry,
    brightnessScore: Math.round(brightnessScore),
    sharpnessScore: Math.round(sharpnessScore),
    warnings,
  };
}

/**
 * Mengevaluasi kualitas elemen gambar HTML menggunakan canvas berukuran kecil.
 */
export function evaluateHtmlImageQuality(img: HTMLImageElement): PhotoQualityReport {
  const sampleMaxDim = 320;
  const scale = Math.min(1, sampleMaxDim / Math.max(img.naturalWidth, img.naturalHeight, 1));
  const w = Math.max(8, Math.round(img.naturalWidth * scale));
  const h = Math.max(8, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      isDark: false,
      isBlurry: false,
      brightnessScore: 128,
      sharpnessScore: 100,
      warnings: [],
    };
  }

  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  return analyzeImageDataQuality(imageData.data, w, h);
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Gagal mengonversi gambar hasil crop."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * Memotong gambar sesuai area crop lalu mengompresinya hingga <= 1 MB.
 */
export async function cropAndCompressImage(
  img: HTMLImageElement,
  crop: NormalizedCropRect,
  maxBytes: number = TARGET_MAX_IMAGE_BYTES
): Promise<{ blob: Blob; width: number; height: number; qualityUsed: number }> {
  const sx = Math.max(0, Math.round(crop.x * img.naturalWidth));
  const sy = Math.max(0, Math.round(crop.y * img.naturalHeight));
  const sw = Math.max(32, Math.round(crop.width * img.naturalWidth));
  const sh = Math.max(32, Math.round(crop.height * img.naturalHeight));

  const clampedSw = Math.min(sw, img.naturalWidth - sx);
  const clampedSh = Math.min(sh, img.naturalHeight - sy);

  let targetWidth = clampedSw;
  let targetHeight = clampedSh;

  // Batasi sisi terpanjang awal ke 1800px agar teks tabel tetap tajam namun ukuran ringan
  const maxInitialSide = 1800;
  if (Math.max(targetWidth, targetHeight) > maxInitialSide) {
    const ratio = maxInitialSide / Math.max(targetWidth, targetHeight);
    targetWidth = Math.round(targetWidth * ratio);
    targetHeight = Math.round(targetHeight * ratio);
  }

  const qualities = [0.88, 0.76, 0.64, 0.52];
  let lastBlob: Blob | null = null;
  let lastQuality = 0.88;

  for (let scaleAttempt = 0; scaleAttempt < 3; scaleAttempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D tidak tersedia di peramban ini.");
    }
    ctx.drawImage(
      img,
      sx,
      sy,
      clampedSw,
      clampedSh,
      0,
      0,
      targetWidth,
      targetHeight
    );

    for (const q of qualities) {
      const blob = await canvasToBlob(canvas, q);
      lastBlob = blob;
      lastQuality = q;
      if (blob.size <= maxBytes) {
        return {
          blob,
          width: targetWidth,
          height: targetHeight,
          qualityUsed: q,
        };
      }
    }

    // Jika masih > maxBytes, perkecil dimensi 80% lalu ulangi
    targetWidth = Math.max(320, Math.round(targetWidth * 0.8));
    targetHeight = Math.max(320, Math.round(targetHeight * 0.8));
  }

  if (!lastBlob) {
    throw new Error("Gagal mengompresi foto.");
  }

  return {
    blob: lastBlob,
    width: targetWidth,
    height: targetHeight,
    qualityUsed: lastQuality,
  };
}
