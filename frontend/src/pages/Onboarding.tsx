import { useMemo, useState } from "react";

import { generateResume } from "../api";
import { OptionButton } from "../components/OptionButton";
import { ProgressBar } from "../components/ProgressBar";
import { useAppStore } from "../store";
import { tg } from "../telegram";
import type { UserAnswers } from "../types";

const STEPS = [
  { id: "name", title: "Как вас зовут?", type: "text", placeholder: "Иван Петров" },
  { id: "phone", title: "Ваш номер телефона", type: "text", placeholder: "+7 999 123-45-67" },
  { id: "target_position", title: "На какую должность хотите откликаться?", type: "text", placeholder: "Продавец-консультант" },
  { id: "experience_level", title: "Ваш уровень опыта", type: "options", options: ["Нет опыта", "До года", "1-3 года", "3-5 лет", "5+ лет"] },
  { id: "last_job", title: "Где работали и что делали?", type: "textarea", placeholder: "Кратко опишите обязанности и достижения." },
  { id: "education", title: "Образование", type: "options", options: ["Среднее", "Колледж", "Незаконченное высшее", "Высшее", "Курсы"] },
  { id: "city", title: "Город поиска работы", type: "text", placeholder: "Казань" },
  { id: "about", title: "Коротко о себе", type: "textarea", placeholder: "Например: ответственный, доброжелательный, быстро обучаюсь." },
] as const;

export function OnboardingPage() {
  const { authToken, answers, setAnswer, setLoading, setResumeResult, setPage } = useAppStore();
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const canContinue = useMemo(() => value.trim().length > 0, [value]);

  const next = async () => {
    if (!canContinue) return;
    tg?.HapticFeedback?.impactOccurred("light");
    setAnswer(current.id as keyof UserAnswers, value);

    if (!isLast) {
      setStep(step + 1);
      setValue(String(answers[STEPS[step + 1].id as keyof UserAnswers] ?? ""));
      return;
    }

    if (!authToken) return;
    try {
      setLoading(true);
      const payload = { ...answers, [current.id]: value };
      const response = await generateResume(authToken, payload);
      setResumeResult(response.resume_id, response.resume);
      setPage("preview");
    } catch (error) {
      alert("Не удалось сгенерировать резюме. Проверьте соединение и повторите попытку.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 flex flex-col gap-6" style={{ background: "var(--tg-bg)", color: "var(--tg-text)" }}>
      <ProgressBar current={step + 1} total={STEPS.length} />
      <h1 className="text-xl font-semibold leading-tight">Создаем резюме, которое хочется отправить работодателю</h1>
      <div className="text-base font-medium">{current.title}</div>

      {current.type === "options" && (
        <div className="flex flex-wrap gap-2">
          {current.options?.map((option) => (
            <OptionButton key={option} label={option} selected={value === option} onSelect={() => setValue(option)} />
          ))}
        </div>
      )}

      {(current.type === "text" || current.type === "options") && (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={current.placeholder}
          className="w-full rounded-2xl px-4 py-3 outline-none border"
          style={{ background: "var(--tg-secondary-bg)", borderColor: "transparent", color: "var(--tg-text)" }}
        />
      )}

      {current.type === "textarea" && (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={current.placeholder}
          rows={5}
          className="w-full rounded-2xl px-4 py-3 outline-none border resize-none"
          style={{ background: "var(--tg-secondary-bg)", borderColor: "transparent", color: "var(--tg-text)" }}
        />
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
