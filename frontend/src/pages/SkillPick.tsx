import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";

import { ensureAuthToken, suggestSkills } from "../api";
import { SkillPill } from "../components/SkillPill";
import { trackEvent } from "../lib/analytics";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { LoadingIllustration } from "../components/ui/LoadingIllustration";
import { LoadingProgressStrip } from "../components/ui/LoadingProgressStrip";
import { Screen } from "../components/ui/Screen";
import { TextInput } from "../components/ui/TextField";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { skillsOptionsForPosition, SKILLS_FALLBACK_BY_POSITION } from "../lib/onboardingSteps";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

const SKILL_GROUPS: Array<{ key: string; title: string }> = [
  { key: "hard", title: "Профессиональные навыки" },
  { key: "tools", title: "Инструменты" },
  { key: "soft", title: "Личные качества" },
];

function splitSkillsHeuristic(skills: string[]): Record<string, string[]> {
  const n = skills.length;
  if (n === 0) return { hard: [], tools: [], soft: [] };
  const hardEnd = Math.max(1, Math.ceil(n * 0.4));
  const toolsEnd = hardEnd + Math.max(1, Math.ceil(n * 0.3));
  return {
    hard: skills.slice(0, hardEnd),
    tools: skills.slice(hardEnd, toolsEnd),
    soft: skills.slice(toolsEnd),
  };
}

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
  const [skillGroups, setSkillGroups] = useState<Record<string, string[]>>({});
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
        setSkillGroups({});
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
        setSkillGroups(result.groups ?? {});
        setPhase("ready");
        setProgress(100);
      } catch {
        if (cancelled) return;
        setSkillOptions(fallback);
        setSkillGroups({});
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
    trackEvent("skills_confirmed", { count: selectedSkills.length });
    setPage("onboarding");
  };

  const groupedEntries = SKILL_GROUPS.map(({ key, title }) => ({
    key,
    title,
    skills: (skillGroups[key] ?? []).filter(Boolean),
  })).filter((g) => g.skills.length > 0);
  const useGrouped = groupedEntries.length > 0;
  const heuristicGroups = splitSkillsHeuristic(skillOptions);
  const flatGroups = SKILL_GROUPS.map(({ key, title }) => ({
    key,
    title,
    skills: heuristicGroups[key] ?? [],
  })).filter((g) => g.skills.length > 0);

  const renderSkillChip = (skill: string) => (
    <SkillPill
      key={skill}
      label={skill}
      selected={selectedSkills.includes(skill)}
      onSelect={() => toggleSkill(skill)}
    />
  );

  const showSkills = phase === "ready" || phase === "error";

  return (
    <Screen
      withBottomBar
      className={clsx("skill-pick-page px-4", !showSkills && "skill-pick-page--loading")}
    >
      <AppHeader onBack={handleBack} showBack title="Навыки" />
      <main
        className={clsx(
          "skill-pick-main flex min-h-0 flex-1 flex-col gap-5 py-4",
          showSkills ? "overflow-y-auto overscroll-y-contain" : "overflow-hidden",
        )}
      >
        {!showSkills ? (
          <div className="skill-pick-loading mx-auto flex w-full max-w-md flex-col items-center px-2">
            <LoadingIllustration />
            <div className="loading-screen__copy w-full max-w-xs shrink-0 text-center">
              <h2 className="text-[22px] font-extrabold leading-7 tracking-tight text-[#161d19]">
                Подбираем навыки для «{position || "вашей должности"}»
              </h2>
              <div className="skill-pick-loading__phrase mt-2">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={phraseIndex}
                    className="text-base leading-6 text-[#3f4943]"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    aria-live="polite"
                  >
                    {PHRASES[phraseIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
              <LoadingProgressStrip progress={progress} label="Подбор навыков" />
            </div>
          </div>
        ) : (
          <motion.div
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold leading-snug">Выберите свои навыки</h2>
              <p className="mt-2 text-base" style={{ color: "var(--text-muted)" }}>
                ИИ подобрал навыки для «{position}». Отметьте те, что у вас есть.
              </p>
              {phase === "error" && (
                <p className="mt-2 text-sm" style={{ color: "var(--brand)" }}>
                  Показан резервный список — выберите подходящие.
                </p>
              )}
            </div>

            {(useGrouped ? groupedEntries : flatGroups).map((group) => (
              <div key={group.key} className="flex flex-col gap-2.5">
                <h3 className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-gray-400 first:mt-0">
                  {group.title}
                </h3>
                <div className="flex flex-wrap gap-2.5" role="group" aria-label={group.title}>
                  {group.skills.map((skill) => renderSkillChip(skill))}
                </div>
              </div>
            ))}

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

      <FixedBottomBar>
        {showSkills ? (
          <Button variant="brand" onClick={continueFlow}>
            {selectedSkills.length > 0 ? "Далее" : "Пропустить"}
          </Button>
        ) : (
          <div className="skill-pick-bottom-placeholder" aria-hidden>
            Далее
          </div>
        )}
      </FixedBottomBar>
    </Screen>
  );
}
