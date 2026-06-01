import { capitalizePersonName } from "./formatPersonName";
import type { ResumeData } from "../types";

function asStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function asStrList(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => asStr(x)).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Guard Mini App against legacy/AI shapes (e.g. skills as comma string). */
export function normalizeResumeData(raw: ResumeData): ResumeData {
  return {
    ...raw,
    full_name: capitalizePersonName(asStr(raw.full_name)),
    target_position: asStr(raw.target_position),
    city: asStr(raw.city),
    phone: asStr(raw.phone),
    email: asStr(raw.email),
    summary: asStr(raw.summary),
    salary: asStr(raw.salary),
    skills: asStrList(raw.skills),
    languages: asStrList(raw.languages).length
      ? asStrList(raw.languages)
      : ["Русский — родной"],
    certificates: asStrList(raw.certificates),
    experience: Array.isArray(raw.experience)
      ? raw.experience.map((e) => ({
          company: asStr(e?.company),
          position: asStr(e?.position),
          period: asStr(e?.period),
          description: asStr(e?.description),
        }))
      : [],
    education: Array.isArray(raw.education)
      ? raw.education.map((e) => ({
          institution: asStr(e?.institution),
          degree: asStr(e?.degree),
          year: asStr(e?.year),
        }))
      : [],
  };
}
