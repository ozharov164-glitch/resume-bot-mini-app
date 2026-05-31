import type { UserAnswers, WorkEntry } from "../types";

export type StepType =
  | "text"
  | "textarea"
  | "options"
  | "profession"
  | "contacts_dual"
  | "options_with_input"
  | "multi_select"
  | "work_history";

export interface OnboardingStep {
  id: keyof UserAnswers | string;
  question: string;
  type: StepType;
  placeholder?: string;
  options?: readonly string[];
  hint?: string;
  skipText?: string;
  optional?: boolean;
  required?: boolean;
  showIf?: (answers: Partial<UserAnswers>) => boolean;
  optionsByPosition?: Record<string, readonly string[]>;
  allowCustomInput?: boolean;
  customInputPlaceholder?: string;
  rows?: number;
  validate?: (value: string) => string | null;
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
    question: "Имя и фамилия",
    type: "text",
    placeholder: "Иван Петров",
    hint: "Как в резюме — без отчества",
    validate: (value: string) => {
      const hasVowel = /[аеёиоуыьъэюяАЕЁИОУЫЬЪЭЮЯaeiouyAEIOUY]/.test(value);
      const hasSpace = value.trim().includes(" ");
      const longEnough = value.trim().length >= 4;
      if (!hasVowel || !hasSpace || !longEnough) {
        return "Введите имя и фамилию (например: Иван Петров)";
      }
      return null;
    },
  },
  {
    id: "patronymic",
    question: "Отчество",
    type: "text",
    placeholder: "Сергеевич",
    hint: "Необязательно — можно пропустить",
    skipText: "Пропустить",
    optional: true,
    validate: (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const hasVowel = /[аеёиоуыьъэюяАЕЁИОУЫЬЪЭЮЯ]/.test(trimmed);
      if (trimmed.length < 3 || !hasVowel) {
        return "Введите отчество полностью (например: Сергеевич)";
      }
      return null;
    },
  },
  {
    id: "gender",
    question: "Укажите пол",
    type: "options",
    options: ["Мужской", "Женский"],
    hint: "Нужно для правильных формулировок в резюме",
    required: true,
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
    question: "На какую должность вы ищете работу?",
    hint: "Выберите профессию из списка или напишите свой вариант.",
    type: "profession",
    placeholder: "Например: водитель-экспедитор",
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
    id: "work_history",
    question: "Где вы работали?",
    type: "work_history",
    hint: "Добавьте до 3 мест работы — чем больше деталей, тем лучше резюме.",
    skipText: "Нет опыта работы",
    required: false,
  },
  {
    id: "achievements",
    question: "Достижения в цифрах",
    type: "textarea",
    placeholder: "доставлял 40 заказов в день, 0 аварий за 3 года, план 120%",
    hint: "Необязательно — конкретные цифры усиливают резюме.",
    skipText: "Пропустить",
    optional: true,
    rows: 3,
  },
  {
    id: "education",
    question: "Образование",
    type: "options",
    options: ["Среднее", "Колледж", "Незаконченное высшее", "Высшее", "Курсы"],
  },
  {
    id: "education_place",
    question: "Название учебного заведения",
    type: "text",
    placeholder: "Например: МГУ, РГУ",
    hint: "Необязательно — можно пропустить",
    skipText: "Пропустить",
    required: false,
    showIf: (answers) => answers.education !== "Среднее",
  },
  {
    id: "certificates",
    question: "Сертификаты и лицензии",
    type: "textarea",
    placeholder: "Например: права кат. B, лицензия охранника, медкнижка, удостоверение сварщика",
    hint: "Необязательно. Укажите документы, которые повышают шансы на должность.",
    skipText: "Нет документов",
    optional: true,
  },
  {
    id: "languages",
    question: "Знаете иностранные языки?",
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

export const OPTIONS_ONLY = new Set(["education", "languages", "gender"]);

export function getVisibleSteps(answers: Partial<UserAnswers>): OnboardingStep[] {
  return ONBOARDING_STEPS.filter((s) => !s.showIf || s.showIf(answers));
}

export function deriveExperienceLevel(workHistory: WorkEntry[] | undefined): string {
  const entries = workHistory || [];
  const hasExp = entries.some(
    (j) => j.company.trim() || j.duties.trim() || j.period.trim() || j.position.trim(),
  );
  return hasExp ? "Есть опыт" : "Нет опыта";
}

export function buildLastJobFromWorkHistory(workHistory: WorkEntry[] | undefined): string {
  return (workHistory || [])
    .filter((j) => j.company.trim() || j.duties.trim())
    .map(
      (j) =>
        `${j.company} (${j.period}), должность: ${j.position}.\n${j.duties}`,
    )
    .join("\n\n");
}

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
