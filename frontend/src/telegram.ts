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

export function initTelegramTheme() {
  const webApp = getTg();
  if (!webApp) return;
  webApp.ready();
  webApp.expand();
  const p = webApp.themeParams || {};
  const bg = p.bg_color || "#ffffff";
  document.documentElement.style.setProperty("--tg-bg", bg);
  document.documentElement.style.setProperty("--tg-text", p.text_color || "#0f172a");
  document.documentElement.style.setProperty("--tg-button", p.button_color || "#3390ec");
  document.documentElement.style.setProperty("--tg-button-text", p.button_text_color || "#ffffff");
  document.documentElement.style.setProperty("--tg-secondary-bg", p.secondary_bg_color || "#f4f4f5");
  applySemanticTheme(bg);
}
