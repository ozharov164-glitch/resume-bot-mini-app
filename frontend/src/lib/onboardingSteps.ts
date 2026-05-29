import type { UserAnswers } from "../types";

export type StepType =
  | "text"
  | "textarea"
  | "options"
  | "profession"
  | "contacts_dual"
  | "options_with_input"
  | "multi_select";

export interface OnboardingStep {
  id: keyof UserAnswers | string;
  question: string;
  type: StepType;
  placeholder?: string;
  options?: readonly string[];
  hint?: string;
  skipText?: string;
  optional?: boolean;
  optionsByPosition?: Record<string, readonly string[]>;
  allowCustomInput?: boolean;
  customInputPlaceholder?: string;
}

export const PROFESSION_PRESETS = [
  { label: "Водитель", icon: "local_shipping", value: "Водитель" },
  { label: "Охранник", icon: "security", value: "Охранник" },
  { label: "Курьер", icon: "directions_run", value: "Курьер" },
  { label: "Маляр", icon: "format_paint", value: "Маляр" },
  { label: "Другое", icon: "more_horiz", value: "" },
] as const;

export const SALARY_CUSTOM_OPTION = "Укажу сам";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "name",
    question: "Твоё имя и фамилия",
    type: "text",
    placeholder: "Иван Петров",
    hint: "Введи полностью: Имя Фамилия (например: Дмитрий Петров)",
  },
  {
    id: "contacts",
    question: "Контакты для резюме",
    type: "contacts_dual",
    hint: "Можно добавить позже прямо в PDF",
    skipText: "Пропустить оба",
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
    id: "salary",
    question: "Желаемая зарплата?",
    type: "options_with_input",
    options: ["40 000 ₽", "50 000 ₽", "60 000 ₽", "80 000 ₽", "100 000 ₽+", SALARY_CUSTOM_OPTION],
    placeholder: "55000",
    hint: "Только цифры, руб/мес. Необязательно.",
    skipText: "Не указывать",
    optional: true,
  },
  {
    id: "last_job",
    question: "Где работал и что делал?",
    type: "textarea",
    placeholder: "Компания, период (2019–2024). Что делал и чего добился: цифры, объёмы, результаты.",
    hint: "Укажи компанию, сроки и 2–3 достижения с цифрами — это усилит резюме.",
  },
  {
    id: "education",
    question: "Образование",
    type: "options",
    options: ["Среднее", "Колледж", "Незаконченное высшее", "Высшее", "Курсы"],
  },
  {
    id: "certificates",
    question: "Сертификаты и лицензии",
    type: "textarea",
    placeholder: "Например: права кат. B, лицензия охранника, медкнижка, удостоверение сварщика",
    hint: "Необязательно. Укажи документы, которые повышают шансы на должность.",
    skipText: "Нет документов",
    optional: true,
  },
  {
    id: "languages",
    question: "Знаешь иностранные языки?",
    type: "options",
    options: [
      "Нет",
      "Английский (базовый)",
      "Английский (разговорный)",
      "Английский (свободный)",
      "Другой язык",
    ],
    skipText: "Только русский",
    optional: true,
  },
  { id: "city", question: "Город поиска работы", type: "text", placeholder: "Казань" },
  {
    id: "about",
    question: "Коротко о себе",
    type: "textarea",
    placeholder: "Например: ответственный, доброжелательный, быстро обучаюсь.",
  },
];

export const OPTIONS_ONLY = new Set(["experience_level", "education", "languages"]);

export function professionOtherSelected(value: string) {
  const presetValues = PROFESSION_PRESETS.map((p) => p.value).filter(Boolean);
  return Boolean(value) && !presetValues.includes(value);
}

export function normalizeSalaryDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function salaryFromOption(option: string): string {
  if (!option || option === SALARY_CUSTOM_OPTION) return "";
  return normalizeSalaryDigits(option);
}

/** Static fallback map for skill pick when API unavailable. */
export const SKILLS_FALLBACK_BY_POSITION: Record<string, readonly string[]> = {
  Водитель: [
    "Категория B", "Категория C", "Знание города", "Яндекс.Навигатор",
    "Путевые листы", "ТТН", "Опыт дальних рейсов", "Пунктуальность",
  ],
  Курьер: [
    "Яндекс.Доставка", "Wildberries", "СДЭК", "Знание города",
    "Пунктуальность", "Физ. выносливость", "Мобильные приложения",
  ],
  Охранник: [
    "Лицензия охранника", "CCTV", "Работа с рамкой", "Делопроизводство",
    "Физ. подготовка", "Работа в ночь",
  ],
  Продавец: [
    "1С Торговля", "Кассовый аппарат", "Выкладка товара",
    "Работа с покупателями", "Инвентаризация",
  ],
  Маляр: [
    "Покраска стен/потолков", "Шпаклёвка", "Работа с инструментом",
    "Поверхности: штукатурка", "Чтение чертежей",
  ],
  default: [
    "MS Office", "Работа в команде", "Обучаемость", "Ответственность",
    "Пунктуальность", "Коммуникабельность", "Работа с клиентами",
  ],
};

export function skillsOptionsForPosition(
  optionsByPosition: Record<string, readonly string[]> | undefined,
  position: string,
): readonly string[] {
  if (!optionsByPosition) return [];
  const key = Object.keys(optionsByPosition).find(
    (k) => k !== "default" && position.toLowerCase().includes(k.toLowerCase()),
  );
  return optionsByPosition[key ?? "default"] ?? optionsByPosition.default ?? [];
}
