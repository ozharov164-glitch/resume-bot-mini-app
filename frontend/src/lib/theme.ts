/** Locked light theme — never follows Telegram dark/light switch. */
export const LIGHT_THEME = {
  bg: "#ffffff",
  text: "#161d19",
  textMuted: "#707579",
  textVariant: "#3c4a42",
  secondaryBg: "#f4f4f5",
  surfaceElevated: "#f8f9fa",
  surfaceCard: "#f5f5f5",
  surfaceVariant: "#ececec",
  border: "rgba(60, 74, 66, 0.12)",
  brand: "#006c49",
  brandBright: "#10b981",
  brandMuted: "rgba(16, 185, 129, 0.12)",
  onBrand: "#ffffff",
  headerBg: "#ffffff",
  previewBanner: "#ecfdf5",
  previewBannerText: "#065f46",
  cardShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
} as const;

export function applyLockedLightTheme() {
  const root = document.documentElement;
  const t = LIGHT_THEME;

  root.style.colorScheme = "light";
  root.dataset.themeMode = "light";

  root.style.setProperty("--tg-bg", t.bg);
  root.style.setProperty("--tg-text", t.text);
  root.style.setProperty("--tg-button", t.brandBright);
  root.style.setProperty("--tg-button-text", t.onBrand);
  root.style.setProperty("--tg-secondary-bg", t.secondaryBg);
  root.style.setProperty("--brand", t.brand);
  root.style.setProperty("--brand-bright", t.brandBright);
  root.style.setProperty("--brand-muted", t.brandMuted);
  root.style.setProperty("--accent", t.brandBright);
  root.style.setProperty("--accent-light", t.brandMuted);
  root.style.setProperty("--accent-dark", t.brand);
  root.style.setProperty("--surface-elevated", t.surfaceElevated);
  root.style.setProperty("--surface-card", t.surfaceCard);
  root.style.setProperty("--surface-variant", t.surfaceVariant);
  root.style.setProperty("--border-subtle", t.border);
  root.style.setProperty("--text-muted", t.textMuted);
  root.style.setProperty("--text-variant", t.textVariant);
  root.style.setProperty("--benefit-bg", t.brandMuted);
  root.style.setProperty("--benefit-border", "rgba(16, 185, 129, 0.25)");
  root.style.setProperty("--benefit-text", t.text);
  root.style.setProperty("--hint-bg", t.brandMuted);
  root.style.setProperty("--hint-text", t.brand);
  root.style.setProperty("--on-accent", t.onBrand);
  root.style.setProperty("--card-shadow", t.cardShadow);
  root.style.setProperty("--preview-banner-bg", t.previewBanner);
  root.style.setProperty("--preview-banner-text", t.previewBannerText);

  document.body.style.background = t.bg;
  document.body.style.color = t.text;
}

/** @deprecated Theme is always locked to light — kept for import compatibility. */
export function applySemanticTheme(_bgColor?: string) {
  applyLockedLightTheme();
}
