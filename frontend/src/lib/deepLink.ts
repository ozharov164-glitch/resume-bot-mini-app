export type DeepLinkRoute = "history" | "examples" | null;

/** Resume id from bot CTA (#cover-letter-{uuid}). */
export function parseCoverLetterResumeId(hash: string): string | null {
  const raw = hash.replace(/^#/, "").trim();
  const prefix = "cover-letter-";
  if (!raw.toLowerCase().startsWith(prefix)) return null;
  const id = raw.slice(prefix.length).trim();
  return id || null;
}

/** Resume id after YooKassa redirect (#payment-return?resume_id=…). */
export function parsePaymentReturnResumeId(hash: string): string | null {
  const raw = hash.replace(/^#/, "").trim();
  if (!raw.toLowerCase().startsWith("payment-return")) return null;
  const query = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "";
  const id = new URLSearchParams(query).get("resume_id");
  return id?.trim() || null;
}

/** Parse Telegram WebApp hash routes (#history, #examples, #cover-letter-{id}). */
export function parseDeepLink(hash: string): DeepLinkRoute {
  const key = hash.replace(/^#/, "").trim().toLowerCase();
  if (key.startsWith("payment-return")) return null;
  if (key.startsWith("cover-letter-")) return null;
  if (key === "history") return "history";
  if (key === "examples") return "examples";
  return null;
}

export function clearDeepLinkHash(): void {
  if (!window.location.hash) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}
