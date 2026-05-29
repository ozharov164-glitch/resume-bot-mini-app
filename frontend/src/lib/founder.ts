/** Must match backend FOUNDER_TELEGRAM_IDS (UI hint; enforcement is server-side). */
export const FOUNDER_TELEGRAM_IDS: readonly number[] = [1003598434943];

export function isFounderTelegramId(id: number | string | undefined | null): boolean {
  if (id === undefined || id === null || id === "") return false;
  const n = typeof id === "number" ? id : Number(String(id).trim());
  if (!Number.isFinite(n)) return false;
  return FOUNDER_TELEGRAM_IDS.includes(n);
}
