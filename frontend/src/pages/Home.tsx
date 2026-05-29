import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { fetchStatsCount } from "../api";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Screen } from "../components/ui/Screen";
import { useFirstName } from "../hooks/useFirstName";
import { useMainButton } from "../hooks/useMainButton";
import { tg } from "../telegram";

interface HomeProps {
  onStart: () => void;
}

const BENEFITS = [
  { icon: "⚡", label: "5 минут", short: "Быстро" },
  { icon: "🆓", label: "Бесплатно попробовать", short: "Пробный" },
  { icon: "📥", label: "PDF в Telegram", short: "В чат" },
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
  const hasMainButton = Boolean(tg?.MainButton);

  useEffect(() => {
    void fetchStatsCount().then(setStatsCount);
  }, []);

  useMainButton("Начать бесплатно →", () => {
    tg?.HapticFeedback?.impactOccurred("light");
    onStart();
  });

  const greeting = firstName ? `Привет, ${firstName}! 👋` : "Привет! 👋";

  return (
    <Screen withMainButton className="gap-7 pt-8">
      <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
        {greeting}
      </p>

      <PageHeader
        title={
          <>
            Резюме за <span className="accent-highlight">5 минут</span>
          </>
        }
        subtitle="Для продавцов, водителей, менеджеров и всех, кто ищет работу"
      />

      <motion.div
        className="grid grid-cols-3 gap-2.5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
      >
        {BENEFITS.map((item) => (
          <Card key={item.label} variant="benefit" className="!p-3 flex flex-col items-center gap-2 text-center min-h-[108px]">
            <span className="text-2xl leading-none" aria-hidden>
              {item.icon}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wide opacity-70">{item.short}</span>
            <span className="text-xs font-bold leading-snug">{item.label}</span>
          </Card>
        ))}
      </motion.div>

      <motion.p
        className="stat-line text-center text-sm -mt-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Уже помогли{" "}
        <span className="stat-number tabular-nums text-base">{displayCount.toLocaleString("ru-RU")}</span> людям
        найти работу
      </motion.p>

      {!hasMainButton && (
        <motion.div className="mt-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
          <button
            type="button"
            onClick={() => {
              tg?.HapticFeedback?.impactOccurred("light");
              onStart();
            }}
            className="w-full rounded-2xl py-4 text-base font-bold min-h-[52px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: "var(--accent)", color: "var(--on-accent)", outlineColor: "var(--accent)" }}
          >
            Начать бесплатно →
          </button>
        </motion.div>
      )}
    </Screen>
  );
}
