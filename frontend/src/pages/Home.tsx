import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { fetchStatsCount } from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { FounderBadge } from "../components/ui/FounderBadge";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { useFounderStatus } from "../hooks/useFounderStatus";
import { getTg } from "../telegram";

interface HomeProps {
  onStart: () => void;
}

const BENEFITS = [
  {
    icon: "edit_document" as const,
    title: "ИИ напишет текст за тебя",
    subtitle: "Просто ответь на пару вопросов.",
  },
  {
    icon: "picture_as_pdf" as const,
    title: "Готовый PDF в чат сразу",
    subtitle: "Скачай и отправляй работодателю.",
  },
] as const;

const HERO_SRC = `${import.meta.env.BASE_URL}hero.jpg`;

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
  const [statsCount, setStatsCount] = useState(12450);
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
      <main className="flex flex-1 flex-col gap-6 px-4 pt-2">
        {isFounder && <FounderBadge />}

        <div className="flex flex-col gap-3 text-center">
          <h2 className="text-2xl font-bold leading-tight tracking-tight">
            Ваше профессиональное резюме за 5 минут.
          </h2>
          <p className="text-base" style={{ color: "var(--text-muted)" }}>
            Помогаем водителям, строителям и мастерам получить работу мечты.
          </p>
        </div>

        <motion.div
          className="overflow-hidden rounded-xl border shadow-sm"
          style={{ borderColor: "var(--border-subtle)" }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <img src={HERO_SRC} alt="" className="block h-auto w-full object-cover" />
        </motion.div>

        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--brand)" }}>
            <Icon name="verified" filled size={20} />
            <span>Соответствует стандартам hh.ru</span>
          </div>
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Уже помогли{" "}
            <span className="stat-number tabular-nums">{displayCount.toLocaleString("ru-RU")}</span> людям
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {BENEFITS.map((item, i) => (
            <motion.div
              key={item.title}
              className="flex items-start gap-4 rounded-xl border p-4"
              style={{
                background: "var(--surface-elevated)",
                borderColor: "var(--border-subtle)",
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--brand-muted)" }}
              >
                <Icon name={item.icon} filled className="text-primary" size={22} />
              </div>
              <div className="flex flex-col gap-1 pt-0.5">
                <span className="text-sm font-semibold">{item.title}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
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
