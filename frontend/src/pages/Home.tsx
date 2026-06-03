import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  HOME_BENEFITS,
  HOME_HEADLINE,
  HOME_TAGLINE,
  HOME_TRUST_POINTS,
} from "../lib/marketingCopy";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

interface HomeProps {
  onStart: () => void;
  onStartFast: () => void;
  onHistory: () => void;
}

const AVATAR_ROTATION_MS = 10 * 60 * 1000;
const AVATAR_POOL_SIZE = 8_192;
const AVATAR_DISPLAY_COUNT = 3;
const AVATAR_PALETTE = [
  { bg: "#f1f5f9", fg: "#334155" },
  { bg: "#ecfeff", fg: "#0f766e" },
  { bg: "#eff6ff", fg: "#1d4ed8" },
  { bg: "#fef3c7", fg: "#92400e" },
  { bg: "#fce7f3", fg: "#9d174d" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#dcfce7", fg: "#166534" },
  { bg: "#fee2e2", fg: "#991b1b" },
] as const;
const AVATAR_INITIALS = [
  "А",
  "Б",
  "В",
  "Г",
  "Д",
  "Е",
  "Ж",
  "З",
  "И",
  "К",
  "Л",
  "М",
  "Н",
  "О",
  "П",
  "Р",
  "С",
  "Т",
  "У",
  "Ф",
  "Х",
  "Ц",
  "Ч",
  "Ш",
  "Э",
  "Ю",
  "Я",
] as const;

function hash32(value: number): number {
  let hash = value | 0;
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return Math.abs(hash);
}

function buildAvatar(seed: number) {
  const mix = hash32(seed * 2654435761);
  const first = AVATAR_INITIALS[mix % AVATAR_INITIALS.length];
  const second = AVATAR_INITIALS[Math.floor(mix / 31) % AVATAR_INITIALS.length];
  const palette = AVATAR_PALETTE[Math.floor(mix / 997) % AVATAR_PALETTE.length];
  return {
    id: `${seed}-${mix}`,
    label: `${first}${second}`,
    bg: palette.bg,
    fg: palette.fg,
  };
}

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

export function HomePage({ onStart, onStartFast, onHistory }: HomeProps) {
  const { homeTab, setHomeTab } = useAppStore();
  const [statsCount, setStatsCount] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [avatarBucket, setAvatarBucket] = useState(() => Math.floor(Date.now() / AVATAR_ROTATION_MS));
  const displayCount = useCountUp(statsCount);
  const isFounder = useFounderStatus();

  useEffect(() => {
    getTg()?.MainButton?.hide();
    const loadStats = () => void fetchStatsCount().then(setStatsCount);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(loadStats, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(loadStats, 300);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const syncBucket = () => setAvatarBucket(Math.floor(Date.now() / AVATAR_ROTATION_MS));
    let intervalId: number | undefined;
    const now = Date.now();
    const msToNextBucket = AVATAR_ROTATION_MS - (now % AVATAR_ROTATION_MS);
    const timeoutId = window.setTimeout(() => {
      syncBucket();
      intervalId = window.setInterval(syncBucket, AVATAR_ROTATION_MS);
    }, msToNextBucket);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const socialAvatars = useMemo(() => {
    const base = (avatarBucket * 104_729) % AVATAR_POOL_SIZE;
    return Array.from({ length: AVATAR_DISPLAY_COUNT }, (_, idx) => {
      const seed = (base + idx * 1_363) % AVATAR_POOL_SIZE;
      return buildAvatar(seed);
    });
  }, [avatarBucket]);

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

  const statsDisplay =
    statsCount > 0 ? `${displayCount.toLocaleString("ru-RU")}+` : "1 200+";

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
            {HOME_HEADLINE}
          </h2>
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {HOME_TAGLINE}
          </p>
        </div>

        <div className="home-social-proof w-full px-2">
          <div className="home-social-avatars" aria-hidden>
            {socialAvatars.map((avatar, idx) => (
              <motion.span
                key={`${avatarBucket}-${avatar.id}`}
                className="home-social-avatar"
                style={{ background: avatar.bg, color: avatar.fg }}
                initial={{ opacity: 0, y: 6, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, delay: idx * 0.06 }}
              >
                {avatar.label}
              </motion.span>
            ))}
          </div>
          <p className="home-social-proof-text">
            Уже{" "}
            <span className="tabular-nums font-semibold" style={{ color: "#10b981" }}>
              {statsDisplay}
            </span>{" "}
            резюме отправлено на hh.ru
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 pb-1">
          {HOME_BENEFITS.map((item, i) => (
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
            {HOME_TRUST_POINTS.map((item, i) => (
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
            Не понравилось? В боте нажмите «Почему мы» — или напишите в поддержку: вернём Stars.
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
              onStartFast();
            }}
            className="flex items-center justify-center gap-2"
          >
            <Icon name="bolt" size={20} />
            Быстрое резюме (6 вопросов)
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
