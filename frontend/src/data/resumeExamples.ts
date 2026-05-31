import type { ResumeData } from "../types";
import type { TemplateId } from "../store";
import examplesJson from "./resumeExamples.json";

export interface ResumeExample {
  slug: string;
  name: string;
  position: string;
  city: string;
  tagline: string;
  accent: string;
  resume: ResumeData;
}

export const EXAMPLE_TEMPLATES: ReadonlyArray<{
  id: TemplateId;
  label: string;
  hint: string;
  chipColor: string;
}> = [
  { id: "classic", label: "Classic", hint: "Тёмный акцент", chipColor: "#0d5c3a" },
  { id: "modern", label: "Modern", hint: "Минимализм", chipColor: "#2563eb" },
  { id: "compact", label: "Compact", hint: "Светлый", chipColor: "#7c3aed" },
] as const;

export const RESUME_EXAMPLES = examplesJson as ResumeExample[];

export function exampleImageUrl(slug: string, template: TemplateId = "classic"): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/examples/${slug}-${template}.png`;
}
