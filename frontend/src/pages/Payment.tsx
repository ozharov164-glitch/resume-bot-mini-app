import { useCallback, useState } from "react";

import { createStarsInvoice, createYookassaInvoice, waitUntilPaid } from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { RUB_PRICE, STARS_PRICE } from "../lib/pricing";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

type InvoiceStatus = "paid" | "cancelled" | "failed" | "pending";

export function PaymentPage() {
  const { authToken, resumeId, resumeData, answers, setPage, setPaid } = useAppStore();
  const [paying, setPaying] = useState(false);

  const handleBack = useCallback(() => setPage("preview"), [setPage]);
  useTelegramBackButton(handleBack);

  if (!authToken || !resumeId) return null;

  const fullName = resumeData?.full_name || answers.name || "клиента";
  const position = resumeData?.target_position || answers.target_position || "";
  const orderLabel = position
    ? `Резюме для ${fullName} (${position})`
    : `Резюме для ${fullName}`;

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
    try {
      const response = await createYookassaInvoice(authToken, resumeId);
      window.location.href = response.confirmation_url;
    } catch {
      alert("ЮKassa сейчас недоступна. Попробуй оплату через Stars.");
    }
  };

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
            <span className="text-lg font-bold">{STARS_PRICE} ⭐</span>
          </div>
        </section>

        <div className="flex flex-col gap-3">
          <Button
            variant="brand"
            onClick={payStars}
            disabled={paying}
            className="!min-h-[52px] flex items-center justify-center gap-2"
          >
            <Icon name="star" filled size={20} />
            {paying ? "Ожидаем оплату…" : `Оплатить Telegram Stars (${STARS_PRICE})`}
          </Button>

          <Button
            variant="outline"
            onClick={payYookassa}
            disabled={paying}
            className="!min-h-[52px] flex items-center justify-center gap-2"
          >
            <Icon name="credit_card" size={20} />
            Оплатить картой — {RUB_PRICE} ₽
          </Button>
        </div>

        <p className="mt-auto text-center text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Что будет после оплаты? PDF придёт в чат бота через несколько секунд.
        </p>
      </main>
    </Screen>
  );
}
