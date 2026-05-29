import type { UserAnswers } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function http<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Сервис временно недоступен");
  }
  return response.json() as Promise<T>;
}

export async function authWithTelegram(initData: string) {
  return http<{ access_token: string; token_type: string }>("/api/auth/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ init_data: initData }),
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
