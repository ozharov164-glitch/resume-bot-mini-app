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
  SALARY_CUSTOM_OPTION,
  normalizeSalaryDigits,
  professionOtherSelected,
  salaryFromOption,
} from "../lib/onboardingSteps";
import { useAppStore } from "../store";
import { getTg } from "../telegram";
import type { UserAnswers } from "../types";

function readStringAnswer(answers: Partial<UserAnswers>, key: string): string {
  const raw = answers[key as keyof UserAnswers];
  if (Array.isArray(raw)) return "";
  return String(raw ?? "");
}

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
    onboardingStep,
    setOnboardingStep,
  } = useAppStore();

  const step = onboardingStep;
  const [value, setValue] = useState(() =>
    readStringAnswer(answers, ONBOARDING_STEPS[step]?.id ?? "name"),
  );
  const [contactPhone, setContactPhone] = useState(() => readStringAnswer(answers, "phone"));
  const [contactEmail, setContactEmail] = useState(() => readStringAnswer(answers, "email"));
  const [salaryCustomDigits, setSalaryCustomDigits] = useState("");
  const [otherProfession, setOtherProfession] = useState(() =>
    professionOtherSelected(String(answers.target_position ?? "")),
  );
  const [submitting, setSubmitting] = useState(false);

  const isEdit = onboardingMode === "edit";
  const current = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;
  const isContactsStep = current.type === "contacts_dual";
  const isSalaryStep = current.type === "options_with_input";
  const salaryCustomMode = isSalaryStep && value === SALARY_CUSTOM_OPTION;

  const showTextInput =
    current.type === "text" ||
    current.type === "profession" ||
    (current.type === "options" && !OPTIONS_ONLY.has(current.id));

  const persistCurrentStep = useCallback(() => {
    const id = current.id;
    if (current.type === "contacts_dual") {
      setAnswer("phone", contactPhone.trim());
      setAnswer("email", contactEmail.trim());
      return;
    }
    if (current.type === "options_with_input" && id === "salary") {
      if (!value) {
        setAnswer("salary", "");
      } else if (value === SALARY_CUSTOM_OPTION) {
        setAnswer("salary", normalizeSalaryDigits(salaryCustomDigits));
      } else {
        setAnswer("salary", salaryFromOption(value));
      }
      return;
    }
    if (id !== "contacts") {
      setAnswer(id as keyof UserAnswers, value);
    }
  }, [
    contactEmail,
    contactPhone,
    current.id,
    current.type,
    salaryCustomDigits,
    setAnswer,
    value,
  ]);

  const canContinue = useMemo(() => {
    if (current.optional) return true;
    if (current.type === "contacts_dual") return true;
    if (current.type === "options_with_input") return true;
    return value.trim().length > 0;
  }, [current.optional, current.type, value]);

  const goToStep = useCallback(
    (nextStep: number) => {
      setOnboardingStep(nextStep);
      const next = ONBOARDING_STEPS[nextStep];
      if (next.type === "contacts_dual") {
        setContactPhone(readStringAnswer(answers, "phone"));
        setContactEmail(readStringAnswer(answers, "email"));
        setValue("");
      } else if (next.type === "options_with_input" && next.id === "salary") {
        const saved = readStringAnswer(answers, "salary");
        const preset = next.options?.find((o) => salaryFromOption(o) === saved);
        if (preset) {
          setValue(preset);
          setSalaryCustomDigits("");
        } else if (saved) {
          setValue(SALARY_CUSTOM_OPTION);
          setSalaryCustomDigits(saved);
        } else {
          setValue("");
          setSalaryCustomDigits("");
        }
      } else {
        const saved = readStringAnswer(answers, next.id);
        setValue(saved);
        if (next.type === "profession") {
          setOtherProfession(professionOtherSelected(saved));
        } else {
          setOtherProfession(false);
        }
      }
    },
    [answers, setOnboardingStep],
  );

  const handleBack = useCallback(() => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    if (step > 0) {
      persistCurrentStep();
      goToStep(step - 1);
      return;
    }
    if (isEdit) {
      cancelEditResume();
    } else {
      setPage("home");
    }
  }, [step, persistCurrentStep, goToStep, isEdit, cancelEditResume, setPage]);

  useTelegramBackButton(handleBack);

  const next = async () => {
    if (submitting) return;
    if (!canContinue && !current.optional) return;
    getTg()?.HapticFeedback?.impactOccurred("light");
    persistCurrentStep();

    if (current.id === "target_position") {
      setOnboardingStep(step + 1);
      setPage("skill_pick");
      return;
    }

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

  const skipOptional = () => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    if (isContactsStep) {
      setAnswer("phone", "");
      setAnswer("email", "");
      setContactPhone("");
      setContactEmail("");
    } else if (isSalaryStep) {
      setAnswer("salary", "");
      setValue("");
      setSalaryCustomDigits("");
    } else if (current.id === "languages") {
      setAnswer("languages", "");
      setValue("");
    } else if (current.id === "certificates") {
      setAnswer("certificates", "");
      setValue("");
    }
    goToStep(step + 1);
  };

  const showSkip =
    Boolean(current.skipText) &&
    (isContactsStep || isSalaryStep || current.id === "languages" || current.id === "certificates" || current.optional);

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

            {current.type === "contacts_dual" && (
              <div className="flex flex-col gap-3">
                <TextInput
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+7 (999) 000-00-00"
                  inputMode="tel"
                  autoComplete="tel"
                />
                <TextInput
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="ivan@mail.ru"
                  inputMode="email"
                  autoComplete="email"
                />
              </div>
            )}

            {(current.type === "options" || current.type === "options_with_input") && (
              <div className="flex flex-wrap gap-2.5" role="group" aria-label={current.question}>
                {current.options?.map((option) => (
                  <OptionButton
                    key={option}
                    label={option}
                    selected={value === option}
                    onSelect={() => {
                      setValue(option);
                      if (option !== SALARY_CUSTOM_OPTION) {
                        setSalaryCustomDigits("");
                      }
                      getTg()?.HapticFeedback?.selectionChanged();
                    }}
                  />
                ))}
              </div>
            )}

            {salaryCustomMode && (
              <TextInput
                value={salaryCustomDigits}
                onChange={(e) => setSalaryCustomDigits(normalizeSalaryDigits(e.target.value))}
                placeholder={current.placeholder}
                inputMode="numeric"
              />
            )}

            {showTextInput && current.type !== "profession" && (
              <TextInput
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={current.placeholder}
                inputMode={current.id === "name" ? "text" : "text"}
                autoComplete={current.id === "name" ? "name" : "off"}
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
          {showSkip && current.skipText && (
            <Button variant="ghost" onClick={skipOptional} className="!min-h-[44px] !py-2">
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
