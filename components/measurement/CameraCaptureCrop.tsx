"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  cropAndCompressImage,
  evaluateHtmlImageQuality,
  type NormalizedCropRect,
  type PhotoQualityReport,
} from "@/lib/camera/image-utils";

export interface CameraCaptureCropProps {
  onPhotoReady: (file: File, previewUrl: string) => void;
  onSwitchToManual: () => void;
  isSubmitting?: boolean;
}

const DEFAULT_CROP: NormalizedCropRect = {
  x: 0.04,
  y: 0.04,
  width: 0.92,
  height: 0.92,
};

export function CameraCaptureCrop({
  onPhotoReady,
  onSwitchToManual,
  isSubmitting = false,
}: CameraCaptureCropProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewImgRef = useRef<HTMLImageElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [qualityReport, setQualityReport] = useState<PhotoQualityReport | null>(null);
  const [cropTop, setCropTop] = useState(4);
  const [cropBottom, setCropBottom] = useState(96);
  const [cropLeft, setCropLeft] = useState(4);
  const [cropRight, setCropRight] = useState(96);
  const [isCompressing, setIsCompressing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (rawImageUrl && rawImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(rawImageUrl);
      }
    };
  }, [rawImageUrl, stopCamera]);

  const startRearCamera = async () => {
    setCameraError(null);
    setProcessError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Peramban tidak mendukung akses kamera langsung. Gunakan tombol Unggah / Ambil Foto di bawah."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraActive(true);

      // Tunggu elemen video siap
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCameraError(
        "Izin kamera tidak diberikan atau kamera belakang tidak tersedia. Anda dapat memilih foto dari galeri/kamera ponsel."
      );
    }
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    stopCamera();
    setRawImageUrl(dataUrl);
    setQualityReport(null);
    resetCrop();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessError(null);
    stopCamera();

    const objectUrl = URL.createObjectURL(file);
    setRawImageUrl(objectUrl);
    setQualityReport(null);
    resetCrop();
  };

  const resetCrop = () => {
    setCropTop(Math.round(DEFAULT_CROP.y * 100));
    setCropBottom(Math.round((DEFAULT_CROP.y + DEFAULT_CROP.height) * 100));
    setCropLeft(Math.round(DEFAULT_CROP.x * 100));
    setCropRight(Math.round((DEFAULT_CROP.x + DEFAULT_CROP.width) * 100));
  };

  const handleImageLoaded = () => {
    if (!previewImgRef.current) return;
    const report = evaluateHtmlImageQuality(previewImgRef.current);
    setQualityReport(report);
  };

  const handleRetake = () => {
    setRawImageUrl(null);
    setQualityReport(null);
    setProcessError(null);
  };

  const handleConfirmCropAndExtract = async () => {
    if (!previewImgRef.current) return;
    setIsCompressing(true);
    setProcessError(null);

    try {
      const safeLeft = Math.min(cropLeft, cropRight - 10);
      const safeTop = Math.min(cropTop, cropBottom - 10);
      const cropRect: NormalizedCropRect = {
        x: safeLeft / 100,
        y: safeTop / 100,
        width: (cropRight - safeLeft) / 100,
        height: (cropBottom - safeTop) / 100,
      };

      const { blob } = await cropAndCompressImage(previewImgRef.current, cropRect);
      const compressedFile = new File([blob], `kia-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      const reader = new FileReader();
      reader.onload = () => {
        const previewDataUrl =
          typeof reader.result === "string" ? reader.result : rawImageUrl ?? "";
        onPhotoReady(compressedFile, previewDataUrl);
      };
      reader.readAsDataURL(blob);
    } catch (err: unknown) {
      setProcessError(
        err instanceof Error ? err.message : "Gagal memproses foto sebelum dikirim."
      );
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <Card variant="white" padding="md" className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-[#0F292E]">
          Foto Tabel Buku KIA (Hal. 127 / 128)
        </h2>
        <p className="text-xs text-[#4A666C]">
          Arahkan kamera ke tabel pemantauan pertumbuhan. Potong (crop) bagian nama/NIK bila
          terlihat untuk menjaga privasi.
        </p>
      </div>

      {/* Mode 1: Belum ada foto dan kamera belum aktif */}
      {!rawImageUrl && !cameraActive && (
        <div className="space-y-3">
          {cameraError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {cameraError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={startRearCamera}
            >
              Buka Kamera Belakang
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelected}
              className="hidden"
              aria-label="Pilih foto Buku KIA dari perangkat"
            />
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => fileInputRef.current?.click()}
            >
              Pilih Foto dari Galeri / Kamera HP
            </Button>

            <Button
              type="button"
              variant="ghost"
              fullWidth
              onClick={onSwitchToManual}
            >
              Atau Catat via Input Manual
            </Button>
          </div>
        </div>
      )}

      {/* Mode 2: Kamera live aktif */}
      {cameraActive && !rawImageUrl && (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-[#C5E4E8] bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full max-h-[380px] object-contain"
            />
            <div
              className="pointer-events-none absolute inset-4 rounded-xl border-2 border-dashed border-[#00B9AD]/80"
              aria-hidden="true"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" onClick={stopCamera}>
              Batal
            </Button>
            <Button type="button" variant="primary" onClick={captureFromVideo}>
              Ambil Foto
            </Button>
          </div>
        </div>
      )}

      {/* Mode 3: Pratinjau, Cek Kualitas, & Crop */}
      {rawImageUrl && (
        <div className="space-y-4">
          {qualityReport && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                qualityReport.isDark || qualityReport.isBlurry
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                <span>
                  {qualityReport.isDark || qualityReport.isBlurry
                    ? "Peringatan Kualitas Foto"
                    : "Kualitas Foto Baik"}
                </span>
                <span className="tabular-nums text-[11px] opacity-80">
                  Kecerahan: {qualityReport.brightnessScore} | Ketajaman:{" "}
                  {qualityReport.sharpnessScore}
                </span>
              </div>
              {qualityReport.warnings.length > 0 && (
                <ul className="mt-1.5 list-disc pl-4 space-y-0.5">
                  {qualityReport.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="relative overflow-hidden rounded-2xl border border-[#C5E4E8] bg-[#0F292E]/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={previewImgRef}
              src={rawImageUrl}
              alt="Pratinjau foto Buku KIA"
              onLoad={handleImageLoaded}
              className="w-full max-h-[360px] object-contain mx-auto block"
            />
            {/* Visualisasi area crop */}
            <div
              className="pointer-events-none absolute border-2 border-[#00B9AD] bg-[#00B9AD]/10"
              style={{
                top: `${cropTop}%`,
                left: `${cropLeft}%`,
                width: `${Math.max(10, cropRight - cropLeft)}%`,
                height: `${Math.max(10, cropBottom - cropTop)}%`,
              }}
            />
          </div>

          <div className="rounded-xl border border-[#DCEEEF] bg-[#F7FBFC] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0F292E]">
                Sesuaikan Area Crop Tabel
              </span>
              <button
                type="button"
                onClick={resetCrop}
                className="text-xs font-semibold text-[#00857C] hover:underline min-h-[36px] px-2"
              >
                Reset Crop
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-[#4A666C]">
              <label className="space-y-1">
                <span>Batas Atas ({cropTop}%)</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, cropBottom - 15)}
                  value={cropTop}
                  onChange={(e) => setCropTop(Number(e.target.value))}
                  className="w-full accent-[#00B9AD]"
                />
              </label>
              <label className="space-y-1">
                <span>Batas Bawah ({cropBottom}%)</span>
                <input
                  type="range"
                  min={Math.min(100, cropTop + 15)}
                  max={100}
                  value={cropBottom}
                  onChange={(e) => setCropBottom(Number(e.target.value))}
                  className="w-full accent-[#00B9AD]"
                />
              </label>
              <label className="space-y-1">
                <span>Batas Kiri ({cropLeft}%)</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, cropRight - 15)}
                  value={cropLeft}
                  onChange={(e) => setCropLeft(Number(e.target.value))}
                  className="w-full accent-[#00B9AD]"
                />
              </label>
              <label className="space-y-1">
                <span>Batas Kanan ({cropRight}%)</span>
                <input
                  type="range"
                  min={Math.min(100, cropLeft + 15)}
                  max={100}
                  value={cropRight}
                  onChange={(e) => setCropRight(Number(e.target.value))}
                  className="w-full accent-[#00B9AD]"
                />
              </label>
            </div>
          </div>

          {processError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {processError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleRetake}
              disabled={isCompressing || isSubmitting}
            >
              Foto Ulang
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmCropAndExtract}
              isLoading={isCompressing || isSubmitting}
            >
              Ekstrak Data
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

