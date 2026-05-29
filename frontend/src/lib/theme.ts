/** Relative luminance (0–1) for contrast-aware theme tokens. */
export function getLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return 1;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function isDarkBackground(hex: string): boolean {
  return getLuminance(hex) < 0.45;
}

export function applySemanticTheme(bgColor: string) {
  const dark = isDarkBackground(bgColor);
  const root = document.documentElement;

  root.style.setProperty(
    "--surface-elevated",
    dark ? "color-mix(in srgb, var(--tg-text) 6%, var(--tg-bg))" : "var(--tg-secondary-bg)",
  );
  root.style.setProperty(
    "--border-subtle",
    dark ? "color-mix(in srgb, var(--tg-text) 14%, transparent)" : "color-mix(in srgb, var(--tg-text) 10%, transparent)",
  );
  root.style.setProperty("--text-muted", dark ? "color-mix(in srgb, var(--tg-text) 62%, transparent)" : "color-mix(in srgb, var(--tg-text) 55%, transparent)");
  root.style.setProperty(
    "--benefit-bg",
    dark
      ? "color-mix(in srgb, var(--accent) 22%, var(--tg-secondary-bg))"
      : "color-mix(in srgb, var(--accent) 12%, var(--tg-secondary-bg))",
  );
  root.style.setProperty("--benefit-border", "color-mix(in srgb, var(--accent) 38%, transparent)");
  root.style.setProperty("--benefit-text", "var(--tg-text)");
  root.style.setProperty(
    "--hint-bg",
    dark ? "color-mix(in srgb, var(--accent) 16%, var(--tg-secondary-bg))" : "var(--accent-light)",
  );
  root.style.setProperty("--hint-text", dark ? "var(--tg-text)" : "var(--accent-dark)");
  root.style.setProperty("--on-accent", "#ffffff");
  root.dataset.themeMode = dark ? "dark" : "light";
}
