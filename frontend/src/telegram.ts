import { applyLockedLightTheme, LIGHT_THEME } from "./lib/theme";

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    user?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    start_param?: string;
  };
  viewportStableHeight?: number;
  viewportHeight?: number;
  safeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number };
  contentSafeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number };
  themeParams: Record<string, string>;
  MainButton?: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy") => void;
    selectionChanged: () => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  disableVerticalSwipes?: () => void;
  ready: () => void;
  expand: () => void;
  close?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent?: (event: string, callback: () => void) => void;
  offEvent?: (event: string, callback: () => void) => void;
  openInvoice?: (
    url: string,
    callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void,
  ) => void;
  /** Open URL in external browser (required for YooKassa card checkout in Mini App). */
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** Always read fresh — WebApp may attach after module load. */
export function getTg(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

/** @deprecated use getTg() */
export const tg = getTg();

export function getTelegramUserId(): number | undefined {
  const id = getTg()?.initDataUnsafe?.user?.id;
  return typeof id === "number" ? id : undefined;
}

/** Wait until telegram-web-app.js exposes WebApp (slow WebViews on older phones). */
export async function waitForTelegramSdk(timeoutMs = 3500): Promise<TelegramWebApp | undefined> {
  const started = Date.now();
  let delay = 40;
  while (Date.now() - started < timeoutMs) {
    const webApp = getTg();
    if (webApp) {
      webApp.ready();
      return webApp;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 20, 120);
  }
  return getTg();
}

export async function waitForInitData(timeoutMs = 10_000): Promise<string> {
  await waitForTelegramSdk(Math.min(timeoutMs, 4000));
  const started = Date.now();
  let delay = 50;
  while (Date.now() - started < timeoutMs) {
    const webApp = getTg();
    const data = webApp?.initData;
    if (data) return data;
    webApp?.ready();
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 15, 150);
  }
  return getTg()?.initData || "";
}

function syncTelegramChrome() {
  const webApp = getTg();
  if (!webApp) return;
  webApp.setHeaderColor?.(LIGHT_THEME.headerBg);
  webApp.setBackgroundColor?.(LIGHT_THEME.bg);
}

const onThemeChanged = () => applyLockedLightTheme();

function syncViewportStableHeight() {
  const webApp = getTg();
  const height = webApp?.viewportStableHeight ?? window.innerHeight;
  document.documentElement.style.setProperty("--tg-viewport-stable-height", `${height}px`);
}

/** Pin once — env(safe-area-inset-top) can flicker when the keyboard opens on iOS. */
function syncSafeAreaTop() {
  const webApp = getTg();
  const top =
    webApp?.contentSafeAreaInset?.top ??
    webApp?.safeAreaInset?.top;
  if (typeof top === "number" && top >= 0) {
    document.documentElement.style.setProperty("--tg-safe-top", `${top}px`);
  }
}

const onViewportChanged = () => syncViewportStableHeight();

export function initTelegramTheme() {
  applyLockedLightTheme();

  const webApp = getTg();
  if (!webApp) {
    syncViewportStableHeight();
    syncSafeAreaTop();
    return;
  }

  webApp.ready();
  webApp.expand();
  webApp.disableVerticalSwipes?.();
  syncViewportStableHeight();
  syncSafeAreaTop();
  syncTelegramChrome();

  webApp.offEvent?.("themeChanged", onThemeChanged);
  webApp.onEvent?.("themeChanged", onThemeChanged);
  webApp.offEvent?.("viewportChanged", onViewportChanged);
  webApp.onEvent?.("viewportChanged", onViewportChanged);

  applyLockedLightTheme();
  syncTelegramChrome();
}

/** True inside Telegram Mini App — use native BackButton instead of header arrow. */
export function isTelegramMiniApp(): boolean {
  return Boolean(getTg()?.initData);
}

/** Card / external checkout — location.href is blocked inside Telegram WebView. */
export function openExternalUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const webApp = getTg();
  if (webApp?.openLink) {
    try {
      webApp.openLink(trimmed, { try_instant_view: false });
      return true;
    } catch {
      /* fall through */
    }
  }
  try {
    const opened = window.open(trimmed, "_blank", "noopener,noreferrer");
    return opened != null;
  } catch {
    return false;
  }
}
