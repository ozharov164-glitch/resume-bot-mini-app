import type { ResumeData, UserAnswers } from "./types";
import { clearCachedAuthToken, readCachedAuthToken, writeCachedAuthToken } from "./lib/authSession";
import { fetchWithTimeout, HttpTimeoutError, withRetries } from "./lib/http";
import { useAppStore } from "./store";
import { waitForInitData } from "./telegram";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 12_000;

export type TemplateId = "classic" | "modern" | "compact";

async function http<T>(path: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const response = await fetchWithTimeout(`${API_URL}${path}`, init, timeoutMs);
  const text = await response.text();
  if (!response.ok) {
    let detail = text || "Сервис временно недоступен";
    try {
      const parsed = JSON.parse(text) as { detail?: string };
      if (parsed.detail) detail = parsed.detail;
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
        15_000,
      ),
    2,
    500,
  );
}

export { HttpTimeoutError };

export async function fetchMe(token: string) {
  return http<{ telegram_id: number; is_founder: boolean; unlimited: boolean }>("/api/auth/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
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

export async function createStarsInvoice(token: string, resumeId: string) {
  return http<{ status: string; invoice_link: string; provider: string }>(
    "/api/payment/create-invoice/" + resumeId,
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

export async function createYookassaInvoice(token: string, resumeId: string) {
  return http<{ confirmation_url: string }>("/api/payment/create-yookassa/" + resumeId, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
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
  };
}


export async function setResumeTemplate(token: string, resumeId: string, templateId: TemplateId) {
  return http<{ ok: boolean; template_id: string }>(`/api/resume/${resumeId}/template`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ template_id: templateId }),
  });
}

export async function fetchStatsCount(): Promise<number> {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/stats/count`, {}, 8_000);
    if (!response.ok) throw new Error("stats unavailable");
    const data = (await response.json()) as { count?: number };
    if (typeof data.count === "number" && data.count > 0) return data.count;
    return 1200;
  } catch {
    return 1200;
  }
}
