import type { ResumeData, UserAnswers } from "./types";
import { clearCachedAuthToken, readCachedAuthToken, writeCachedAuthToken } from "./lib/authSession";
import { fetchWithTimeout, HttpTimeoutError, withRetries } from "./lib/http";
import { useAppStore } from "./store";
import { waitForInitData } from "./telegram";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 12_000;
const AUTH_TIMEOUT_MS = 8_000;

export type TemplateId = "classic" | "modern" | "compact";

async function http<T>(path: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const response = await fetchWithTimeout(`${API_URL}${path}`, init, timeoutMs);
  const text = await response.text();
  if (!response.ok) {
    let detail = text || "Сервис временно недоступен";
    try {
      const parsed = JSON.parse(text) as {
        detail?: string | { msg?: string }[];
        message?: string;
        error?: string;
      };
      if (typeof parsed.message === "string" && parsed.message) {
        detail = parsed.message;
      } else if (parsed.detail) {
        detail =
          typeof parsed.detail === "string"
            ? parsed.detail
            : Array.isArray(parsed.detail)
              ? parsed.detail.map((d) => d.msg).filter(Boolean).join("; ")
              : detail;
      }
    } catch {
      /* plain text error */
    }
    if (response.status === 401) {
      clearCachedAuthToken();
    }
    throw new Error(detail);
  }
  return JSON.parse(text) as T;
}

export async function ensureAuthToken(): Promise<string> {
  const { authToken, setAuthToken, setFounder } = useAppStore.getState();
  if (authToken) return authToken;

  const cached = readCachedAuthToken();
  if (cached) {
    try {
      const me = await fetchMe(cached);
      setAuthToken(cached);
      if (me.is_founder || me.unlimited) setFounder(true);
      return cached;
    } catch {
      clearCachedAuthToken();
    }
  }

  const initData = await waitForInitData(10_000);
  if (!initData) {
    throw new Error("OPEN_VIA_BOT");
  }

  const auth = await authWithTelegram(initData);
  writeCachedAuthToken(auth.access_token);
  setAuthToken(auth.access_token);
  if (auth.is_founder || auth.unlimited) {
    setFounder(true);
  }
  return auth.access_token;
}

export async function authWithTelegram(initData: string) {
  return withRetries(
    () =>
      http<{ access_token: string; token_type: string; is_founder?: boolean; unlimited?: boolean }>(
        "/api/auth/telegram",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ init_data: initData }),
        },
        AUTH_TIMEOUT_MS,
      ),
    2,
    350,
  );
}

export { HttpTimeoutError, fetchWithTimeout };

export async function fetchMe(token: string, timeoutMs = AUTH_TIMEOUT_MS) {
  return http<{
    telegram_id: number;
    is_founder: boolean;
    unlimited: boolean;
    bonus_stars?: number;
  }>(
    "/api/auth/me",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
    timeoutMs,
  );
}

export async function suggestSkills(token: string, position: string) {
  return http<{ skills: string[]; groups: Record<string, string[]> }>(
    "/api/skills/suggest",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ position }),
    },
    30_000,
  );
}

export async function generateResume(
  token: string,
  data: Partial<UserAnswers>,
  templateId: TemplateId = "classic",
) {
  return http<{ resume_id: string; resume: ResumeData; paid: boolean }>(
    "/api/resume/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...data, template_id: templateId }),
    },
    120_000,
  );
}

export async function createStarsInvoice(
  token: string,
  resumeId: string,
  useBonus = false,
) {
  return http<{
    status: string;
    invoice_link: string;
    provider: string;
    stars_amount?: number;
    bonus_stars_applied?: number;
  }>("/api/payment/create-invoice/" + resumeId, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ use_bonus: useBonus }),
  });
}

export async function fetchHhText(
  token: string,
  resumeId: string,
): Promise<{ preview?: string; text?: string; is_paid: boolean }> {
  return http<{ preview?: string; text?: string; is_paid: boolean }>(
    `/api/resume/${resumeId}/hh-text`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export async function fetchTextExport(token: string, resumeId: string): Promise<string> {
  const response = await fetchWithTimeout(
    `${API_URL}/api/resume/${resumeId}/text-export`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
    DEFAULT_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw new Error("Не удалось получить текст резюме");
  }
  return response.text();
}

export async function saveAdaptVacancy(token: string, resumeId: string, vacancyText: string) {
  return http<{ ok: boolean }>(`/api/resume/${resumeId}/adapt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ vacancy_text: vacancyText }),
  });
}

export async function createAdaptInvoice(token: string, resumeId: string) {
  return http<{ invoice_link: string; stars_amount: number }>(
    `/api/payment/create-adapt-invoice/${resumeId}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export interface ResumeListItem {
  id: string;
  full_name: string;
  target_position: string;
  is_paid: boolean;
  created_at: string;
  template_id?: string;
}

export interface ResumeRecord {
  id: string;
  is_paid: boolean;
  data: ResumeData;
  user_answers?: Partial<UserAnswers>;
  created_at?: string;
}

export async function fetchResumeList(token: string) {
  return http<{ items: ResumeListItem[] }>("/api/resume/list", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function clearResumeHistory(token: string) {
  return http<{ ok: boolean; deleted: number }>("/api/resume/history", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getResume(token: string, resumeId: string) {
  return http<ResumeRecord>(`/api/resume/${resumeId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Poll until backend marks resume paid (bot successful_payment handler). */
export async function waitUntilPaid(
  token: string,
  resumeId: string,
  maxAttempts = 20,
  delayMs = 800,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const resume = await getResume(token, resumeId);
    if (resume.is_paid) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

export async function createYookassaInvoice(
  token: string,
  resumeId: string,
  useBonus = false,
) {
  return http<{
    confirmation_url: string;
    amount_rub?: string;
    bonus_stars_applied?: number;
  }>("/api/payment/create-yookassa/" + resumeId, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ use_bonus: useBonus }),
  });
}

export async function requestPdf(token: string, resumeId: string) {
  return http<{ status: string; filename: string }>(`/api/resume/${resumeId}/download`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function validatePromo(code: string, token: string) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/payment/validate-promo`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  if (!response.ok) {
    const text = await response.text();
    let detail = text || "Промокод недействителен";
    try {
      const parsed = JSON.parse(text) as { detail?: string };
      if (parsed.detail) detail = parsed.detail;
    } catch {
      /* plain text */
    }
    throw new Error(detail);
  }
  return JSON.parse(await response.text()) as {
    valid: boolean;
    discount_percent: number;
    code: string;
    already_active?: boolean;
  };
}

export async function fetchActivePromo(token: string) {
  return http<{ active: boolean; code?: string; discount_percent?: number }>("/api/promo/active", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function activatePromo(code: string, token: string) {
  return http<{ ok: boolean; code: string; discount_percent: number; already_active?: boolean }>(
    "/api/promo/activate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
    },
  );
}


export async function setResumeTemplate(token: string, resumeId: string, templateId: TemplateId) {
  return http<{ ok: boolean; template_id: string }>(`/api/resume/${resumeId}/template`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ template_id: templateId }),
  });
}

interface StatsData {
  count: number;
  today_count: number;
  paid_count: number;
}

let _statsCache: { data: StatsData; ts: number } | null = null;
const STATS_TTL_MS = 60_000;

export async function fetchStats(): Promise<StatsData> {
  const now = Date.now();
  if (_statsCache && now - _statsCache.ts < STATS_TTL_MS) {
    return _statsCache.data;
  }
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/stats/count`, {}, 8_000);
    if (!response.ok) throw new Error("stats unavailable");
    const raw = (await response.json()) as Partial<StatsData>;
    const data: StatsData = {
      count: typeof raw.count === "number" && raw.count > 0 ? raw.count : 1200,
      today_count: raw.today_count ?? 0,
      paid_count: raw.paid_count ?? 0,
    };
    _statsCache = { data, ts: now };
    return data;
  } catch {
    return { count: 1200, today_count: 0, paid_count: 0 };
  }
}

/** @deprecated Use fetchStats() instead */
export async function fetchStatsCount(): Promise<number> {
  return (await fetchStats()).count;
}

/** @deprecated Use fetchStats() instead */
export async function fetchTodayCount(): Promise<number> {
  return (await fetchStats()).today_count;
}
