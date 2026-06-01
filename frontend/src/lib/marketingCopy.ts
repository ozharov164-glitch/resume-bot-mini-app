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
    subtitle: "Бесплатный предпросмотр до оплаты. Риска нет.",
  },
  {
    icon: "verified" as const,
    title: "Формат hh.ru",
    subtitle: "Структура, к которой привыкли рекрутеры.",
  },
  {
    icon: "savings" as const,
    title: "149 ₽",
    subtitle: "Дешевле большинства сервисов при сопоставимом качестве.",
  },
  {
    icon: "lock" as const,
    title: "Конфиденциальность",
    subtitle: "Данные только для резюме — не продаём и не передаём.",
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
  "Создайте профессиональное резюме для hh.ru за 5 минут в Telegram: ИИ, три шаблона PDF, бесплатный предпросмотр.";
