import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Screen } from "../components/ui/Screen";

const PHRASES = [
  "✍️ Пишу раздел «О себе»...",
  "📋 Оформляю опыт работы...",
  "⚡ Подбираю ключевые навыки...",
  "✨ Полирую формулировки...",
  "📄 Собираю финальный вариант...",
  "🔍 Проверяю ещё раз...",
] as const;

const SKELETON_WIDTHS = ["88%", "72%", "94%", "60%", "78%"] as const;

export function LoadingPage() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const phraseTimer = window.setInterval(() => {
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
    }, 1500);
    return () => window.clearInterval(phraseTimer);
  }, []);

  useEffect(() => {
    const start = performance.now();
    const duration = 8000;
    const tick = (now: number) => {
      const elapsed = now - start;
      const ratio = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - ratio, 2);
      setProgress(Math.min(eased * 95, 95));
      if (ratio < 1) requestAnimationFrame(tick);
    };
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Screen className="gap-8">
      <PageHeader eyebrow="Почти готово" title="Пишу твоё резюме" subtitle="Обычно занимает 4–6 секунд" />

      <div
        className="h-2.5 w-full rounded-full overflow-hidden"
        style={{ background: "var(--tg-secondary-bg)" }}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Прогресс составления резюме"
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, var(--tg-button), var(--accent))",
          }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center min-h-[100px]">
        <AnimatePresence mode="wait">
          <motion.p
            key={phraseIndex}
            className="text-lg font-bold leading-snug px-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            aria-live="polite"
          >
            {PHRASES[phraseIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <Card variant="resume" className="!p-5 flex flex-col gap-3" aria-hidden>
        <div className="skeleton-line h-5 w-[55%]" />
        <div className="skeleton-line h-4 w-[40%]" />
        {SKELETON_WIDTHS.map((width) => (
          <div key={width} className="skeleton-line h-3" style={{ width }} />
        ))}
      </Card>
    </Screen>
  );
}
