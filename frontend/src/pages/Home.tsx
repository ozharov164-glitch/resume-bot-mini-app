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
}

const BENEFITS = [
  {
    icon: "auto_awesome" as const,
    title: "ИИ выведет текст на новый уровень",
    subtitle: "Современные формулировки под стандарты hh.ru.",
  },
  {
    icon: "send" as const,
    title: "Готовый PDF прямо в чат",
    subtitle: "Отправляй работодателю сразу после оплаты.",
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

export function HomePage({ onStart }: HomeProps) {
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
    <Screen withBottomBar>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-5 px-4 pt-3">
        {isFounder && <FounderBadge />}

        <HeroIllustration />

        <div className="flex flex-col gap-2 text-center">
          <h2 className="text-2xl font-bold leading-tight tracking-tight">
            Ваше профессиональное резюме за 5 минут
          </h2>
          <p className="text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Поможем составить грамотное и наглядное резюме, чтобы найти работу мечты.
          </p>
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--brand)" }}>
            <Icon name="verified" filled size={18} />
            <span>
              Составили{" "}
              <span className="stat-number tabular-nums">{displayCount.toLocaleString("ru-RU")}+</span> резюме
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
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
        <Button variant="brand" onClick={start} className="flex items-center justify-center gap-2">
          Создать резюме
          <Icon name="arrow_forward" size={20} />
        </Button>
      </FixedBottomBar>
    </Screen>
  );
}
