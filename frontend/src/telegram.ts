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
  };
  viewportStableHeight?: number;
  viewportHeight?: number;
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

export async function waitForInitData(timeoutMs = 4000): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const data = getTg()?.initData;
    if (data) return data;
    getTg()?.ready();
    await new Promise((r) => setTimeout(r, 80));
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

const onViewportChanged = () => syncViewportStableHeight();

export function initTelegramTheme() {
  applyLockedLightTheme();

  const webApp = getTg();
  if (!webApp) {
    syncViewportStableHeight();
    return;
  }

  webApp.ready();
  webApp.expand();
  webApp.disableVerticalSwipes?.();
  syncViewportStableHeight();
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
