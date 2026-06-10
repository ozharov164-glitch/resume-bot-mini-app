import type { UserAnswers, WorkEntry } from "../types";

export type StepType =
  | "text"
  | "textarea"
  | "options"
  | "profession"
  | "contacts_dual"
  | "options_with_input"
  | "multi_select"
  | "work_history"
  | "photo_setup";

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
  /** Step is kept in fast-mode (quick 5-step flow); others are skipped */
  fastModeCore?: boolean;
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

function getAchievementsPlaceholder(position: string): string {
  const p = position.toLowerCase();
  if (p.includes("водител") || p.includes("экспедит")) {
    return "40 заказов в день, 0 аварий за 3 года, план 120%";
  }
  if (p.includes("курьер") || p.includes("доставк")) {
    return "35 заказов/день, рейтинг 4.9, 0 возвратов";
  }
  if (p.includes("охран")) {
    return "8 лет без нарушений, провёл 50+ досмотров/смена";
  }
  if (p.includes("продав") || p.includes("кассир")) {
    return "выполнение плана 115%, обслуживал 200 покупателей/день";
  }
  if (p.includes("повар") || p.includes("официант")) {
    return "60 посадочных мест, выручка стола +20% к среднему";
  }
  if (p.includes("склад") || p.includes("грузчик") || p.includes("комплект")) {
    return "500 позиций/смена, 0 расхождений при инвентаризации";
  }
  if (p.includes("электрик") || p.includes("сварщик")) {
    return "сдал 200 м² проводки за месяц, 0 рекламаций";
  }
  return "выполнение плана 120%, снизил затраты на 15%, обучил 3 новых сотрудников";
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "photo_setup",
    question: "Фото для резюме",
    type: "photo_setup",
    hint: "Первый шаг — выберите, нужен ли портрет",
    optional: true,
    skipText: "Пропустить",
  },
  {
    id: "name",
    question: "Имя и фамилия",
    type: "text",
    placeholder: "Иван Петров",
    hint: "Как в резюме — без отчества",
    fastModeCore: true,
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
  },
  {
    id: "gender",
    question: "Укажите пол",
    type: "options",
    options: ["Мужской", "Женский"],
    hint: "Нужно для правильных формулировок в резюме",
    required: true,
    fastModeCore: true,
  },
  {
    id: "contacts",
    question: "Контакты для резюме",
    type: "contacts_dual",
    hint: "Можно добавить позже в PDF, DOCX",
    skipText: "Пропустить оба",
    optional: true,
  },
  {
    id: "target_position",
    question: "На какую должность вы ищете работу?",
    hint: "Выберите профессию из списка или напишите свой вариант.",
    type: "profession",
    placeholder: "Например: водитель-экспедитор",
    fastModeCore: true,
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
    fastModeCore: true,
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
    skipText: "Пропустить",
    optional: true,
  },
  {
    id: "education_place",
    question: "Название учебного заведения",
    type: "text",
    placeholder: "Например: МГУ, РГУ",
    hint: "Необязательно — можно пропустить",
    skipText: "Пропустить",
    required: false,
    optional: true,
    showIf: (answers) => answers.education !== "Среднее" && Boolean(answers.education),
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
  {
    id: "city",
    question: "Город поиска работы",
    type: "text",
    placeholder: "Казань",
    hint: "Необязательно — можно пропустить",
    skipText: "Пропустить",
    optional: true,
    fastModeCore: true,
  },
  {
    id: "work_schedule",
    question: "Удобный график работы",
    type: "multi_select",
    options: [
      "Полный день",
      "Сменный график",
      "2/2",
      "Вахта",
      "Неполный день",
      "Удалённо",
    ],
    hint: "Можно выбрать несколько вариантов.",
    skipText: "Не указывать",
    optional: true,
  },
  {
    id: "relocation",
    question: "Готовность к переезду",
    type: "options",
    options: [
      "Не готов",
      "Готов к переезду",
      "Готов к командировкам",
      "Готов к переезду и командировкам",
    ],
    skipText: "Не указывать",
    optional: true,
  },
  {
    id: "about",
    question: "Коротко о себе",
    type: "textarea",
    placeholder: "Например: ответственный, доброжелательный, быстро обучаюсь.",
    hint: "Необязательно — можно пропустить",
    skipText: "Пропустить",
    optional: true,
  },
];

export const OPTIONS_ONLY = new Set(["education", "languages", "gender", "relocation"]);

function positionLower(answers: Partial<UserAnswers>): string {
  return String(answers.target_position ?? "").toLowerCase();
}

function matchesPosition(answers: Partial<UserAnswers>, keywords: readonly string[]): boolean {
  const pos = positionLower(answers);
  return keywords.some((k) => pos.includes(k));
}

export const PROFESSION_EXTRA_STEPS: OnboardingStep[] = [
  {
    id: "prof_driver_license",
    question: "Категории водительских прав",
    type: "multi_select",
    options: ["B", "C", "D", "E", "BE"],
    hint: "Только то, что есть у вас — попадёт в резюме.",
    skipText: "Пропустить",
    optional: true,
    showIf: (a) => matchesPosition(a, ["водител", "дальнобой", "экспедитор", "такс"]),
  },
  {
    id: "prof_driver_experience",
    question: "Стаж за рулём",
    type: "options",
    options: ["до 1 года", "1–3 года", "3–5 лет", "более 5 лет"],
    optional: true,
    skipText: "Пропустить",
    showIf: (a) => matchesPosition(a, ["водител", "дальнобой", "экспедитор"]),
  },
  {
    id: "prof_guard_license",
    question: "Лицензия / удостоверение охранника",
    type: "options",
    options: ["Есть действующая", "Прохожу переаттестацию", "Нет"],
    showIf: (a) => matchesPosition(a, ["охран", "чоп", "вахт"]),
  },
  {
    id: "prof_courier_vehicle",
    question: "На чём доставляете",
    type: "options",
    options: ["Пешком", "Велосипед", "Свой автомобиль", "Авто компании"],
    showIf: (a) => matchesPosition(a, ["курьер", "доставк"]),
  },
  {
    id: "prof_painter_surfaces",
    question: "С какими поверхностями работали",
    type: "multi_select",
    options: ["Штукатурка", "Гипсокартон", "Дерево", "Металл", "Фасады"],
    skipText: "Пропустить",
    optional: true,
    showIf: (a) => matchesPosition(a, ["маляр", "штукатур", "отделоч"]),
  },
  {
    id: "prof_seller_goods",
    question: "Какой товар продавали?",
    type: "options",
    options: ["Продукты питания", "Одежда и обувь", "Электроника", "Стройматериалы", "Разное"],
    showIf: (a) => matchesPosition(a, ["продав", "кассир", "мерчен", "консульт"]),
    skipText: "Пропустить",
    optional: true,
  },
  {
    id: "prof_seller_systems",
    question: "Программы/оборудование",
    type: "multi_select",
    options: ["1С Торговля", "Кассовый аппарат", "CRM", "Терминал оплаты", "Сканер штрихкодов"],
    showIf: (a) => matchesPosition(a, ["продав", "кассир", "мерчен", "консульт"]),
    skipText: "Пропустить",
    optional: true,
  },
  {
    id: "prof_loader_equipment",
    question: "Спецтехника и оборудование",
    type: "multi_select",
    options: ["Вилочный погрузчик", "Рохля", "Штабелёр", "Конвейер", "Терминал сбора данных"],
    showIf: (a) => matchesPosition(a, ["грузчик", "склад", "комплект", "сборщик", "операт"]),
    skipText: "Пропустить",
    optional: true,
  },
  {
    id: "prof_loader_marketplace",
    question: "Работали на маркетплейсе?",
    type: "options",
    options: ["Wildberries", "Ozon", "Яндекс.Маркет", "СДЭК", "Нет"],
    showIf: (a) => matchesPosition(a, ["грузчик", "склад", "комплект", "сборщик"]),
    skipText: "Пропустить",
    optional: true,
  },
  {
    id: "prof_catering_systems",
    question: "Системы автоматизации",
    type: "multi_select",
    options: ["R-Keeper", "iiko", "1С Общепит", "Poster", "Tillypad"],
    showIf: (a) => matchesPosition(a, ["официант", "повар", "бармен", "бариста", "администр"]),
    skipText: "Пропустить",
    optional: true,
  },
  {
    id: "prof_catering_cuisine",
    question: "Тип кухни / заведения",
    type: "options",
    options: ["Европейская", "Азиатская", "Фастфуд", "Кофейня", "Бар/ресторан", "Столовая"],
    showIf: (a) => matchesPosition(a, ["официант", "повар", "бармен", "бариста"]),
    skipText: "Пропустить",
    optional: true,
  },
  {
    id: "prof_tech_admission",
    question: "Допуски и разряды",
    type: "multi_select",
    options: ["2 разряд", "3 разряд", "4 разряд", "5 разряд", "Допуск до 1000В", "НАКС (сварщик)"],
    showIf: (a) => matchesPosition(a, ["электрик", "сварщик", "монтажник", "слесарь", "токарь", "механ"]),
    skipText: "Пропустить",
    optional: true,
  },
  {
    id: "prof_medical_spec",
    question: "Специализация / отделение",
    type: "options",
    options: ["Терапия", "Хирургия", "Скорая помощь", "Педиатрия", "Процедурный кабинет", "Другое"],
    showIf: (a) => matchesPosition(a, ["медсест", "санитар", "фельдшер", "сиделк", "медбрат", "нянечк"]),
    skipText: "Пропустить",
    optional: true,
  },
  {
    id: "prof_edu_subject",
    question: "Предмет или направление",
    type: "text",
    placeholder: "Например: математика, начальные классы, логопедия",
    showIf: (a) => matchesPosition(a, ["учитель", "педагог", "воспитат", "логопед", "тренер", "инструктор"]),
    skipText: "Пропустить",
    optional: true,
  },
];

export function isProfessionExtraStep(step: OnboardingStep): boolean {
  return String(step.id).startsWith("prof_");
}

export function getVisibleSteps(
  answers: Partial<UserAnswers>,
  fastMode = false,
): OnboardingStep[] {
  const positionPlaceholder = answers?.target_position ? String(answers.target_position) : "";
  const filtered = ONBOARDING_STEPS.filter((s) => {
    if (s.showIf && !s.showIf(answers)) return false;
    if (fastMode && !s.fastModeCore) return false;
    return true;
  });
  const base = filtered.map((s) => {
    if (s.id !== "achievements") return s;
    return {
      ...s,
      placeholder: getAchievementsPlaceholder(positionPlaceholder),
    };
  });
  // profession-specific extras are skipped in fast mode
  if (fastMode) return base;
  const extras = PROFESSION_EXTRA_STEPS.filter((s) => !s.showIf || s.showIf(answers));
  if (!extras.length) return base;

  const out: OnboardingStep[] = [];
  for (const step of base) {
    out.push(step);
    if (step.id === "target_position") {
      out.push(...extras);
    }
  }
  return out;
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
