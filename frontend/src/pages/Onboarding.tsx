import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { ensureAuthToken, generateResume, HttpTimeoutError } from "../api";
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
  deriveExperienceLevel,
  getVisibleSteps,
  normalizeSalaryDigits,
  professionOtherSelected,
  salaryFromOption,
} from "../lib/onboardingSteps";
import { useAppStore } from "../store";
import { getTg } from "../telegram";
import type { UserAnswers, WorkEntry } from "../types";

function readStringAnswer(answers: Partial<UserAnswers>, key: string): string {
  const raw = answers[key as keyof UserAnswers];
  if (Array.isArray(raw)) return "";
  return String(raw ?? "");
}

function defaultWorkEntry(position = ""): WorkEntry {
  return { company: "", position, period: "", duties: "" };
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

  const visibleSteps = useMemo(() => getVisibleSteps(answers), [answers]);
  const step = Math.min(onboardingStep, Math.max(visibleSteps.length - 1, 0));
  const [value, setValue] = useState(() =>
    readStringAnswer(answers, visibleSteps[step]?.id ?? "name"),
  );
  const [workHistory, setWorkHistory] = useState<WorkEntry[]>(
    () => answers.work_history?.length ? answers.work_history : [defaultWorkEntry(String(answers.target_position ?? ""))],
  );
  const [contactPhone, setContactPhone] = useState(() => readStringAnswer(answers, "phone"));
  const [contactEmail, setContactEmail] = useState(() => readStringAnswer(answers, "email"));
  const [patronymic, setPatronymic] = useState(() => readStringAnswer(answers, "patronymic"));
  const [salaryCustomDigits, setSalaryCustomDigits] = useState("");
  const [otherProfession, setOtherProfession] = useState(() =>
    professionOtherSelected(String(answers.target_position ?? "")),
  );
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const isEdit = onboardingMode === "edit";
  const current = visibleSteps[step];
  const isLast = step === visibleSteps.length - 1;
  const isContactsStep = current.type === "contacts_dual";
  const isNameStep = current.type === "name_with_patronymic";
  const isSalaryStep = current.type === "options_with_input";
  const isWorkHistoryStep = current.type === "work_history";
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
    if (current.type === "name_with_patronymic") {
      setAnswer("name", value.trim());
      setAnswer("patronymic", patronymic.trim());
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
    if (id !== "contacts") {
      setAnswer(id as keyof UserAnswers, value);
    }
  }, [
    contactEmail,
    contactPhone,
    patronymic,
    current.id,
    current.type,
    salaryCustomDigits,
    workHistory,
    setAnswer,
    value,
  ]);

  const canContinue = useMemo(() => {
    if (current.required === false || current.optional) return true;
    if (current.type === "contacts_dual") return true;
    if (current.type === "name_with_patronymic") return value.trim().length > 0;
    if (current.type === "options_with_input") return true;
    if (current.type === "work_history") return true;
    return value.trim().length > 0;
  }, [current.optional, current.required, current.type, value]);

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
      } else if (next.type === "name_with_patronymic") {
        setValue(readStringAnswer(answers, "name"));
        setPatronymic(readStringAnswer(answers, "patronymic"));
      } else if (next.type === "work_history") {
        const saved = useAppStore.getState().answers.work_history;
        setWorkHistory(
          saved?.length
            ? saved
            : [defaultWorkEntry(String(useAppStore.getState().answers.target_position ?? ""))],
        );
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
      setPage("template_pick");
    }
  }, [step, persistCurrentStep, goToStep, isEdit, cancelEditResume, setPage]);

  useTelegramBackButton(handleBack);

  const next = async () => {
    if (submitting) return;
    if (!canContinue && !current.optional) return;

    const error = current.validate?.(value);
    if (error) {
      setFieldError(error);
      return;
    }
    if (isNameStep && current.validatePatronymic) {
      const patronymicError = current.validatePatronymic(patronymic);
      if (patronymicError) {
        setFieldError(patronymicError);
        return;
      }
    }
    setFieldError(null);

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
      const state = useAppStore.getState();
      const payload = { ...state.answers };
      const last_job = buildLastJobFromWorkHistory(state.answers.work_history);
      payload.experience_level = deriveExperienceLevel(state.answers.work_history);
      setAnswer("experience_level", payload.experience_level);
      if (last_job) {
        payload.last_job = last_job;
      }
      setAnswer("last_job", last_job);
      const response = await generateResume(token, payload, state.selectedTemplate);
      setResumeResult(response.resume_id, response.resume, response.paid);
      if (response.paid) {
        setFounder(true);
        setPaid(true);
      }
      if (state.onboardingMode === "create") {
        useAppStore.setState({ previewReturnPage: "home" });
      }
      setPage("preview");
    } catch (error) {
      setPage("onboarding");
      const message = error instanceof Error ? error.message : "";
      if (message === "OPEN_VIA_BOT") {
        alert("Открой приложение через бота @resumeez_bot — без этого авторизация не работает.");
      } else if (error instanceof HttpTimeoutError) {
        alert("Генерация заняла слишком много времени. Проверь интернет и попробуй ещё раз.");
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
    } else if (current.id === "education_place") {
      setAnswer("education_place", "");
      setValue("");
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
      current.optional);

  return (
    <Screen withBottomBar className="px-4">
      <AppHeader onBack={handleBack} showBack />
      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-y-contain py-4">
        {isEdit && (
          <div
            className="rounded-xl px-4 py-3 text-center text-sm"
            style={{ background: "var(--brand-muted)", color: "var(--brand)" }}
          >
            Редактирование — измени нужные ответы и нажми «Пересобрать резюме»
          </div>
        )}

        <ProgressBar current={step + 1} total={visibleSteps.length} />

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

            {isNameStep && (
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                  Имя и фамилия
                </label>
                <TextInput
                  value={value}
                  onChange={(e) => {
                    setFieldError(null);
                    setValue(e.target.value);
                  }}
                  placeholder={current.placeholder}
                  inputMode="text"
                  autoComplete="name"
                />
                <label className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                  Отчество
                </label>
                <TextInput
                  value={patronymic}
                  onChange={(e) => {
                    setFieldError(null);
                    setPatronymic(e.target.value);
                  }}
                  placeholder={current.patronymicPlaceholder ?? "Сергеевич"}
                  inputMode="text"
                  autoComplete="additional-name"
                />
                {fieldError && (
                  <p className="text-sm" style={{ color: "#dc2626" }}>
                    {fieldError}
                  </p>
                )}
              </div>
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

            {showTextInput && current.type !== "profession" && current.id === "education_place" && (
              <CompanyAutocomplete
                kind="institution"
                value={value}
                onChange={setValue}
                placeholder={current.placeholder}
              />
            )}

            {showTextInput && current.type !== "profession" && current.id !== "education_place" && !isNameStep && (
              <>
                <TextInput
                  value={value}
                  onChange={(e) => {
                    setFieldError(null);
                    setValue(e.target.value);
                  }}
                  placeholder={current.placeholder}
                  inputMode={current.id === "name" ? "text" : "text"}
                  autoComplete={current.id === "name" ? "name" : "off"}
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
