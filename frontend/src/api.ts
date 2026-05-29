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
  return http<{ status: string }>("/api/payment/create-invoice/" + resumeId, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
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
