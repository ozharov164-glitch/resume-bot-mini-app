import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { AppHeader } from "../components/ui/AppHeader";
import { LoadingIllustration } from "../components/ui/LoadingIllustration";
import { Screen } from "../components/ui/Screen";
import { getTg } from "../telegram";

const PHRASES = [
  "Структурируем навыки и опыт...",
  "Пишем раздел «О себе»...",
  "Оформляем опыт работы...",
  "Подбираем ключевые навыки...",
  "Собираем макет в выбранном шаблоне...",
  "Полируем формулировки...",
  "Собираем финальный вариант...",
] as const;

export function LoadingPage() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const phraseTimer = window.setInterval(() => {
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
    }, 2000);
    return () => window.clearInterval(phraseTimer);
  }, []);

  useEffect(() => {
    const start = performance.now();
    const duration = 75_000;
    const tick = (now: number) => {
      const elapsed = now - start;
      const ratio = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - ratio, 2);
      setProgress(Math.min(12 + eased * 83, 95));
      if (ratio < 1) requestAnimationFrame(tick);
    };
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    getTg()?.MainButton?.hide();
    const tg = getTg();
    if (!tg?.HapticFeedback) return;
    const hapticTimer = window.setInterval(() => {
      tg.HapticFeedback?.impactOccurred("light");
    }, 1500);
    return () => window.clearInterval(hapticTimer);
  }, []);

  const progressLabel = Math.round(progress);

  return (
    <Screen centered className="px-4">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-8">
        <LoadingIllustration />

        <h2 className="mb-2 text-center text-2xl font-bold leading-snug">
          Создаём ваше идеальное резюме…
        </h2>
        <p className="mb-3 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Обычно 20–60 секунд — ИИ пишет текст и структуру
        </p>

        <AnimatePresence mode="wait">
          <motion.p
            key={phraseIndex}
            className="mb-6 min-h-[24px] text-center text-base"
            style={{ color: "var(--text-variant, #3c4a42)" }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            aria-live="polite"
          >
            {PHRASES[phraseIndex]}
          </motion.p>
        </AnimatePresence>

        <div className="mt-4 w-full max-w-xs">
          <div
            className="loading-progress-track h-2 w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={progressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Прогресс составления резюме"
          >
            <div
              className="loading-progress-fill relative h-full rounded-full transition-[width] duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="loading-progress-shimmer absolute inset-0" aria-hidden />
            </div>
          </div>
          <div
            className="mt-2 flex justify-between text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            <span>Анализ данных</span>
            <span className="font-bold" style={{ color: "var(--brand)" }}>
              {progressLabel}%
            </span>
          </div>
        </div>
      </main>
    </Screen>
  );
}
