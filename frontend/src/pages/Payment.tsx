import { useState } from "react";

import { createStarsInvoice, createYookassaInvoice, waitUntilPaid } from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { RUB_PRICE, STARS_PRICE } from "../lib/pricing";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

type InvoiceStatus = "paid" | "cancelled" | "failed" | "pending";

function SbpBadge() {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: "#1d1346", color: "#fff" }}
    >
      СБП
    </span>
  );
}

export function PaymentPage() {
  const { authToken, resumeId, resumeData, answers, setPage, setPaid } = useAppStore();
  const [paying, setPaying] = useState(false);

  if (!authToken || !resumeId) return null;

  const fullName = resumeData?.full_name || answers.name || "Ваше резюме";
  const position = resumeData?.target_position || answers.target_position || "";

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
      <AppHeader onBack={() => setPage("preview")} showBack />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-4">
        <section className="flex flex-col items-center gap-2 pt-2 text-center">
          <div
            className="mb-2 flex h-16 w-16 items-center justify-center rounded-full shadow-card"
            style={{ background: "var(--surface-elevated)" }}
          >
            <Icon name="payments" filled className="text-primary" size={32} />
          </div>
          <h2 className="text-2xl font-bold">Выбери способ оплаты</h2>
          <p className="max-w-[280px] text-base" style={{ color: "var(--text-muted)" }}>
            Твое резюме почти готово. Оплати, чтобы получить PDF-файл.
          </p>
        </section>

        <section
          className="relative flex flex-col gap-4 overflow-hidden rounded-xl border p-4 shadow-card"
          style={{ background: "#ffffff", borderColor: "var(--border-subtle)" }}
        >
          <div className="absolute top-0 left-0 h-1 w-full" style={{ background: "var(--brand)" }} />
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "var(--surface-elevated)" }}
            >
              <Icon name="description" className="text-primary" size={24} />
            </div>
            <div className="flex flex-col gap-1">
              <span
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: "var(--text-muted)" }}
              >
                Оплата за
              </span>
              <h3 className="text-lg font-semibold leading-tight">Резюме для: {fullName}</h3>
              {position && (
                <div className="mt-1 flex items-center gap-1 text-sm" style={{ color: "var(--text-muted)" }}>
                  <Icon name="work" size={16} />
                  <span>{position}</span>
                </div>
              )}
            </div>
          </div>
          <div className="h-px w-full" style={{ background: "var(--border-subtle)" }} />
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text-muted)" }}>К оплате:</span>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-lg font-bold">{STARS_PRICE} ⭐</span>
              <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                или {RUB_PRICE} ₽
              </span>
            </div>
          </div>
        </section>

        <section
          className="rounded-xl border p-4"
          style={{ background: "var(--surface-elevated)", borderColor: "var(--border-subtle)" }}
        >
          <div className="flex gap-3">
            <Icon name="help" className="mt-0.5 shrink-0 text-primary" size={20} />
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-semibold">Что будет после оплаты?</h4>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                PDF придет в чат бота через несколько секунд.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-auto flex flex-col gap-4 pt-2">
          <Button
            variant="brand"
            onClick={payStars}
            disabled={paying}
            className="!min-h-[56px] flex items-center justify-center gap-2"
          >
            <Icon name="star" filled size={20} />
            {paying ? "Ожидаем оплату…" : `Оплатить Telegram Stars (${STARS_PRICE} Stars)`}
          </Button>

          <Button
            variant="outline"
            onClick={payYookassa}
            disabled={paying}
            className="!min-h-[56px] flex items-center justify-center gap-2"
          >
            <Icon name="credit_card" size={20} />
            <span>Оплатить картой или</span>
            <SbpBadge />
            <span>— {RUB_PRICE} ₽</span>
          </Button>
        </div>
      </main>
    </Screen>
  );
}
