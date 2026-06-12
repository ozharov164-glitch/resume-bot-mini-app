import { useCallback, useEffect, useRef, useState } from "react";

import { deleteResumePhoto, ensureAuthToken, uploadResumePhoto } from "../../api";
import { useAppStore } from "../../store";
import { Button } from "./Button";

const ACCEPT = "image/jpeg,image/png,image/webp";
const JPEG_QUALITY = 0.85;
const MAX_LONG_EDGE = 1200;
const TARGET_ASPECT = 3 / 4;

type PhotoUploadMode = "store" | "api";

export interface PhotoUploadProps {
  variant?: "default" | "compact";
  mode?: PhotoUploadMode;
  resumeId?: string | null;
  authToken?: string | null;
  onChanged?: () => void;
  showSkip?: boolean;
}

function stripDataUrlPrefix(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось загрузить изображение"));
    };
    img.src = url;
  });
}

function cropImageTo34(img: HTMLImageElement, zoom: number): HTMLCanvasElement {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const z = Math.max(1, Math.min(2.5, zoom));

  let cropW: number;
  let cropH: number;
  if (iw / ih > TARGET_ASPECT) {
    cropH = ih / z;
    cropW = cropH * TARGET_ASPECT;
  } else {
    cropW = iw / z;
    cropH = cropW / TARGET_ASPECT;
  }
  cropW = Math.min(cropW, iw);
  cropH = Math.min(cropH, ih);

  const sx = (iw - cropW) / 2;
  const sy = (ih - cropH) / 2;

  const longEdge = Math.max(cropW, cropH);
  const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
  const outW = Math.round(cropW * scale);
  const outH = Math.round(cropH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);
  return canvas;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Не удалось сжать фото"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Ошибка чтения файла"));
        return;
      }
      resolve(stripDataUrlPrefix(result));
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsDataURL(blob);
  });
}

export function PhotoUpload({
  variant = "default",
  mode = "store",
  resumeId = null,
  authToken = null,
  onChanged,
  showSkip = false,
}: PhotoUploadProps) {
  const { photoJpegBase64, setPhotoJpegBase64 } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgBroken, setImgBroken] = useState(false);
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCompact = variant === "compact";

  useEffect(() => {
    setImgBroken(false);
    if (photoJpegBase64?.trim()) {
      setPreviewUrl(`data:image/jpeg;base64,${photoJpegBase64}`);
    } else if (!sourceImg) {
      setPreviewUrl(null);
    }
  }, [photoJpegBase64, sourceImg]);

  const persistCrop = useCallback(
    async (img: HTMLImageElement, zoomLevel: number) => {
      setBusy(true);
      setError(null);
      try {
        const canvas = cropImageTo34(img, zoomLevel);
        const blob = await canvasToJpegBlob(canvas);
        const base64 = await blobToBase64(blob);
        const objectUrl = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return objectUrl;
        });

        if (mode === "store") {
          setPhotoJpegBase64(base64);
        } else if (resumeId) {
          const token = authToken || (await ensureAuthToken());
          await uploadResumePhoto(token, resumeId, blob);
          setPhotoJpegBase64(base64);
          onChanged?.();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Не удалось обработать фото";
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [authToken, mode, onChanged, resumeId, setPhotoJpegBase64],
  );

  const scheduleApply = useCallback(
    (img: HTMLImageElement, zoomLevel: number) => {
      if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
      applyTimerRef.current = setTimeout(() => {
        void persistCrop(img, zoomLevel);
      }, 280);
    },
    [persistCrop],
  );

  useEffect(() => {
    return () => {
      if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (sourceImg) scheduleApply(sourceImg, zoom);
  }, [sourceImg, zoom, scheduleApply]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const img = await loadImage(file);
      setSourceImg(img);
      setZoom(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть файл");
    }
  };

  const handleRemove = async () => {
    setError(null);
    setSourceImg(null);
    setZoom(1);
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPhotoJpegBase64(null);
    if (inputRef.current) inputRef.current.value = "";

    if (mode === "api" && resumeId) {
      setBusy(true);
      try {
        const token = authToken || (await ensureAuthToken());
        await deleteResumePhoto(token, resumeId);
        onChanged?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось удалить фото");
      } finally {
        setBusy(false);
      }
    }
  };

  const handleSkip = () => {
    void handleRemove();
  };

  const hasPhoto = Boolean((previewUrl || photoJpegBase64?.trim()) && !imgBroken);

  return (
    <section className={`photo-upload${isCompact ? " photo-upload--compact" : ""}`}>
      <div className="photo-upload__header">
        <h3 className="photo-upload__title">Фото для резюме (необязательно)</h3>
        {!isCompact ? (
          <p className="photo-upload__hint">
            Портрет 3:4, как на hh.ru — повышает отклики. Можно добавить позже или пропустить.
          </p>
        ) : null}
      </div>

      {hasPhoto ? (
        <div className="photo-upload__preview">
          <img
            src={previewUrl || (photoJpegBase64 ? `data:image/jpeg;base64,${photoJpegBase64}` : "")}
            alt="Предпросмотр фото"
            className="photo-upload__preview-img"
            onError={() => setImgBroken(true)}
          />
        </div>
      ) : null}

      {sourceImg ? (
        <div className="photo-upload__crop">
          <label className="photo-upload__zoom-label" htmlFor="photo-zoom">
            Масштаб
          </label>
          <input
            id="photo-zoom"
            type="range"
            min={1}
            max={2.5}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="photo-upload__zoom"
          />
        </div>
      ) : null}

      {error ? <p className="photo-upload__error">{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="photo-upload__input"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <div className="photo-upload__actions">
        <Button
          variant="secondary"
          fullWidth={!isCompact}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="photo-upload__btn"
        >
          {hasPhoto ? "Заменить фото" : "Добавить фото"}
        </Button>
        {hasPhoto ? (
          <Button
            variant="ghost"
            fullWidth={!isCompact}
            disabled={busy}
            onClick={() => void handleRemove()}
            className="photo-upload__btn"
          >
            Удалить
          </Button>
        ) : null}
        {showSkip && !hasPhoto ? (
          <Button variant="ghost" disabled={busy} onClick={handleSkip} className="photo-upload__btn">
            Пропустить
          </Button>
        ) : null}
      </div>
    </section>
  );
}
