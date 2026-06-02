/** Маркетинговые тексты приложения — единый тон и факты о продукте. */

export const HOME_HEADLINE = "Резюме, которое замечают на hh.ru";

export const HOME_TAGLINE =
  "Рекрутер решает за несколько секунд — успеете ли вы произвести впечатление. " +
  "Ответьте на простые вопросы: мы упакуем ваш опыт в готовый PDF и пришлём файл в Telegram. " +
  "Пять минут, без Word и лишних сервисов.";

export const HOME_BENEFITS = [
  {
    icon: "smart_toy" as const,
    title: "ИИ упакует ваш опыт",
    subtitle: "Из ваших ответов — связный текст, который читается уверенно и по делу.",
  },
  {
    icon: "palette" as const,
    title: "Оформление уже готово",
    subtitle: "Три шаблона PDF — смените стиль на предпросмотре перед оплатой.",
  },
  {
    icon: "send" as const,
    title: "PDF сразу в Telegram",
    subtitle: "Скачали — отправили работодателю. Без регистраций на сторонних сайтах.",
  },
] as const;

export const HOME_TRUST_POINTS = [
  {
    icon: "visibility" as const,
    title: "Сначала смотрите — потом платите",
    subtitle: "Бесплатный предпросмотр с реальным текстом резюме. Риска нет.",
  },
  {
    icon: "description" as const,
    title: "PDF + текст для hh.ru",
    subtitle: "Файл и блок для вставки на сайт — в одном месте, без Word.",
  },
  {
    icon: "mic" as const,
    title: "Голосом с телефона",
    subtitle: "Диктуйте ответы в анкете — не набирайте длинные тексты.",
  },
  {
    icon: "verified" as const,
    title: "Только ваши факты",
    subtitle: "ИИ не придумывает опыт и компании — усиливает ваши формулировки.",
  },
  {
    icon: "savings" as const,
    title: "149 ₽",
    subtitle: "Дешевле многих конструкторов. Не устроит — вернём Stars.",
  },
  {
    icon: "work" as const,
    title: "Под вашу профессию",
    subtitle: "Доп-вопросы для водителя, продавца, склада, общепита и других.",
  },
] as const;

export const EXAMPLES_GALLERY_SUB =
  "Посмотрите, как выглядит результат — один опыт, три стиля оформления под hh.ru.";

export const PREVIEW_CHECKLIST = [
  "PDF для отправки работодателю",
  "Текст для вставки на hh.ru",
  "Оформление в выбранном шаблоне",
] as const;

export const PREVIEW_FOOTNOTE =
  "Так выглядит выбранный шаблон — чистый PDF придёт в Telegram после оплаты";

export const HH_RU_BADGE = "Структура и подача — как ждут на hh.ru";

/** SEO / meta */
export const META_TITLE = "ResumeBot — резюме для hh.ru за 5 минут";
export const META_DESCRIPTION =
  "Создайте резюме для hh.ru за 5 минут в Telegram: ИИ только из ваших фактов, " +
  "три шаблона PDF, бесплатный предпросмотр, готовый текст для hh.ru.";
