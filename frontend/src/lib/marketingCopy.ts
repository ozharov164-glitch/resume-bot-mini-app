/** Маркетинговые тексты приложения — единый тон и факты о продукте. */

export const HOME_HEADLINE = "Ваше профессиональное резюме за 5 минут";

export const HOME_TAGLINE =
  "Раньше резюме требовали не в каждой профессии — сегодня без него сложнее выйти на достойную работу. " +
  "Помогаем водителям и курьерам, строителям и электрикам, продавцам и медикам, охранникам и поварам — " +
  "всем, кто привык искать «по знакомству», а теперь откликается на hh.ru и в Telegram.";

export const HOME_BENEFITS = [
  {
    icon: "smart_toy" as const,
    title: "ИИ напишет и оформит",
    subtitle: "Текст по вашим ответам и готовый PDF — без Word и без возни с полями.",
  },
  {
    icon: "palette" as const,
    title: "Три шаблона на выбор",
    subtitle: "Classic, Modern или Compact — выбираете в начале, перед оплатой можно сменить.",
  },
  {
    icon: "send" as const,
    title: "PDF сразу в чат",
    subtitle: "Скачивайте и отправляйте работодателю — регистрации на сторонних сайтах не нужно.",
  },
] as const;

export const HOME_TRUST_POINTS = [
  {
    icon: "visibility" as const,
    title: "Сначала смотри — потом плати",
    subtitle: "Бесплатный предпросмотр до оплаты. Риска нет.",
  },
  {
    icon: "verified" as const,
    title: "Формат hh.ru",
    subtitle: "Структура, к которой привыкли рекрутеры — не откладывают в сторону.",
  },
  {
    icon: "palette" as const,
    title: "Готовое оформление",
    subtitle: "Не пустой лист — профессиональный макет в выбранном шаблоне.",
  },
  {
    icon: "savings" as const,
    title: "149 ₽ вместо 500–1000 ₽",
    subtitle: "Дешевле конкурентов при сопоставимом качестве.",
  },
  {
    icon: "lock" as const,
    title: "Данные только для резюме",
    subtitle: "Не продаём и не передаём третьим лицам.",
  },
] as const;

export const EXAMPLES_GALLERY_SUB =
  "Один и тот же опыт — три профессиональных шаблона PDF под hh.ru. Выберите свой в конструкторе.";

export const PREVIEW_CHECKLIST = [
  "Резюме готово к отправке",
  "Структура под hh.ru",
  "Оформление в выбранном шаблоне",
] as const;

export const PREVIEW_FOOTNOTE =
  "Так выглядит выбранный шаблон — чистый PDF придёт в Telegram после оплаты";

export const HH_RU_BADGE = "Структура и подача — как ждут на hh.ru";
