import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { OptionButton } from "../components/OptionButton";
import { ProfessionChip } from "../components/ProfessionChip";
import { ProgressBar } from "../components/ProgressBar";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { Screen } from "../components/ui/Screen";
import { CompanyAutocomplete } from "../components/ui/CompanyAutocomplete";
import { TextInput } from "../components/ui/TextField";
import { VoiceTextArea } from "../components/ui/VoiceTextArea";
import { WorkHistoryStep } from "../components/ui/WorkHistoryStep";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import {
  OPTIONS_ONLY,
  PROFESSION_PRESETS,
  SALARY_CUSTOM_OPTION,
  buildLastJobFromWorkHistory,
  getVisibleSteps,
  isProfessionExtraStep,
  normalizeSalaryDigits,
  professionOtherSelected,
  salaryFromOption,
} from "../lib/onboardingSteps";
import { PhotoSetupStep } from "../components/onboarding/PhotoSetupStep";
import { photoModeNeedsUpload } from "../lib/photoModes";
import { capitalizePersonName, isPersonNameField } from "../lib/formatPersonName";
import { useAppStore } from "../store";
import { getTg } from "../telegram";
import type { UserAnswers, WorkEntry } from "../types";

function readStringAnswer(answers: Partial<UserAnswers>, key: string): string {
  const raw = answers[key as keyof UserAnswers];
  if (Array.isArray(raw)) return "";
  return String(raw ?? "");
}

function readMultiAnswer(answers: Partial<UserAnswers>, key: string): string[] {
  const raw = answers[key as keyof UserAnswers];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

function readProfessionExtra(
  answers: Partial<UserAnswers>,
  stepId: string,
): string | string[] {
  const key = stepId.replace(/^prof_/, "");
  const bag = answers.profession_extra ?? {};
  const raw = bag[key];
  if (Array.isArray(raw)) return raw;
  return String(raw ?? "");
}

function defaultWorkEntry(position = ""): WorkEntry {
  return { company: "", position, period: "", duties: "" };
}

export function OnboardingPage() {
  const {
    answers,
    setAnswer,
    setPage,
    onboardingMode,
    cancelEditResume,
    onboardingStep,
    setOnboardingStep,
    photoMode,
    photoJpegBase64,
  } = useAppStore();

  const isEdit = onboardingMode === "edit";

  const visibleSteps = useMemo(() => {
    const steps = getVisibleSteps(answers);
    if (isEdit) return steps.filter((s) => s.id !== "photo_setup");
    return steps;
  }, [answers, isEdit]);
  const step = Math.min(onboardingStep, Math.max(visibleSteps.length - 1, 0));
  const [value, setValue] = useState(() =>
    readStringAnswer(answers, visibleSteps[step]?.id ?? "name"),
  );
  const [workHistory, setWorkHistory] = useState<WorkEntry[]>(
    () => answers.work_history?.length ? answers.work_history : [defaultWorkEntry(String(answers.target_position ?? ""))],
  );
  const [contactPhone, setContactPhone] = useState(() => readStringAnswer(answers, "phone"));
  const [contactEmail, setContactEmail] = useState(() => readStringAnswer(answers, "email"));
  const [salaryCustomDigits, setSalaryCustomDigits] = useState("");
  const [otherProfession, setOtherProfession] = useState(() =>
    professionOtherSelected(String(answers.target_position ?? "")),
  );
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [multiValues, setMultiValues] = useState<string[]>([]);

  const current =
    visibleSteps[step] ??
    visibleSteps[0] ?? {
      id: "name",
      type: "text" as const,
      title: "",
      required: true,
    };
  const isLast = step === visibleSteps.length - 1;
  const isContactsStep = current.type === "contacts_dual";
  const isSalaryStep = current.type === "options_with_input";
  const isWorkHistoryStep = current.type === "work_history";
  const isMultiSelectStep = current.type === "multi_select";
  const salaryCustomMode = isSalaryStep && value === SALARY_CUSTOM_OPTION;
  const stepsFromEnd = visibleSteps.length - step;
  const progressHint =
    stepsFromEnd <= 3 && stepsFromEnd > 0 ? "Почти готово..." : undefined;

  useEffect(() => {
    if (!isEdit) {
      trackEvent("onboarding_started");
    }
  }, [isEdit]);

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
    if (current.type === "work_history") {
      setAnswer("work_history", workHistory);
      setAnswer("last_job", buildLastJobFromWorkHistory(workHistory));
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
    if (current.type === "multi_select" && id === "work_schedule") {
      setAnswer("work_schedule", multiValues);
      return;
    }
    if (isProfessionExtraStep(current)) {
      const key = String(current.id).replace(/^prof_/, "");
      const existing = { ...(answers.profession_extra ?? {}) };
      if (current.type === "multi_select") {
        existing[key] = multiValues;
      } else {
        existing[key] = value;
      }
      setAnswer("profession_extra", existing);
      return;
    }
    if (id !== "contacts") {
      const stored = isPersonNameField(id) ? capitalizePersonName(value) : value;
      setAnswer(id as keyof UserAnswers, stored);
    }
  }, [
    contactEmail,
    contactPhone,
    current.id,
    current.type,
    salaryCustomDigits,
    answers.profession_extra,
    multiValues,
    workHistory,
    setAnswer,
    value,
  ]);

  const canContinue = useMemo(() => {
    if (current.type === "photo_setup") {
      if (!photoModeNeedsUpload(photoMode)) return true;
      return Boolean(photoJpegBase64);
    }
    if (current.required === false || current.optional) return true;
    if (current.type === "contacts_dual") return true;
    if (current.type === "options_with_input") return true;
    if (current.type === "work_history") return true;
    if (current.type === "multi_select") return multiValues.length > 0;
    if (current.type === "options") return value.trim().length > 0;
    return value.trim().length > 0;
  }, [current.optional, current.required, current.type, multiValues.length, photoJpegBase64, photoMode, value]);

  const goToStep = useCallback(
    (nextStep: number) => {
      setFieldError(null);
      setOnboardingStep(nextStep);
      const steps = getVisibleSteps(useAppStore.getState().answers);
      const next = steps[nextStep];
      if (!next) return;
      if (next.type === "contacts_dual") {
        setContactPhone(readStringAnswer(answers, "phone"));
        setContactEmail(readStringAnswer(answers, "email"));
        setValue("");
      } else if (next.type === "work_history") {
        const saved = useAppStore.getState().answers.work_history;
        setWorkHistory(
          saved?.length
            ? saved
            : [defaultWorkEntry(String(useAppStore.getState().answers.target_position ?? ""))],
        );
        setValue("");
      } else if (next.type === "multi_select") {
        if (next.id === "work_schedule") {
          setMultiValues(readMultiAnswer(useAppStore.getState().answers, "work_schedule"));
        } else if (isProfessionExtraStep(next)) {
          const saved = readProfessionExtra(useAppStore.getState().answers, String(next.id));
          setMultiValues(Array.isArray(saved) ? saved : saved ? [saved] : []);
        } else {
          setMultiValues([]);
        }
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
      } else if (isProfessionExtraStep(next) && next.type === "options") {
        const saved = readProfessionExtra(useAppStore.getState().answers, String(next.id));
        setValue(Array.isArray(saved) ? saved[0] ?? "" : String(saved));
        setMultiValues([]);
        setOtherProfession(false);
      } else {
        let saved = readStringAnswer(answers, next.id);
        if (isPersonNameField(next.id)) {
          saved = capitalizePersonName(saved);
        }
        setValue(saved);
        if (next.type === "profession") {
          setOtherProfession(professionOtherSelected(saved));
        } else {
          setOtherProfession(false);
        }
        if (next.type !== "multi_select") {
          setMultiValues([]);
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
    if (current.type === "photo_setup" && !canContinue) {
      setFieldError("Добавьте фото или выберите «Без фото»");
      return;
    }
    if (!canContinue && !current.optional) return;

    const error = current.validate?.(value);
    if (error) {
      setFieldError(error);
      return;
    }
    setFieldError(null);

    getTg()?.HapticFeedback?.impactOccurred("light");
    persistCurrentStep();
    trackEvent("step_completed", { step: current.id });

    if (current.id === "target_position" || isProfessionExtraStep(current)) {
      const steps = getVisibleSteps(useAppStore.getState().answers);
      const nextIdx = step + 1;
      if (nextIdx < steps.length && isProfessionExtraStep(steps[nextIdx])) {
        goToStep(nextIdx);
        return;
      }
      const salaryIdx = steps.findIndex((s) => s.id === "salary");
      setOnboardingStep(salaryIdx >= 0 ? salaryIdx : nextIdx);
      setPage("skill_pick");
      return;
    }

    if (!isLast) {
      goToStep(step + 1);
      return;
    }

    setSubmitting(true);
    setPage("template_pick");
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
    } else if (current.id === "education_place") {
      setAnswer("education_place", "");
      setValue("");
    } else if (current.id === "work_schedule") {
      setAnswer("work_schedule", []);
      setMultiValues([]);
    } else if (current.id === "relocation") {
      setAnswer("relocation", "");
      setValue("");
    } else if (isProfessionExtraStep(current)) {
      const key = String(current.id).replace(/^prof_/, "");
      const existing = { ...(answers.profession_extra ?? {}) };
      delete existing[key];
      setAnswer("profession_extra", existing);
      if (current.type === "multi_select") {
        setMultiValues([]);
      } else {
        setValue("");
      }
    } else if (isWorkHistoryStep) {
      setAnswer("work_history", []);
      setAnswer("last_job", "");
      setAnswer("experience_level", "Нет опыта");
      setWorkHistory([defaultWorkEntry(String(answers.target_position ?? ""))]);
    }
    goToStep(step + 1);
  };

  const showSkip =
    Boolean(current.skipText) &&
    !isWorkHistoryStep &&
    (isContactsStep ||
      isSalaryStep ||
      current.id === "languages" ||
      current.id === "certificates" ||
      current.id === "education_place" ||
      current.id === "work_schedule" ||
      current.id === "relocation" ||
      isProfessionExtraStep(current) ||
      current.optional);

  if (!visibleSteps.length) {
    return (
      <Screen className="px-4">
        <p className="mt-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Не удалось загрузить шаги анкеты.
        </p>
        <Button variant="brand" className="mt-4" onClick={() => setPage("home")}>
          На главную
        </Button>
      </Screen>
    );
  }

  return (
    <Screen withBottomBar className="px-4">
      <AppHeader onBack={handleBack} showBack />
      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-y-contain py-4">
        {isEdit && (
          <div
            className="rounded-xl px-4 py-3 text-center text-sm"
            style={{ background: "var(--brand-muted)", color: "var(--brand)" }}
          >
            Редактирование — измените нужные ответы и нажмите «Пересобрать резюме»
          </div>
        )}

        <ProgressBar
          current={step + 1}
          total={visibleSteps.length}
          hint={progressHint}
        />

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

            {current.type === "photo_setup" ? <PhotoSetupStep /> : null}

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

            {isMultiSelectStep && (
              <div className="flex flex-wrap gap-2.5" role="group" aria-label={current.question}>
                {current.options?.map((option) => (
                  <OptionButton
                    key={option}
                    label={option}
                    selected={multiValues.includes(option)}
                    onSelect={() => {
                      setMultiValues((prev) =>
                        prev.includes(option)
                          ? prev.filter((v) => v !== option)
                          : [...prev, option],
                      );
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

            {showTextInput && current.type !== "profession" && current.id === "education_place" && (
              <CompanyAutocomplete
                kind="institution"
                value={value}
                onChange={setValue}
                placeholder={current.placeholder}
              />
            )}

            {showTextInput && current.type !== "profession" && current.id !== "education_place" && (
              <>
                <TextInput
                  value={value}
                  onChange={(e) => {
                    setFieldError(null);
                    setValue(e.target.value);
                  }}
                  onBlur={() => {
                    if (!isPersonNameField(current.id)) return;
                    const formatted = capitalizePersonName(value);
                    if (formatted !== value) setValue(formatted);
                  }}
                  placeholder={current.placeholder}
                  inputMode="text"
                  autoComplete={
                    current.id === "name" ? "name" : current.id === "patronymic" ? "additional-name" : "off"
                  }
                />
                {fieldError && (
                  <p className="text-sm" style={{ color: "#dc2626" }}>
                    {fieldError}
                  </p>
                )}
              </>
            )}

            {current.type === "work_history" && (
              <WorkHistoryStep
                entries={workHistory}
                targetPosition={String(answers.target_position ?? "")}
                onChange={setWorkHistory}
                onNoExperience={skipOptional}
              />
            )}

            {current.type === "textarea" && (
              <>
                <VoiceTextArea
                  fieldId={`onboarding-${current.id}`}
                  fieldType={
                    current.id === "about"
                      ? "about"
                      : current.id === "certificates"
                        ? "certificates"
                        : "experience"
                  }
                  value={value}
                  onChange={(v) => {
                    setFieldError(null);
                    setValue(v);
                  }}
                  placeholder={current.placeholder}
                  rows={"rows" in current && current.rows ? current.rows : 5}
                />
                {fieldError && (
                  <p className="text-sm" style={{ color: "#dc2626" }}>
                    {fieldError}
                  </p>
                )}
              </>
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
