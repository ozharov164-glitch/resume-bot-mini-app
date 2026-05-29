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
  };
  ready: () => void;
  expand: () => void;
  close?: () => void;
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

import { applySemanticTheme } from "./lib/theme";

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

const BRAND = {
  bg: "#f4fbf4",
  text: "#161d19",
  button: "#10b981",
  buttonText: "#ffffff",
  secondaryBg: "#eef6ee",
  accent: "#10b981",
  accentDark: "#006c49",
} as const;

export function initTelegramTheme() {
  const webApp = getTg();
  if (!webApp) {
    document.documentElement.style.setProperty("--tg-bg", BRAND.bg);
    document.documentElement.style.setProperty("--tg-text", BRAND.text);
    document.documentElement.style.setProperty("--tg-button", BRAND.button);
    document.documentElement.style.setProperty("--tg-button-text", BRAND.buttonText);
    document.documentElement.style.setProperty("--tg-secondary-bg", BRAND.secondaryBg);
    document.documentElement.style.setProperty("--accent", BRAND.accent);
    document.documentElement.style.setProperty("--brand", BRAND.accentDark);
    document.documentElement.style.setProperty("--brand-bright", BRAND.accent);
    applySemanticTheme(BRAND.bg);
    return;
  }
  webApp.ready();
  webApp.expand();
  const p = webApp.themeParams || {};
  const bg = p.bg_color || BRAND.bg;
  document.documentElement.style.setProperty("--tg-bg", bg);
  document.documentElement.style.setProperty("--tg-text", p.text_color || BRAND.text);
  document.documentElement.style.setProperty("--tg-button", BRAND.button);
  document.documentElement.style.setProperty("--tg-button-text", p.button_text_color || BRAND.buttonText);
  document.documentElement.style.setProperty("--tg-secondary-bg", p.secondary_bg_color || BRAND.secondaryBg);
  document.documentElement.style.setProperty("--accent", BRAND.accent);
  document.documentElement.style.setProperty("--brand", BRAND.accentDark);
  document.documentElement.style.setProperty("--brand-bright", BRAND.accent);
  applySemanticTheme(bg);
}
