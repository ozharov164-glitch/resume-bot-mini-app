import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { ensureAuthToken, suggestSkills } from "../api";
import { OptionButton } from "../components/OptionButton";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { LoadingIllustration } from "../components/ui/LoadingIllustration";
import { Screen } from "../components/ui/Screen";
import { TextInput } from "../components/ui/TextField";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { skillsOptionsForPosition, SKILLS_FALLBACK_BY_POSITION } from "../lib/onboardingSteps";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

const PHRASES = [
  "Анализируем профессию...",
  "Изучаем требования рынка...",
  "Подбираем ключевые навыки...",
  "Группируем профессиональные и личные навыки...",
  "Формируем список для выбора...",
] as const;

type Phase = "loading" | "ready" | "error";

export function SkillPickPage() {
  const { answers, setAnswer, setPage, onboardingStep, setOnboardingStep } = useAppStore();
  const position = String(answers.target_position ?? "").trim();

  const [phase, setPhase] = useState<Phase>("loading");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [progress, setProgress] = useState(8);
  const [skillOptions, setSkillOptions] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(() =>
    Array.isArray(answers.skills) ? [...answers.skills] : [],
  );
  const [customSkill, setCustomSkill] = useState("");

  useEffect(() => {
    if (phase !== "loading") return;
    const phraseTimer = window.setInterval(() => {
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
    }, 1800);
    return () => window.clearInterval(phraseTimer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "loading") return;
    const start = performance.now();
    const duration = 4500;
    const tick = (now: number) => {
      const ratio = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - ratio, 2);
      setProgress(Math.min(8 + eased * 72, 88));
      if (ratio < 1) requestAnimationFrame(tick);
    };
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    const fallback = [...skillsOptionsForPosition(SKILLS_FALLBACK_BY_POSITION, position)];

    const load = async () => {
      if (!position) {
        setSkillOptions(fallback);
        setPhase("ready");
        setProgress(100);
        return;
      }

      try {
        const token = await ensureAuthToken();
        const result = await suggestSkills(token, position);
        if (cancelled) return;
        const skills = result.skills?.length ? result.skills : fallback;
        setSkillOptions(skills);
        setPhase("ready");
        setProgress(100);
      } catch {
        if (cancelled) return;
        setSkillOptions(fallback);
        setPhase("error");
        setProgress(100);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [position]);

  const handleBack = useCallback(() => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    setOnboardingStep(Math.max(0, onboardingStep - 1));
    setPage("onboarding");
  }, [onboardingStep, setOnboardingStep, setPage]);

  useTelegramBackButton(handleBack);

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
    getTg()?.HapticFeedback?.selectionChanged();
  };

  const addCustomSkill = () => {
    const trimmed = customSkill.trim();
    if (!trimmed || selectedSkills.includes(trimmed)) return;
    setSelectedSkills((prev) => [...prev, trimmed]);
    if (!skillOptions.includes(trimmed)) {
      setSkillOptions((prev) => [...prev, trimmed]);
    }
    setCustomSkill("");
    getTg()?.HapticFeedback?.impactOccurred("light");
  };

  const continueFlow = () => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    setAnswer("skills", selectedSkills);
    setPage("onboarding");
  };

  const showSkills = phase === "ready" || phase === "error";

  return (
    <Screen withBottomBar className="px-4">
      <AppHeader onBack={handleBack} showBack />
      <main className="flex flex-1 flex-col gap-5 py-4">
        {!showSkills && (
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center">
            <LoadingIllustration />
            <h2 className="mb-2 text-center text-2xl font-bold leading-snug">
              Подбираем навыки для «{position || "вашей должности"}»
            </h2>
            <AnimatePresence mode="wait">
              <motion.p
                key={phraseIndex}
                className="mb-6 min-h-[24px] text-center text-base"
                style={{ color: "var(--text-variant, #3c4a42)" }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                aria-live="polite"
              >
                {PHRASES[phraseIndex]}
              </motion.p>
            </AnimatePresence>
            <div className="mt-2 w-full max-w-xs">
              <div
                className="loading-progress-track h-2 w-full overflow-hidden rounded-full"
                role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="loading-progress-fill relative h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                >
                  <div className="loading-progress-shimmer absolute inset-0" aria-hidden />
                </div>
              </div>
            </div>
          </div>
        )}

        {showSkills && (
          <motion.div
            className="flex flex-1 flex-col gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold leading-snug">Выбери свои навыки</h2>
              <p className="mt-2 text-base" style={{ color: "var(--text-muted)" }}>
                ИИ подобрал навыки для «{position}». Отметь те, что у тебя есть.
              </p>
              {phase === "error" && (
                <p className="mt-2 text-sm" style={{ color: "var(--brand)" }}>
                  Показан резервный список — выбери подходящие.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5" role="group" aria-label="Навыки">
              {skillOptions.map((skill, index) => (
                <motion.div
                  key={skill}
                  initial={{ opacity: 0, scale: 0.92, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.22 }}
                >
                  <OptionButton
                    label={skill}
                    selected={selectedSkills.includes(skill)}
                    onSelect={() => toggleSkill(skill)}
                  />
                </motion.div>
              ))}
            </div>

            <div className="relative w-full">
              <TextInput
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                placeholder="Свой навык, например R-Keeper"
                inputMode="text"
                className="pr-14"
                aria-label="Добавить свой навык"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomSkill();
                  }
                }}
              />
              <button
                type="button"
                onClick={addCustomSkill}
                disabled={!customSkill.trim()}
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-xl font-semibold transition-opacity disabled:opacity-35"
                style={{
                  background: "var(--brand-muted)",
                  color: "var(--brand)",
                }}
                aria-label="Добавить навык"
              >
                +
              </button>
            </div>

            {selectedSkills.length > 0 && (
              <p className="text-center text-sm font-medium" style={{ color: "var(--brand)" }}>
                Выбрано: {selectedSkills.length}
              </p>
            )}
          </motion.div>
        )}
      </main>

      {showSkills && (
        <FixedBottomBar>
          <Button variant="brand" onClick={continueFlow}>
            {selectedSkills.length > 0 ? "Далее" : "Пропустить"}
          </Button>
        </FixedBottomBar>
      )}
    </Screen>
  );
}
