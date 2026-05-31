import { useCallback, useState } from "react";

import { createStarsInvoice, createYookassaInvoice, validatePromo, waitUntilPaid } from "../api";
import { useYookassaReturnPoll } from "../hooks/useYookassaReturnPoll";
import { markYookassaPending } from "../lib/paymentReturn";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { TextInput } from "../components/ui/TextField";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import {
  applyDiscount,
  RUB_PRICE,
  STARS_PRICE,
  STARS_SUBSCRIPTION_PRICE,
} from "../lib/pricing";
import { useAppStore } from "../store";
import { getTg, openExternalUrl } from "../telegram";

type InvoiceStatus = "paid" | "cancelled" | "failed" | "pending";

type YookassaCreateResponse = {
  status: string;
  provider: string;
  confirmation_url?: string;
  payment_id?: string;
};

export function PaymentPage() {
  const { authToken, resumeId, resumeData, answers, setPage, setPaid } = useAppStore();
  const [paying, setPaying] = useState(false);
  const [cardPaying, setCardPaying] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const handleBack = useCallback(() => setPage("template_select"), [setPage]);
  useTelegramBackButton(handleBack);
  useYookassaReturnPoll(true);

  if (!authToken || !resumeId) return null;

  const fullName = resumeData?.full_name || answers.name || "клиента";
  const position = resumeData?.target_position || answers.target_position || "";
  const orderLabel = position
    ? `Резюме для ${fullName} (${position})`
    : `Резюме для ${fullName}`;

  const starsPrice = applyDiscount(STARS_PRICE, promoDiscount);
  const rubPrice = applyDiscount(RUB_PRICE, promoDiscount);

  const applyPromo = async () => {
    const code = promoCode.trim();
    if (!code) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const result = await validatePromo(code, authToken);
      setPromoDiscount(result.discount_percent);
      setPromoCode(result.code);
      getTg()?.HapticFeedback?.notificationOccurred("success");
    } catch (err) {
      setPromoDiscount(0);
      setPromoError(err instanceof Error ? err.message : "Промокод недействителен");
    } finally {
      setPromoLoading(false);
    }
  };

  const payStars = async () => {
    const tg = getTg();
    if (!tg?.openInvoice) {
      alert("Оплата Stars доступна только внутри Telegram. Открой приложение через бота.");
      return;
    }

    tg.HapticFeedback?.impactOccurred("medium");
    setPaying(true);
    try {
      const { invoice_link: invoiceLink } = await createStarsInvoice(authToken, resumeId);

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (fn: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          fn();
        };
        const timer = window.setTimeout(() => finish(() => reject(new Error("timeout"))), 120_000);

        tg.openInvoice!(invoiceLink, async (status: InvoiceStatus) => {
          if (status === "pending") return;
          if (status === "paid") {
            const confirmed = await waitUntilPaid(authToken, resumeId);
            if (confirmed) {
              setPaid(true);
              tg.HapticFeedback?.notificationOccurred("success");
              finish(() => resolve());
            } else {
              finish(() => reject(new Error("timeout")));
            }
            return;
          }
          if (status === "cancelled") {
            finish(() => reject(new Error("cancelled")));
            return;
          }
          if (status === "failed") {
            finish(() => reject(new Error("failed")));
          }
        });
      });
      setPage("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "cancelled") return;
      if (message === "timeout") {
        alert(
          "Оплата прошла, но PDF ещё готовится. Проверь чат с ботом — файл должен появиться через минуту.",
        );
        setPage("success");
        return;
      }
      alert("Не удалось оплатить через Stars. Попробуй ещё раз.");
    } finally {
      setPaying(false);
    }
  };

  const payYookassa = async () => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    setCardPaying(true);
    try {
      const response = (await createYookassaInvoice(authToken, resumeId)) as YookassaCreateResponse;
      const checkoutUrl = response.confirmation_url?.trim();
      if (!checkoutUrl) {
        throw new Error("Ссылка на оплату не получена");
      }
      markYookassaPending(resumeId);
      openExternalUrl(checkoutUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "ЮKassa недоступна";
      alert(message.includes("ЮKassa") || message.includes("оплат")
        ? message
        : `Не удалось открыть оплату картой: ${message}. Попробуй Stars.`);
    } finally {
      setCardPaying(false);
    }
  };

  const busy = paying || cardPaying;

  return (
    <Screen className="px-4">
      <AppHeader onBack={handleBack} showBack />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 py-4">
        <section className="flex flex-col items-center gap-2 pt-2 text-center">
          <div
            className="mb-1 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "var(--brand-muted)" }}
          >
            <Icon name="payments" filled size={32} style={{ color: "var(--brand)" }} />
          </div>
          <h2 className="text-2xl font-bold">Выбери способ оплаты</h2>
        </section>

        <section
          className="rounded-xl border p-4"
          style={{ background: "var(--surface-card)", borderColor: "var(--border-subtle)" }}
        >
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Заказ
          </p>
          <h3 className="mt-1 text-base font-semibold leading-snug">{orderLabel}</h3>
          <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              К оплате
            </span>
            <span className="text-lg font-bold">
              {starsPrice} ⭐
              {promoDiscount > 0 && starsPrice !== STARS_PRICE ? (
                <span className="ml-2 text-sm line-through opacity-50">{STARS_PRICE}</span>
              ) : null}
            </span>
          </div>
          {promoDiscount > 0 ? (
            <p className="mt-2 text-sm font-medium" style={{ color: "var(--brand)" }}>
              Скидка {promoDiscount}% применена!
            </p>
          ) : null}
        </section>

        {!showPromo ? (
          <button
            type="button"
            className="text-sm underline"
            style={{ color: "var(--brand)" }}
            onClick={() => setShowPromo(true)}
          >
            У меня есть промокод
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <TextInput
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value);
                  setPromoError(null);
                }}
                placeholder="Промокод"
                className="flex-1"
              />
              <Button variant="outline" onClick={applyPromo} disabled={promoLoading || !promoCode.trim()}>
                {promoLoading ? "…" : "Применить"}
              </Button>
            </div>
            {promoError ? (
              <p className="text-sm" style={{ color: "#dc2626" }}>
                {promoError}
              </p>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            variant="brand"
            onClick={payStars}
            disabled={busy}
            className="!min-h-[52px] flex items-center justify-center gap-2"
          >
            <Icon name="star" filled size={20} />
            {paying ? "Ожидаем оплату…" : `Оплатить Telegram Stars (${starsPrice})`}
          </Button>

          <Button
            variant="outline"
            onClick={payYookassa}
            disabled={busy}
            className="!min-h-[52px] flex items-center justify-center gap-2"
          >
            <Icon name="credit_card" size={20} />
            {cardPaying ? "Открываем оплату…" : `Оплатить картой — ${rubPrice} ₽`}
          </Button>

          <Button variant="outline" disabled className="!min-h-[48px] opacity-70">
            🔄 Подписка — {STARS_SUBSCRIPTION_PRICE} ⭐/мес (неограниченно) · Скоро
          </Button>
        </div>

        <p className="mt-auto text-center text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Оплата откроется в браузере. После оплаты нажми «Вернуться в магазин» — откроется Telegram. Затем
          кнопку «Открыть приложение» у бота или просто вернись в это окно — PDF придёт в чат.
        </p>
      </main>
    </Screen>
  );
}
