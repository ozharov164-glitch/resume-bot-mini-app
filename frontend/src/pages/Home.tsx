import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { fetchStatsCount } from "../api";
import { ExamplesGallery } from "../components/examples/ExamplesGallery";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { FounderBadge } from "../components/ui/FounderBadge";
import { HeroIllustration } from "../components/ui/HeroIllustration";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { useFounderStatus } from "../hooks/useFounderStatus";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { useAppStore } from "../store";
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

const TRUST_POINTS = [
  {
    icon: "visibility" as const,
    title: "Сначала смотри — потом плати",
    subtitle: "Бесплатный предпросмотр до оплаты. Риска нет.",
  },
  {
    icon: "verified" as const,
    title: "Формат hh.ru",
    subtitle: "HR привык к такому виду — не откладывают в стопку.",
  },
  {
    icon: "savings" as const,
    title: "149 ₽ вместо 500–1000 ₽",
    subtitle: "Дешевле конкурентов, качество — как у дорогих сервисов.",
  },
  {
    icon: "lock" as const,
    title: "Данные только для резюме",
    subtitle: "Не продаём и не передаём третьим лицам.",
  },
] as const;

function useCountUp(target: number, durationMs = 1400) {
  const [value, setValue] = useState(0);
  const animatingTarget = useRef(0);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    if (animatingTarget.current === target) return;
    animatingTarget.current = target;
    setValue(0);

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
  const { homeTab, setHomeTab } = useAppStore();
  const [statsCount, setStatsCount] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
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

  const switchTab = (next: typeof homeTab) => {
    getTg()?.HapticFeedback?.selectionChanged();
    setHomeTab(next);
  };

  const handleBack = useCallback(() => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    if (lightboxOpen) {
      setLightboxOpen(false);
      return;
    }
    if (homeTab === "examples") {
      setHomeTab("main");
    }
  }, [homeTab, lightboxOpen, setHomeTab]);

  useTelegramBackButton(homeTab === "examples" ? handleBack : null);

  const statsLabel =
    statsCount > 0
      ? `${displayCount.toLocaleString("ru-RU")}+`
      : "…";

  return (
    <Screen withBottomBar bottomBarButtons={2}>
      <AppHeader
        onBack={homeTab === "examples" ? handleBack : undefined}
        showBack={homeTab === "examples"}
      />

      <div className="home-tabs px-4 pt-1">
        <div className="home-tabs-track" role="tablist" aria-label="Разделы главной">
          <button
            type="button"
            role="tab"
            aria-selected={homeTab === "main"}
            className={`home-tab${homeTab === "main" ? " home-tab--active" : ""}`}
            onClick={() => switchTab("main")}
          >
            Главная
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={homeTab === "examples"}
            className={`home-tab${homeTab === "examples" ? " home-tab--active" : ""}`}
            onClick={() => switchTab("examples")}
          >
            <Icon name="description" size={16} />
            Примеры резюме
          </button>
        </div>
      </div>

      {homeTab === "examples" ? (
        <main className="examples-tab-main flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pt-2">
          <ExamplesGallery
            onStart={start}
            onLightboxOpenChange={setLightboxOpen}
            lightboxOpen={lightboxOpen}
          />
        </main>
      ) : (
      <main className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto overscroll-y-contain px-4 pt-2 pb-2">
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
            <Icon name="description" filled size={16} style={{ color: "var(--brand)" }} />
            <span>
              Уже создано{" "}
              <span className="stat-number tabular-nums">{statsLabel}</span> резюме
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

        <section className="home-trust w-full">
          <div className="home-trust-header">
            <Icon name="shield" filled size={20} style={{ color: "var(--brand)" }} />
            <h3 className="home-trust-title">Почему нам доверяют</h3>
          </div>
          <div className="home-trust-grid">
            {TRUST_POINTS.map((item, i) => (
              <motion.div
                key={item.title}
                className="home-trust-card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + i * 0.06 }}
              >
                <Icon name={item.icon} filled size={18} style={{ color: "var(--brand)" }} />
                <div className="home-trust-card-text">
                  <span className="home-trust-card-title">{item.title}</span>
                  <span className="home-trust-card-sub">{item.subtitle}</span>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="home-trust-footnote">
            Не понравилось? Напиши в поддержку бота — вернём Stars.
          </p>
        </section>
      </main>
      )}

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
