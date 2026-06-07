import { useEffect, useState } from "react";

import { LoadingIllustration } from "../ui/LoadingIllustration";

const DEFAULT_PHRASES = [
  "Загружаем ваше резюме…",
  "Готовим предпросмотр PDF…",
  "Адаптируем под формат hh.ru…",
  "Почти готово…",
] as const;

const PHRASE_MS = 2800;
const PROGRESS_MS = 10_000;
const PROGRESS_TARGET = 92;

export interface PreviewAssemblyLoaderProps {
  phrases?: readonly string[];
  secondary?: string;
  /** Compact layout inside preview slot (default: full main area). */
  variant?: "full" | "compact";
}

export function PreviewAssemblyLoader({
  phrases = DEFAULT_PHRASES,
  secondary = "Секунду — собираем экран предпросмотра",
  variant = "full",
}: PreviewAssemblyLoaderProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let index = 0;
    let delayTimer = 0;
    let fadeTimer = 0;

    const scheduleNext = () => {
      if (cancelled || index >= phrases.length - 1) return;
      delayTimer = window.setTimeout(() => {
        if (cancelled) return;
        setPhraseVisible(false);
        fadeTimer = window.setTimeout(() => {
          if (cancelled) return;
          index += 1;
          setPhraseIndex(index);
          setPhraseVisible(true);
          scheduleNext();
        }, 180);
      }, PHRASE_MS);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      window.clearTimeout(delayTimer);
      window.clearTimeout(fadeTimer);
    };
  }, [phrases.length]);

  useEffect(() => {
    const start = performance.now();
    const timer = window.setInterval(() => {
      const ratio = Math.min((performance.now() - start) / PROGRESS_MS, 1);
      setProgress(Math.round(ratio * PROGRESS_TARGET));
      if (ratio >= 1) window.clearInterval(timer);
    }, 80);
    return () => window.clearInterval(timer);
  }, []);

  const rootClass =
    variant === "full"
      ? "preview-assembly-loader preview-assembly-loader--full"
      : "preview-assembly-loader preview-assembly-loader--compact";

  return (
    <div className={rootClass} aria-busy="true" aria-label="Загружаем предпросмотр">
      <LoadingIllustration />

      <div className="preview-assembly-loader__copy">
        <div className="preview-assembly-loader__phrase-slot">
          <p
            className="preview-assembly-loader__phrase"
            style={{ opacity: phraseVisible ? 1 : 0 }}
            aria-live="polite"
          >
            {phrases[phraseIndex]}
          </p>
        </div>

        <p className="preview-assembly-loader__secondary">{secondary}</p>

        <div className="preview-assembly-loader__progress-track">
          <div
            className="loading-assembly__progress preview-assembly-loader__progress-bar"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Загрузка предпросмотра"
          >
            <div className="loading-assembly__progress-pulse" aria-hidden />
          </div>
        </div>

        <div className="preview-assembly-loader__percent-row">
          <span className="preview-assembly-loader__percent">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
