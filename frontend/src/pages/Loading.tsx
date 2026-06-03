import { useEffect, useRef, useState } from "react";

import { AppHeader } from "../components/ui/AppHeader";
import { LoadingIllustration } from "../components/ui/LoadingIllustration";
import { Screen } from "../components/ui/Screen";
import { runResumeGenerate } from "../lib/runResumeGenerate";

const PHRASES = [
  "Анализирую ваш опыт...",
  "Подбираю правильные формулировки...",
  "Адаптирую под алгоритмы hh.ru...",
  "Почти готово...",
] as const;

const SECONDARY = "Создаём идеальную структуру для работодателя";
const PHRASE_MS = 3000;
const PROGRESS_MS = 12_000;
const PROGRESS_TARGET = 85;

export function LoadingPage() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const generateStarted = useRef(false);

  useEffect(() => {
    if (generateStarted.current) return;
    generateStarted.current = true;
    void runResumeGenerate();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let index = 0;
    let delayTimer = 0;
    let fadeTimer = 0;

    const scheduleNext = () => {
      if (cancelled || index >= PHRASES.length - 1) return;
      delayTimer = window.setTimeout(() => {
        if (cancelled) return;
        setPhraseVisible(false);
        fadeTimer = window.setTimeout(() => {
          if (cancelled) return;
          index += 1;
          setPhraseIndex(index);
          setPhraseVisible(true);
          scheduleNext();
        }, 200);
      }, PHRASE_MS);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      window.clearTimeout(delayTimer);
      window.clearTimeout(fadeTimer);
    };
  }, []);

  useEffect(() => {
    const start = performance.now();
    const timer = window.setInterval(() => {
      const ratio = Math.min((performance.now() - start) / PROGRESS_MS, 1);
      setProgress(Math.round(ratio * PROGRESS_TARGET));
      if (ratio >= 1) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Screen className="loading-screen px-4">
      <AppHeader />
      <main className="loading-screen__main mx-auto flex w-full max-w-md flex-1 flex-col items-center px-2">
        <LoadingIllustration />

        <div className="loading-screen__copy w-full max-w-xs shrink-0 text-center">
          <div className="loading-screen__phrase-slot">
            <h2
              className="loading-screen__phrase text-[22px] font-extrabold leading-7 tracking-tight text-[#161d19]"
              style={{ opacity: phraseVisible ? 1 : 0 }}
              aria-live="polite"
            >
              {PHRASES[phraseIndex]}
            </h2>
          </div>

          <p className="loading-screen__secondary mt-2 text-base leading-6 text-[#3f4943]">
            {SECONDARY}
          </p>

          <div className="loading-progress-block mt-6 w-full" aria-live="polite">
            <div className="loading-progress-block__meta">
              <span className="loading-progress-block__label">Подготовка резюме</span>
              <span className="loading-progress-block__pct">{progress}%</span>
            </div>
            <div
              className="loading-progress-track loading-progress-track--prominent h-3 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Подготовка резюме"
            >
              <div
                className="loading-progress-fill relative h-full rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(progress, 4)}%` }}
              >
                <div className="loading-progress-shimmer absolute inset-0" aria-hidden />
              </div>
            </div>
          </div>
        </div>
      </main>
    </Screen>
  );
}
