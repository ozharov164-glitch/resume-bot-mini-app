export type DeepLinkRoute = "history" | "examples" | null;

/** Parse Telegram WebApp hash routes (#history, #examples). */
export function parseDeepLink(hash: string): DeepLinkRoute {
  const key = hash.replace(/^#/, "").trim().toLowerCase();
  if (key === "history") return "history";
  if (key === "examples") return "examples";
  return null;
}

export function clearDeepLinkHash(): void {
  if (!window.location.hash) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}
