import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { generateResume } from "../api";
import { OptionButton } from "../components/OptionButton";
import { ProgressBar } from "../components/ProgressBar";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { Screen } from "../components/ui/Screen";
import { TextArea, TextInput } from "../components/ui/TextField";
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

const OPTIONS_ONLY = new Set(["experience_level", "education"]);

export function OnboardingPage() {
  const { authToken, answers, setAnswer, setResumeResult, setPage, setFounder, setPaid } = useAppStore();
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const firstName = useFirstName();
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isPhoneStep = current.id === "phone";
  const showTextInput = current.type === "text" || (current.type === "options" && !OPTIONS_ONLY.has(current.id));

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
    tg?.HapticFeedback?.impactOccurred("light");
    setAnswer("phone", "");
    goToStep(step + 1);
  };

  const greeting = firstName ? `Привет, ${firstName}! 👋` : "Привет! 👋";

  return (
    <Screen className="gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            Шаг {step + 1} из {STEPS.length}
          </p>
          {step === 0 && <p className="text-sm font-semibold">{greeting}</p>}
        </div>
        <ProgressBar current={step + 1} total={STEPS.length} />
      </div>

      {step === 0 ? (
        <PageHeader
          title="Создаём резюме, которое хочется отправить"
          subtitle="Ответь на несколько коротких вопросов — остальное сделаем мы"
        />
      ) : (
        <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
          Почти готово — осталось совсем немного
        </p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="flex flex-col gap-4 flex-1"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <h2 className="text-xl font-bold leading-snug">{current.question}</h2>

          {current.hint && <p className="hint-pill -mt-1">{current.hint}</p>}

          {current.type === "options" && (
            <div className="flex flex-wrap gap-2.5" role="group" aria-label={current.question}>
              {current.options?.map((option) => (
                <OptionButton
                  key={option}
                  label={option}
                  selected={value === option}
                  onSelect={() => {
                    setValue(option);
                    tg?.HapticFeedback?.selectionChanged();
                  }}
                />
              ))}
            </div>
          )}

          {showTextInput && (
            <TextInput
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={current.placeholder}
              inputMode={current.id === "phone" ? "tel" : "text"}
              autoComplete={current.id === "phone" ? "tel" : current.id === "name" ? "name" : "off"}
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

      <div className="mt-auto flex flex-col gap-2.5">
        {isPhoneStep && current.skipText && (
          <Button variant="ghost" onClick={skipPhone} className="!min-h-[44px] !py-2.5 !font-semibold">
            {current.skipText}
          </Button>
        )}

        <Button variant="primary" onClick={next} disabled={!canContinue}>
          {isLast ? "Сформировать резюме" : "Продолжить"}
        </Button>
      </div>
    </Screen>
  );
}
