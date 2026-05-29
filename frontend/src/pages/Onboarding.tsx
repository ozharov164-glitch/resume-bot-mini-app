import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { generateResume } from "../api";
import { OptionButton } from "../components/OptionButton";
import { ProgressBar } from "../components/ProgressBar";
import { useFirstName } from "../hooks/useFirstName";
import { useAppStore } from "../store";
import { tg } from "../telegram";
import type { UserAnswers } from "../types";

type StepType = "text" | "textarea" | "options";

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
    question: "На какую должность хочешь откликаться?",
    type: "text",
    placeholder: "Продавец-консультант",
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

export function OnboardingPage() {
  const { authToken, answers, setAnswer, setResumeResult, setPage } = useAppStore();
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const firstName = useFirstName();
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isPhoneStep = current.id === "phone";

  const canContinue = useMemo(() => {
    if (current.optional) return true;
    return value.trim().length > 0;
  }, [current.optional, value]);

  const goToStep = (nextStep: number) => {
    setStep(nextStep);
    const next = STEPS[nextStep];
    setValue(String(answers[next.id as keyof UserAnswers] ?? ""));
  };

  const next = async () => {
    if (!canContinue && !current.optional) return;
    tg?.HapticFeedback?.impactOccurred("light");
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
      setPage("preview");
    } catch (error) {
      setPage("onboarding");
      alert("Не удалось составить резюме. Проверь соединение и попробуй ещё раз.");
      console.error(error);
    }
  };

  const skipPhone = () => {
    tg?.HapticFeedback?.impactOccurred("light");
    setAnswer("phone", "");
    goToStep(step + 1);
  };

  return (
    <div
      className="min-h-screen px-4 py-6 flex flex-col gap-6"
      style={{ background: "var(--tg-bg)", color: "var(--tg-text)" }}
    >
      <ProgressBar current={step + 1} total={STEPS.length} />

      {step === 0 && (
        <p className="text-base font-medium opacity-80">
          {firstName ? `Привет, ${firstName}! 👋` : "Привет! 👋"}
        </p>
      )}

      <h1 className="text-xl font-semibold leading-tight">
        Создаём резюме, которое хочется отправить работодателю
      </h1>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="flex flex-col gap-4 flex-1"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="text-base font-medium">{current.question}</div>
          {current.hint && <p className="text-sm opacity-70 -mt-2">{current.hint}</p>}

          {current.type === "options" && (
            <div className="flex flex-wrap gap-2">
              {current.options?.map((option) => (
                <OptionButton
                  key={option}
                  label={option}
                  selected={value === option}
                  onSelect={() => setValue(option)}
                />
              ))}
            </div>
          )}

          {(current.type === "text" || current.type === "options") && (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={current.placeholder}
              className="w-full rounded-2xl px-4 py-3 outline-none border"
              style={{
                background: "var(--tg-secondary-bg)",
                borderColor: "transparent",
                color: "var(--tg-text)",
              }}
            />
          )}

          {current.type === "textarea" && (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={current.placeholder}
              rows={5}
              className="w-full rounded-2xl px-4 py-3 outline-none border resize-none"
              style={{
                background: "var(--tg-secondary-bg)",
                borderColor: "transparent",
                color: "var(--tg-text)",
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {isPhoneStep && current.skipText && (
        <button
          type="button"
          onClick={skipPhone}
          className="w-full py-2 text-sm font-medium opacity-70"
          style={{ color: "var(--tg-text)" }}
        >
          {current.skipText}
        </button>
      )}

      <button
        className="mt-auto w-full rounded-2xl py-4 font-semibold disabled:opacity-50"
        onClick={next}
        disabled={!canContinue}
        style={{ background: "var(--tg-button)", color: "var(--tg-button-text)" }}
      >
        {isLast ? "Сформировать резюме" : "Продолжить"}
      </button>
    </div>
  );
}
