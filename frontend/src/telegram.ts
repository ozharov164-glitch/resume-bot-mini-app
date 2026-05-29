export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    user?: {
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
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

import { applySemanticTheme } from "./lib/theme";

export const tg = window.Telegram?.WebApp;

export function initTelegramTheme() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  const p = tg.themeParams || {};
  const bg = p.bg_color || "#ffffff";
  document.documentElement.style.setProperty("--tg-bg", bg);
  document.documentElement.style.setProperty("--tg-text", p.text_color || "#0f172a");
  document.documentElement.style.setProperty("--tg-button", p.button_color || "#3390ec");
  document.documentElement.style.setProperty("--tg-button-text", p.button_text_color || "#ffffff");
  document.documentElement.style.setProperty("--tg-secondary-bg", p.secondary_bg_color || "#f4f4f5");
  applySemanticTheme(bg);
}
