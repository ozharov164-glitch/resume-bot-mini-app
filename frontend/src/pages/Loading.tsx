import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { AppHeader } from "../components/ui/AppHeader";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { getTg } from "../telegram";

const PHRASES = [
  "Структурируем навыки и опыт...",
  "Пишем раздел «О себе»...",
  "Оформляем опыт работы...",
  "Подбираем ключевые навыки...",
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
    const duration = 9000;
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
  }, []);

  return (
    <Screen centered className="px-4">
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="relative mb-8 flex h-48 w-48 items-center justify-center">
          <div
            className="absolute inset-0 animate-pulse rounded-full"
            style={{ background: "var(--brand-muted)" }}
          />
          <div
            className="relative z-10 flex h-32 w-24 flex-col overflow-hidden rounded-xl border p-4 shadow-lg"
            style={{
              background: "#ffffff",
              borderColor: "var(--border-subtle)",
            }}
          >
            <div className="mb-2 h-2 w-full rounded" style={{ background: "var(--surface-variant, #dde4dd)" }} />
            <div className="mb-2 h-2 w-3/4 rounded" style={{ background: "var(--surface-variant, #dde4dd)" }} />
            <div className="mb-2 h-2 w-5/6 rounded" style={{ background: "var(--surface-variant, #dde4dd)" }} />
            <div className="mb-4 h-2 w-full rounded" style={{ background: "var(--surface-variant, #dde4dd)" }} />
            <div className="mt-auto h-2 w-1/2 rounded" style={{ background: "rgba(16,185,129,0.3)" }} />
            <div
              className="animate-scan absolute inset-x-0 h-1 opacity-80"
              style={{
                background: "var(--brand-bright)",
                boxShadow: "0 0 8px rgba(16,185,129,0.6)",
              }}
            />
          </div>
          <Icon name="star" filled className="absolute right-4 top-4 animate-bounce text-primary" size={28} />
          <Icon
            name="check_circle"
            filled
            className="absolute bottom-8 left-2 opacity-70"
            size={24}
            style={{ color: "var(--brand)" }}
          />
        </div>

        <h2 className="mb-2 text-center text-2xl font-bold">Создаем твое идеальное резюме...</h2>

        <AnimatePresence mode="wait">
          <motion.p
            key={phraseIndex}
            className="mb-8 text-center text-base"
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

        <div className="mt-4 w-full max-w-xs">
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ background: "var(--surface-container-high, #e3eae3)" }}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%`, background: "var(--brand)" }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            <span>Анализ данных</span>
            <span className="font-bold" style={{ color: "var(--brand)" }}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </main>
    </Screen>
  );
}
