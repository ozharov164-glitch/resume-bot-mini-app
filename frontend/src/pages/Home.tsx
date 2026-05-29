import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { fetchStatsCount } from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { FounderBadge } from "../components/ui/FounderBadge";
import { HeroIllustration } from "../components/ui/HeroIllustration";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { useFounderStatus } from "../hooks/useFounderStatus";
import { getTg } from "../telegram";

interface HomeProps {
  onStart: () => void;
  onHistory: () => void;
}

const BENEFITS = [
  {
    icon: "smart_toy" as const,
    title: "ИИ напишет текст за тебя",
    subtitle: "Ответь на пару вопросов, остальное сделает бот.",
  },
  {
    icon: "send" as const,
    title: "Готовый PDF в чат сразу",
    subtitle: "Скачивай и отправляй работодателю без долгих регистраций.",
  },
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

export function HomePage({ onStart, onHistory }: HomeProps) {
  const [statsCount, setStatsCount] = useState(10000);
  const displayCount = useCountUp(statsCount);
  const isFounder = useFounderStatus();

  useEffect(() => {
    void fetchStatsCount().then(setStatsCount);
    getTg()?.MainButton?.hide();
  }, []);

  const start = () => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    onStart();
  };

  return (
    <Screen withBottomBar bottomBarButtons={2}>
      <AppHeader />
      <main className="flex flex-1 flex-col items-center gap-4 px-4 pt-2 pb-2">
        {isFounder && <FounderBadge />}

        <HeroIllustration />

        <div className="flex w-full flex-col gap-2 px-2 text-center">
          <h2 className="text-[22px] font-bold leading-tight tracking-tight">
            Ваше профессиональное резюме за 5 минут
          </h2>
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Помогаем водителям, строителям и мастерам получить работу мечты.
          </p>
        </div>

        <div className="flex w-full flex-wrap justify-center gap-2">
          <div
            className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--surface-card)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
          >
            <Icon name="verified" filled size={16} style={{ color: "var(--brand)" }} />
            <span>Соответствует стандартам hh.ru</span>
          </div>
          <div
            className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--surface-card)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
          >
            <Icon name="group" filled size={16} style={{ color: "var(--brand)" }} />
            <span>
              Уже помогли{" "}
              <span className="stat-number tabular-nums">{displayCount.toLocaleString("ru-RU")}+</span> человек
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 pb-1">
          {BENEFITS.map((item, i) => (
            <motion.div
              key={item.title}
              className="stitch-card flex items-start gap-4 p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.08 }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--brand-muted)" }}
              >
                <Icon name={item.icon} filled size={22} style={{ color: "var(--brand)" }} />
              </div>
              <div className="flex flex-col gap-1 pt-0.5">
                <span className="text-sm font-semibold leading-snug">{item.title}</span>
                <span className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {item.subtitle}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <FixedBottomBar>
        <div className="flex flex-col gap-2">
          <Button variant="brand" onClick={start} className="flex items-center justify-center gap-2">
            Создать резюме
            <Icon name="arrow_forward" size={20} />
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              getTg()?.HapticFeedback?.impactOccurred("light");
              onHistory();
            }}
            className="flex items-center justify-center gap-2"
          >
            <Icon name="history" size={20} />
            Мои резюме
          </Button>
        </div>
      </FixedBottomBar>
    </Screen>
  );
}
