import { getTg } from "../telegram";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function trackEvent(event: string, meta?: Record<string, unknown>): void {
  const tg = getTg();
  const telegramId = tg?.initDataUnsafe?.user?.id;
  if (!telegramId) return;

  const body = {
    event,
    telegram_id: telegramId,
    ...(meta?.step !== undefined ? { step: meta.step } : {}),
    metadata: meta,
  };

  void fetch(`${API_URL}/api/analytics/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((err) => {
    console.debug("analytics", event, err);
  });
}
