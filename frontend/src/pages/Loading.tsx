import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { AppHeader } from "../components/ui/AppHeader";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { getTg } from "../telegram";

const PHRASES = [
  "Подбираем идеальные слова...",
  "Структурируем навыки и опыт...",
  "Пишем раздел «О себе»...",
  "Оформляем опыт работы...",
  "Собираем финальный вариант...",
] as const;

export function LoadingPage() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const phraseTimer = window.setInterval(() => {
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
    }, 2200);
    return () => window.clearInterval(phraseTimer);
  }, []);

  useEffect(() => {
    const start = performance.now();
    const duration = 9000;
    const tick = (now: number) => {
      const elapsed = now - start;
      const ratio = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - ratio, 2);
      setProgress(Math.min(8 + eased * 87, 95));
      if (ratio < 1) requestAnimationFrame(tick);
    };
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    getTg()?.MainButton?.hide();
  }, []);

  return (
    <Screen centered className="px-4">
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="relative mb-10 flex h-44 w-44 items-center justify-center">
          <div
            className="animate-glow-pulse absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(16,185,129,0.35) 0%, rgba(16,185,129,0) 70%)",
            }}
          />
          <div
            className="relative z-10 flex h-28 w-28 items-center justify-center rounded-full shadow-brand"
            style={{ background: "var(--brand-bright)" }}
          >
            <Icon name="auto_awesome" filled size={52} style={{ color: "#ffffff" }} />
          </div>
        </div>

        <h2 className="mb-3 text-center text-2xl font-bold leading-snug">
          Создаем твое идеальное резюме...
        </h2>

        <AnimatePresence mode="wait">
          <motion.p
            key={phraseIndex}
            className="mb-10 text-center text-base"
            style={{ color: "var(--text-muted)" }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            aria-live="polite"
          >
            {PHRASES[phraseIndex]}
          </motion.p>
        </AnimatePresence>

        <div className="w-full max-w-xs">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--surface-variant)" }}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%`, background: "var(--brand-bright)" }}
            />
          </div>
        </div>
      </main>
    </Screen>
  );
}
