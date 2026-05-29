import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { fetchStatsCount } from "../api";
import { useFirstName } from "../hooks/useFirstName";
import { tg } from "../telegram";

interface HomeProps {
  onStart: () => void;
}

const BENEFITS = [
  { icon: "⚡", label: "5 минут" },
  { icon: "🆓", label: "Бесплатно попробовать" },
  { icon: "📥", label: "PDF в Telegram" },
] as const;

function useCountUp(target: number, durationMs = 1400) {
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || target <= 0) return;
    started.current = true;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, durationMs]);

  return value;
}

export function HomePage({ onStart }: HomeProps) {
  const [statsCount, setStatsCount] = useState(1200);
  const displayCount = useCountUp(statsCount);
  const firstName = useFirstName();

  useEffect(() => {
    void fetchStatsCount().then(setStatsCount);
  }, []);

  useEffect(() => {
    const mainButton = tg?.MainButton;
    if (!mainButton) return;

    mainButton.text = "Начать бесплатно →";
    mainButton.show();
    mainButton.onClick(onStart);

    return () => {
      mainButton.offClick(onStart);
      mainButton.hide();
    };
  }, [onStart]);

  const handleStart = () => {
    tg?.HapticFeedback?.impactOccurred("light");
    onStart();
  };

  return (
    <div
      className="min-h-screen px-4 pt-8 pb-28 flex flex-col gap-8"
      style={{ background: "var(--tg-bg)", color: "var(--tg-text)" }}
    >
      {firstName ? (
        <p className="text-base font-medium opacity-80">Привет, {firstName}! 👋</p>
      ) : (
        <p className="text-base font-medium opacity-80">Привет! 👋</p>
      )}

      <div className="flex flex-col gap-3">
        <motion.h1
          className="text-4xl font-extrabold leading-tight tracking-tight"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          Резюме за{" "}
          <span style={{ color: "var(--accent)" }}>5 минут</span>
        </motion.h1>
        <motion.p
          className="text-base leading-relaxed opacity-80"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
        >
          Для продавцов, водителей, менеджеров и всех, кто ищет работу
        </motion.p>
      </div>

      <motion.div
        className="grid grid-cols-3 gap-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2 }}
      >
        {BENEFITS.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center"
            style={{ background: "var(--accent-light)" }}
          >
            <span className="text-2xl" aria-hidden>
              {item.icon}
            </span>
            <span className="text-xs font-semibold leading-snug">{item.label}</span>
          </div>
        ))}
      </motion.div>

      <motion.p
        className="text-center text-sm font-medium"
        style={{ color: "var(--accent-dark)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        Уже помогли{" "}
        <span className="font-extrabold tabular-nums">{displayCount.toLocaleString("ru-RU")}</span>{" "}
        людям найти работу
      </motion.p>

      <button
        type="button"
        onClick={handleStart}
        className="mt-auto w-full rounded-2xl py-4 text-base font-bold shadow-sm active:opacity-90"
        style={{ background: "var(--accent)", color: "#ffffff" }}
      >
        Начать бесплатно →
      </button>
    </div>
  );
}
