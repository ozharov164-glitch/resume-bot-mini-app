/** Разовая оплата — одинаковая сумма в ⭐ и ₽ */
export const RUB_PRICE = 149;
export const STARS_PRICE = RUB_PRICE;

export function applyDiscount(price: number, discountPercent: number): number {
  if (discountPercent <= 0) return price;
  return Math.max(1, Math.round(price * (1 - discountPercent / 100)));
}
