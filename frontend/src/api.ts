import type { UserAnswers } from "./types";
import { useAppStore } from "./store";
import { waitForInitData } from "./telegram";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function http<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  const text = await response.text();
  if (!response.ok) {
    let detail = text || "Сервис временно недоступен";
    try {
      const parsed = JSON.parse(text) as { detail?: string };
      if (parsed.detail) detail = parsed.detail;
    } catch {
      /* plain text error */
    }
    throw new Error(detail);
  }
  return JSON.parse(text) as T;
}

export async function ensureAuthToken(): Promise<string> {
  const { authToken, setAuthToken, setFounder } = useAppStore.getState();
  if (authToken) return authToken;

  const initData = await waitForInitData(6000);
  if (!initData) {
    throw new Error("OPEN_VIA_BOT");
  }

  const auth = await authWithTelegram(initData);
  setAuthToken(auth.access_token);
  if (auth.is_founder || auth.unlimited) {
    setFounder(true);
  }
  return auth.access_token;
}

export async function authWithTelegram(initData: string) {
  return http<{ access_token: string; token_type: string; is_founder?: boolean; unlimited?: boolean }>(
    "/api/auth/telegram",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ init_data: initData }),
    },
  );
}

export async function fetchMe(token: string) {
  return http<{ telegram_id: number; is_founder: boolean; unlimited: boolean }>("/api/auth/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function generateResume(token: string, data: Partial<UserAnswers>) {
  return http<{ resume_id: string; resume: any; paid: boolean }>("/api/resume/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
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

export async function getResume(token: string, resumeId: string) {
  return http<{ is_paid: boolean; id: string }>(`/api/resume/${resumeId}`, {
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

export async function fetchStatsCount(): Promise<number> {
  try {
    const response = await fetch(`${API_URL}/api/stats/count`);
    if (!response.ok) throw new Error("stats unavailable");
    const data = (await response.json()) as { count?: number };
    if (typeof data.count === "number" && data.count > 0) return data.count;
    return 1200;
  } catch {
    return 1200;
  }
}
