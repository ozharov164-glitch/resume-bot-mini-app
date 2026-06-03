import type { TemplateId } from "../store";

export const PDF_TEMPLATES: ReadonlyArray<{
  id: TemplateId;
  name: string;
  description: string;
  chipColor: string;
}> = [
  {
    id: "classic",
    name: "Classic",
    description: "Тёмный акцент, две колонки — классика hh.ru",
    chipColor: "#0d5c3a",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Одна колонка — проходит автоотбор (ATS), синие акценты",
    chipColor: "#2563eb",
  },
  {
    id: "compact",
    name: "Compact",
    description: "Светлый сайдбар, максимум контента на странице",
    chipColor: "#7c3aed",
  },
] as const;

export function templatePreviewUrl(id: TemplateId): string {
  return `${import.meta.env.BASE_URL}templates/${id}.png`;
}
