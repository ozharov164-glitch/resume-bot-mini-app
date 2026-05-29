import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { generateResume } from "../api";
import { OptionButton } from "../components/OptionButton";
import { ProfessionChip } from "../components/ProfessionChip";
import { ProgressBar } from "../components/ProgressBar";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { Screen } from "../components/ui/Screen";
import { TextArea, TextInput } from "../components/ui/TextField";
import { useAppStore } from "../store";
import { getTg } from "../telegram";
import type { UserAnswers } from "../types";

type StepType = "text" | "textarea" | "options" | "profession";

interface Step {
  id: keyof UserAnswers | string;
  question: string;
  type: StepType;
  placeholder?: string;
  options?: readonly string[];
  hint?: string;
  skipText?: string;
  optional?: boolean;
}

const PROFESSION_PRESETS = [
  { label: "Водитель", icon: "local_shipping", value: "Водитель" },
  { label: "Охранник", icon: "security", value: "Охранник" },
  { label: "Курьер", icon: "directions_run", value: "Курьер" },
  { label: "Маляр", icon: "format_paint", value: "Маляр" },
  { label: "Другое", icon: "more_horiz", value: "" },
] as const;

const STEPS: Step[] = [
  { id: "name", question: "Как тебя зовут?", type: "text", placeholder: "Иван Петров" },
  {
    id: "phone",
    question: "Твой номер телефона для резюме",
    hint: "Необязательно — можешь вписать вручную в готовый PDF",
    type: "text",
    placeholder: "+7 999 123-45-67",
    skipText: "Пропустить этот шаг",
    optional: true,
  },
  {
    id: "target_position",
    question: "На какую должность ты ищешь работу?",
    hint: "Выбери профессию из списка или напиши свой вариант.",
    type: "profession",
    placeholder: "Например: водитель-экспедитор",
  },
  {
    id: "experience_level",
    question: "Твой уровень опыта",
    type: "options",
    options: ["Нет опыта", "До года", "1-3 года", "3-5 лет", "5+ лет"],
  },
  {
    id: "last_job",
    question: "Где работал и что делал?",
    type: "textarea",
    placeholder: "Кратко опиши обязанности и достижения.",
  },
  {
    id: "education",
    question: "Образование",
    type: "options",
    options: ["Среднее", "Колледж", "Незаконченное высшее", "Высшее", "Курсы"],
  },
  { id: "city", question: "Город поиска работы", type: "text", placeholder: "Казань" },
  {
    id: "about",
    question: "Коротко о себе",
    type: "textarea",
    placeholder: "Например: ответственный, доброжелательный, быстро обучаюсь.",
  },
];

const OPTIONS_ONLY = new Set(["experience_level", "education"]);

export function OnboardingPage() {
  const { authToken, answers, setAnswer, setResumeResult, setPage, setFounder, setPaid } = useAppStore();
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const [otherProfession, setOtherProfession] = useState(false);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isPhoneStep = current.id === "phone";
  const showTextInput =
    current.type === "text" || current.type === "profession" || (current.type === "options" && !OPTIONS_ONLY.has(current.id));

  const canContinue = useMemo(() => {
    if (current.optional) return true;
    return value.trim().length > 0;
  }, [current.optional, value]);

  const goToStep = (nextStep: number) => {
    setStep(nextStep);
    const next = STEPS[nextStep];
    const saved = String(answers[next.id as keyof UserAnswers] ?? "");
    setValue(saved);
    if (next.type === "profession") {
      const presetValues = PROFESSION_PRESETS.map((p) => p.value).filter(Boolean);
      setOtherProfession(Boolean(saved) && !presetValues.includes(saved));
    } else {
      setOtherProfession(false);
    }
  };

  const next = async () => {
    if (!canContinue && !current.optional) return;
    getTg()?.HapticFeedback?.impactOccurred("light");
    setAnswer(current.id as keyof UserAnswers, value);

    if (!isLast) {
      goToStep(step + 1);
      return;
    }

    if (!authToken) return;
    const payload = { ...answers, [current.id]: value };
    setPage("loading");
    try {
      const response = await generateResume(authToken, payload);
      setResumeResult(response.resume_id, response.resume);
      if (response.paid) {
        setFounder(true);
        setPaid(true);
      }
      setPage("preview");
    } catch (error) {
      setPage("onboarding");
      alert("Не удалось составить резюме. Проверь соединение и попробуй ещё раз.");
      console.error(error);
    }
  };

  const skipPhone = () => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    setAnswer("phone", "");
    goToStep(step + 1);
  };

  return (
    <Screen withBottomBar className="px-4">
      <AppHeader onBack={step > 0 ? () => goToStep(step - 1) : undefined} showBack={step > 0} />
      <main className="flex flex-1 flex-col gap-6 py-4">
        <ProgressBar current={step + 1} total={STEPS.length} />

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
          <Button variant="brand" onClick={next} disabled={!canContinue}>
            {isLast ? "Сформировать резюме" : "Далее"}
          </Button>
        </div>
      </FixedBottomBar>
    </Screen>
  );
}
