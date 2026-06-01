import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { AppHeader } from "../components/ui/AppHeader";
import { Screen } from "../components/ui/Screen";
import { runResumeGenerate } from "../lib/runResumeGenerate";

const PHRASES = [
  "Анализирую ваш опыт...",
  "Подбираю правильные формулировки...",
  "Форматирую под стандарты hh.ru...",
  "Почти готово...",
] as const;

const PHRASE_MS = 2500;
const PROGRESS_MS = 12_000;

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
      setProgress(Math.round(ratio * 90));
      if (ratio < 1) requestAnimationFrame(tick);
    };
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Screen centered className="px-4">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.p
            key={phraseIndex}
            className="min-h-[56px] text-center text-xl font-medium leading-snug"
            style={{ color: "var(--text-primary, #111827)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            aria-live="polite"
          >
            {PHRASES[phraseIndex]}
          </motion.p>
        </AnimatePresence>

        <div className="w-full max-w-xs">
          <div
            className="h-[3px] w-full overflow-hidden rounded-full"
            style={{ background: "var(--surface-variant, #e5e7eb)" }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={90}
            aria-label="Подготовка резюме"
          >
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%`, background: "#10b981" }}
            />
          </div>
        </div>
      </main>
    </Screen>
  );
}
