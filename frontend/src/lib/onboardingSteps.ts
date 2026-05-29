import type { UserAnswers } from "../types";

export type StepType = "text" | "textarea" | "options" | "profession";

export interface OnboardingStep {
  id: keyof UserAnswers | string;
  question: string;
  type: StepType;
  placeholder?: string;
  options?: readonly string[];
  hint?: string;
  skipText?: string;
  optional?: boolean;
}

export const PROFESSION_PRESETS = [
  { label: "Водитель", icon: "local_shipping", value: "Водитель" },
  { label: "Охранник", icon: "security", value: "Охранник" },
  { label: "Курьер", icon: "directions_run", value: "Курьер" },
  { label: "Маляр", icon: "format_paint", value: "Маляр" },
  { label: "Другое", icon: "more_horiz", value: "" },
] as const;

export const ONBOARDING_STEPS: OnboardingStep[] = [
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

export const OPTIONS_ONLY = new Set(["experience_level", "education"]);

export function professionOtherSelected(value: string) {
  const presetValues = PROFESSION_PRESETS.map((p) => p.value).filter(Boolean);
  return Boolean(value) && !presetValues.includes(value);
}
