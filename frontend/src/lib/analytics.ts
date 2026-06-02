import { readCachedAuthToken } from "./authSession";
import { getTg } from "../telegram";
import { useAppStore } from "../store";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function trackEvent(event: string, meta?: Record<string, unknown>): void {
  const tg = getTg();
  const telegramId = tg?.initDataUnsafe?.user?.id;
  if (!telegramId) return;

  const token =
    useAppStore.getState().authToken || readCachedAuthToken();
  if (!token) return;

  const body = {
    event,
    telegram_id: telegramId,
    ...(meta?.step !== undefined ? { step: meta.step } : {}),
    metadata: meta,
  };

  void fetch(`${API_URL}/api/analytics/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).catch((err) => {
    console.debug("analytics", event, err);
  });
}
