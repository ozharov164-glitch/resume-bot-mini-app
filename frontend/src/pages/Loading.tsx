import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

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
  const [progress, setProgress] = useState(0);
  const generateStarted = useRef(false);

  useEffect(() => {
    if (generateStarted.current) return;
    generateStarted.current = true;
    void runResumeGenerate();
  }, []);

  useEffect(() => {
    const phraseTimer = window.setInterval(() => {
      setPhraseIndex((i) => Math.min(i + 1, PHRASES.length - 1));
    }, PHRASE_MS);
    return () => window.clearInterval(phraseTimer);
  }, []);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const ratio = Math.min((now - start) / PROGRESS_MS, 1);
      setProgress(Math.round(ratio * PROGRESS_TARGET));
      if (ratio < 1) requestAnimationFrame(tick);
    };
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Screen centered className="px-4">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-2 py-8">
        <LoadingIllustration />

        <div className="w-full max-w-xs text-center">
          <AnimatePresence mode="wait">
            <motion.h2
              key={phraseIndex}
              className="loading-assembly__status mb-2 min-h-[56px] text-[22px] font-extrabold leading-7 tracking-tight text-[#161d19]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              aria-live="polite"
            >
              {PHRASES[phraseIndex]}
            </motion.h2>
          </AnimatePresence>

          <p className="text-base leading-6 text-[#3f4943]">{SECONDARY}</p>

          <div className="relative mt-6 w-full overflow-hidden rounded-full bg-[#f4f4f5]">
            <div
              className="loading-assembly__progress relative h-[3px] rounded-full bg-[#10b981] transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={PROGRESS_TARGET}
              aria-label="Подготовка резюме"
            >
              <div className="loading-assembly__progress-pulse absolute right-0 top-0 h-full w-4 bg-white/60 blur-[2px]" />
            </div>
          </div>

          <div className="mt-2 w-full text-right">
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#10b981]">
              {progress}%
            </span>
          </div>
        </div>
      </main>
    </Screen>
  );
}
