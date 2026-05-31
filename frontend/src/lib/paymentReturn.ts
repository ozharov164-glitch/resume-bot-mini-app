import { getResume, waitUntilPaid } from "../api";
import type { ResumeData } from "../types";
import { getTg } from "../telegram";
import { parsePaymentReturnResumeId } from "./deepLink";

const PENDING_KEY = "yookassa_pending_resume_id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isResumeId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function markYookassaPending(resumeId: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, resumeId);
  } catch {
    /* private mode */
  }
}

export function clearYookassaPending(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function getYookassaPending(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_KEY);
    return id && isResumeId(id) ? id : null;
  } catch {
    return null;
  }
}

/** start_param from t.me?start=pay_<uuid> when Mini App opened via direct link. */
export function parsePaymentStartParam(): string | null {
  const param = getTg()?.initDataUnsafe?.start_param?.trim();
  if (!param?.startsWith("pay_")) return null;
  const id = param.slice(4).trim();
  return isResumeId(id) ? id : null;
}

export function discoverPaymentReturnResumeId(): string | null {
  return (
    parsePaymentReturnResumeId(window.location.hash) ||
    parsePaymentStartParam() ||
    getYookassaPending()
  );
}

export type PaymentReturnOutcome = "success" | "pending" | "error";

export async function completePaymentReturn(
  authToken: string,
  resumeId: string,
): Promise<{
  outcome: PaymentReturnOutcome;
  data?: ResumeData;
}> {
  try {
    const resume = await getResume(authToken, resumeId);
    const confirmed =
      resume.is_paid || (await waitUntilPaid(authToken, resumeId, 45, 1000));
    if (confirmed) {
      clearYookassaPending();
      return { outcome: "success", data: resume.data };
    }
    return { outcome: "pending", data: resume.data };
  } catch {
    return { outcome: "error" };
  }
}
