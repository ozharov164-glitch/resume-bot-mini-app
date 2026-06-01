import { useCallback, useEffect, useState } from "react";

import {
  createStarsInvoice,
  createYookassaInvoice,
  ensureAuthToken,
  fetchActivePromo,
  fetchMe,
  fetchTodayCount,
  validatePromo,
  waitUntilPaid,
} from "../api";
import { PaymentReviews } from "../components/payment/PaymentReviews";
import { trackEvent } from "../lib/analytics";
import { useYookassaReturnPoll } from "../hooks/useYookassaReturnPoll";
import { markYookassaPending } from "../lib/paymentReturn";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { TextInput } from "../components/ui/TextField";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { buildFullName } from "../lib/formatPersonName";
import {
  applyDiscount,
  RUB_PRICE,
  STARS_PRICE,
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
  const [promoReady, setPromoReady] = useState(false);
  const [bonusStars, setBonusStars] = useState(0);
  const [bonusApplied, setBonusApplied] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  const handleBack = useCallback(() => setPage("template_select"), [setPage]);
  useTelegramBackButton(handleBack);
  useYookassaReturnPoll(true);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    (async () => {
      try {
        const active = await fetchActivePromo(authToken);
        if (cancelled || !active.active || !active.code || !active.discount_percent) return;
        setPromoCode(active.code);
        setPromoDiscount(active.discount_percent);
        setShowPromo(true);
      } catch {
        /* no active promo */
      } finally {
        if (!cancelled) setPromoReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    void ensureAuthToken()
      .then(fetchMe)
      .then((me) => setBonusStars(me.bonus_stars ?? 0))
      .catch(() => setBonusStars(0));
  }, [authToken]);

  useEffect(() => {
    void fetchTodayCount().then(setTodayCount);
  }, []);

  if (!authToken || !resumeId) return null;

  const fullName =
    resumeData?.full_name ||
    buildFullName(String(answers.name ?? ""), String(answers.patronymic ?? "")) ||
    "клиента";
  const position = resumeData?.target_position || answers.target_position || "";

  const baseStarsPrice = applyDiscount(STARS_PRICE, promoDiscount);
  const baseRubPrice = applyDiscount(RUB_PRICE, promoDiscount);
  const bonusDiscount = bonusApplied
    ? Math.min(bonusStars, Math.max(baseStarsPrice, baseRubPrice) - 1)
    : 0;
  const starsPrice = Math.max(1, baseStarsPrice - bonusDiscount);
  const rubPrice = Math.max(1, baseRubPrice - bonusDiscount);

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
      alert("Оплата Stars доступна только внутри Telegram. Откройте приложение через бота.");
      return;
    }

    tg.HapticFeedback?.impactOccurred("medium");
    trackEvent("pay_clicked", { method: "stars" });
    setPaying(true);
    try {
      const { invoice_link: invoiceLink } = await createStarsInvoice(
        authToken,
        resumeId,
        bonusApplied,
      );

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
          "Оплата прошла, но PDF ещё готовится. Проверьте чат с ботом — файл должен появиться через минуту.",
        );
        setPage("success");
        return;
      }
      alert("Не удалось оплатить через Stars. Попробуйте ещё раз.");
    } finally {
      setPaying(false);
    }
  };

  const payYookassa = async () => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    trackEvent("pay_clicked", { method: "yukassa" });
    setCardPaying(true);
    try {
      const response = (await createYookassaInvoice(
        authToken,
        resumeId,
        bonusApplied,
      )) as YookassaCreateResponse;
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
        : `Не удалось открыть оплату картой: ${message}. Попробуйте Stars.`);
    } finally {
      setCardPaying(false);
    }
  };

  const busy = paying || cardPaying;

  return (
    <Screen className="payment-page px-4">
      <AppHeader onBack={handleBack} showBack />
      <main className="payment-main">
        <header className="payment-hero">
          <div className="payment-hero-icon" aria-hidden>
            <Icon name="payments" filled size={30} style={{ color: "var(--brand)" }} />
          </div>
          <h2 className="payment-hero-title">Выберите способ оплаты</h2>
          {todayCount > 3 ? (
            <p className="payment-today-count">
              Сегодня {todayCount} человек уже создали резюме
            </p>
          ) : null}
        </header>

        <section className="payment-card payment-order-card">
          <p className="payment-card-label">Заказ</p>
          <h3 className="payment-order-name">{fullName}</h3>
          {position ? <p className="payment-order-role">{position}</p> : null}

          <div className="payment-price-grid">
            <div className="payment-price-row">
              <span className="payment-price-label">Telegram Stars</span>
              <span className="payment-price-value">
                {starsPrice} ⭐
                {(promoDiscount > 0 || bonusApplied) && starsPrice !== STARS_PRICE ? (
                  <span className="payment-price-old">{STARS_PRICE}</span>
                ) : null}
              </span>
            </div>
            <div className="payment-price-row">
              <span className="payment-price-label">Банковская карта</span>
              <span className="payment-price-value">
                {rubPrice} ₽
                {(promoDiscount > 0 || bonusApplied) && rubPrice !== RUB_PRICE ? (
                  <span className="payment-price-old">{RUB_PRICE}</span>
                ) : null}
              </span>
            </div>
          </div>

          {bonusApplied && bonusDiscount > 0 ? (
            <p className="payment-discount-note">
              Списано {bonusDiscount} бонусных Stars — скидка для Stars и карты
            </p>
          ) : null}
          {promoDiscount > 0 ? (
            <p className="payment-discount-note">
              Скидка {promoDiscount}% применена{promoCode ? ` · ${promoCode}` : ""}
            </p>
          ) : null}

          <PaymentReviews preferredProfession={position} />
        </section>

        {bonusStars > 0 && !bonusApplied ? (
          <section className="payment-card payment-bonus-card">
            <p className="payment-bonus-text">
              У вас {bonusStars} бонусных Stars — 1 ⭐ = 1 ₽ скидки
            </p>
            <Button
              variant="outline"
              fullWidth={false}
              className="payment-bonus-btn"
              onClick={() => {
                setBonusApplied(true);
                trackEvent("bonus_applied", { bonus_stars: bonusStars });
                getTg()?.HapticFeedback?.selectionChanged();
              }}
            >
              Применить скидку
            </Button>
          </section>
        ) : null}

        <section className="payment-card payment-promo-card">
          {!showPromo && promoReady ? (
            <button type="button" className="payment-promo-toggle" onClick={() => setShowPromo(true)}>
              У меня есть промокод
            </button>
          ) : (
            <>
              <p className="payment-card-label">Промокод</p>
              <div className="payment-promo-row">
                <TextInput
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value);
                    setPromoError(null);
                  }}
                  placeholder="Введите код"
                  className="payment-promo-input"
                  aria-label="Промокод"
                />
                <Button
                  variant="outline"
                  fullWidth={false}
                  className="payment-promo-apply"
                  onClick={applyPromo}
                  disabled={promoLoading || !promoCode.trim()}
                >
                  {promoLoading ? "…" : "Применить"}
                </Button>
              </div>
              {promoError ? <p className="payment-promo-error">{promoError}</p> : null}
            </>
          )}
        </section>

        <div className="payment-actions">
          <Button
            variant="brand"
            onClick={payStars}
            disabled={busy}
            className="payment-pay-btn"
          >
            <Icon name="star" filled size={20} />
            {paying ? "Ожидаем оплату…" : `Оплатить Telegram Stars (${starsPrice})`}
          </Button>

          <Button
            variant="outline"
            onClick={payYookassa}
            disabled={busy}
            className="payment-pay-btn payment-pay-btn--card"
          >
            <Icon name="credit_card" size={20} />
            {cardPaying ? "Открываем оплату…" : `Оплатить картой — ${rubPrice} ₽`}
          </Button>
        </div>

        <p className="payment-footer-note">
          После оплаты вернитесь в Telegram и снова откройте Mini App. PDF и полный текст для hh.ru
          придут в чат с ботом автоматически.
        </p>
      </main>
    </Screen>
  );
}
