import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { ensureAuthToken, generateResume } from "../api";
import { OptionButton } from "../components/OptionButton";
import { ProfessionChip } from "../components/ProfessionChip";
import { ProgressBar } from "../components/ProgressBar";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { Screen } from "../components/ui/Screen";
import { TextArea, TextInput } from "../components/ui/TextField";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import {
  ONBOARDING_STEPS,
  OPTIONS_ONLY,
  PROFESSION_PRESETS,
  professionOtherSelected,
} from "../lib/onboardingSteps";
import { useAppStore } from "../store";
import { getTg } from "../telegram";
import type { UserAnswers } from "../types";

export function OnboardingPage() {
  const {
    answers,
    setAnswer,
    setResumeResult,
    setPage,
    setFounder,
    setPaid,
    onboardingMode,
    cancelEditResume,
  } = useAppStore();

  const [step, setStep] = useState(0);
  const [value, setValue] = useState(() =>
    String(answers[ONBOARDING_STEPS[0]?.id as keyof UserAnswers] ?? ""),
  );
  const [otherProfession, setOtherProfession] = useState(() =>
    professionOtherSelected(String(answers.target_position ?? "")),
  );
  const [submitting, setSubmitting] = useState(false);

  const isEdit = onboardingMode === "edit";
  const current = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;
  const isPhoneStep = current.id === "phone";
  const showTextInput =
    current.type === "text" ||
    current.type === "profession" ||
    (current.type === "options" && !OPTIONS_ONLY.has(current.id));

  const canContinue = useMemo(() => {
    if (current.optional) return true;
    return value.trim().length > 0;
  }, [current.optional, value]);

  const goToStep = useCallback(
    (nextStep: number) => {
      setStep(nextStep);
      const next = ONBOARDING_STEPS[nextStep];
      const saved = String(answers[next.id as keyof UserAnswers] ?? "");
      setValue(saved);
      if (next.type === "profession") {
        setOtherProfession(professionOtherSelected(saved));
      } else {
        setOtherProfession(false);
      }
    },
    [answers],
  );

  const handleBack = useCallback(() => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    if (step > 0) {
      setAnswer(current.id as keyof UserAnswers, value);
      goToStep(step - 1);
      return;
    }
    if (isEdit) {
      cancelEditResume();
    } else {
      setPage("home");
    }
  }, [step, value, current.id, setAnswer, goToStep, isEdit, cancelEditResume, setPage]);

  useTelegramBackButton(handleBack);

  const next = async () => {
    if (submitting) return;
    if (!canContinue && !current.optional) return;
    getTg()?.HapticFeedback?.impactOccurred("light");
    setAnswer(current.id as keyof UserAnswers, value);

    if (!isLast) {
      goToStep(step + 1);
      return;
    }

    setSubmitting(true);
    setPage("loading");
    try {
      const token = await ensureAuthToken();
      const payload = { ...useAppStore.getState().answers };
      const response = await generateResume(token, payload);
      setResumeResult(response.resume_id, response.resume, response.paid);
      if (response.paid) {
        setFounder(true);
        setPaid(true);
      }
      useAppStore.setState({ previewReturnPage: "home" });
      setPage("preview");
    } catch (error) {
      setPage("onboarding");
      const message = error instanceof Error ? error.message : "";
      if (message === "OPEN_VIA_BOT") {
        alert("Открой приложение через бота @resumeez_bot — без этого авторизация не работает.");
      } else if (/401|авториза|токен|пользователь/i.test(message)) {
        alert("Сессия истекла. Закрой Mini App и открой снова через бота.");
      } else {
        alert(message || "Не удалось составить резюме. Проверь соединение и попробуй ещё раз.");
      }
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const skipPhone = () => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    setAnswer("phone", "");
    goToStep(step + 1);
  };

  return (
    <Screen withBottomBar className="px-4">
      <AppHeader onBack={handleBack} showBack />
      <main className="flex flex-1 flex-col gap-6 py-4">
        {isEdit && (
          <div
            className="rounded-xl px-4 py-3 text-center text-sm"
            style={{ background: "var(--brand-muted)", color: "var(--brand)" }}
          >
            Редактирование — измени нужные ответы и нажми «Пересобрать резюме»
          </div>
        )}

        <ProgressBar current={step + 1} total={ONBOARDING_STEPS.length} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="flex flex-1 flex-col gap-4"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold leading-snug">{current.question}</h2>
              {current.hint && (
                <p className="mt-2 text-base" style={{ color: "var(--text-muted)" }}>
                  {current.hint}
                </p>
              )}
            </div>

            {current.type === "profession" && (
              <>
                <div className="grid grid-cols-2 gap-3" role="group" aria-label={current.question}>
                  {PROFESSION_PRESETS.map((preset) => (
                    <ProfessionChip
                      key={preset.label}
                      label={preset.label}
                      icon={preset.icon}
                      selected={preset.value ? value === preset.value : otherProfession}
                      onSelect={() => {
                        if (preset.value) {
                          setOtherProfession(false);
                          setValue(preset.value);
                        } else {
                          setOtherProfession(true);
                          setValue("");
                        }
                        getTg()?.HapticFeedback?.selectionChanged();
                      }}
                    />
                  ))}
                </div>
                <TextInput
                  value={value}
                  onChange={(e) => {
                    setOtherProfession(true);
                    setValue(e.target.value);
                  }}
                  placeholder={current.placeholder}
                  inputMode="text"
                />
              </>
            )}

            {current.type === "options" && (
              <div className="flex flex-wrap gap-2.5" role="group" aria-label={current.question}>
                {current.options?.map((option) => (
                  <OptionButton
                    key={option}
                    label={option}
                    selected={value === option}
                    onSelect={() => {
                      setValue(option);
                      getTg()?.HapticFeedback?.selectionChanged();
                    }}
                  />
                ))}
              </div>
            )}

            {showTextInput && current.type !== "profession" && (
              <TextInput
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={current.placeholder}
                inputMode={current.id === "phone" ? "tel" : "text"}
                autoComplete={
                  current.id === "phone" ? "tel" : current.id === "name" ? "name" : "off"
                }
              />
            )}

            {current.type === "textarea" && (
              <TextArea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={current.placeholder}
                rows={5}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <FixedBottomBar>
        <div className="flex flex-col gap-2">
          {isPhoneStep && current.skipText && (
            <Button variant="ghost" onClick={skipPhone} className="!min-h-[44px] !py-2">
              {current.skipText}
            </Button>
          )}
          <Button variant="brand" onClick={next} disabled={!canContinue || submitting}>
            {submitting
              ? "Формируем…"
              : isLast
                ? isEdit
                  ? "Пересобрать резюме"
                  : "Сформировать резюме"
                : "Далее"}
          </Button>
        </div>
      </FixedBottomBar>
    </Screen>
  );
}
