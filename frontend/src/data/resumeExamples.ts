import type { ResumeData } from "../types";
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

export const RESUME_EXAMPLES = examplesJson as ResumeExample[];

export function exampleImageUrl(slug: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/examples/${slug}.png`;
}
