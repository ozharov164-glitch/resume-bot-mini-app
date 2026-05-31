export const STARS_PRICE = 99;
export const RUB_PRICE = 149;

/** Подписка — одинаковая сумма в ⭐ и ₽ */
export const RUB_PRICE_SUBSCRIPTION = 199;
export const STARS_SUBSCRIPTION_PRICE = RUB_PRICE_SUBSCRIPTION;

export function applyDiscount(price: number, discountPercent: number): number {
  if (discountPercent <= 0) return price;
  return Math.max(1, Math.round(price * (1 - discountPercent / 100)));
}
