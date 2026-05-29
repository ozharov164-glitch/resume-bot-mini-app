import { useState } from "react";

import { createStarsInvoice, createYookassaInvoice, waitUntilPaid } from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Screen } from "../components/ui/Screen";
import { useAppStore } from "../store";
import { tg } from "../telegram";

type InvoiceStatus = "paid" | "cancelled" | "failed" | "pending";

export function PaymentPage() {
  const { authToken, resumeId, setPage, setPaid } = useAppStore();
  const [paying, setPaying] = useState(false);

  if (!authToken || !resumeId) return null;

  const payStars = async () => {
    if (!tg?.openInvoice) {
      alert("Оплата Stars доступна только внутри Telegram. Открой приложение через бота.");
      return;
    }

    tg.HapticFeedback?.impactOccurred("medium");
    setPaying(true);
    try {
      const { invoice_link: invoiceLink } = await createStarsInvoice(authToken, resumeId);

      await new Promise<void>((resolve, reject) => {
        tg.openInvoice!(invoiceLink, async (status: InvoiceStatus) => {
          if (status === "paid") {
            const confirmed = await waitUntilPaid(authToken, resumeId);
            if (confirmed) {
              setPaid(true);
              tg.HapticFeedback?.notificationOccurred("success");
              setPage("success");
              resolve();
            } else {
              reject(new Error("timeout"));
            }
            return;
          }
          if (status === "cancelled") {
            reject(new Error("cancelled"));
            return;
          }
          if (status === "failed") {
            reject(new Error("failed"));
            return;
          }
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "cancelled") {
        return;
      }
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
    tg?.HapticFeedback?.impactOccurred("light");
    try {
      const response = await createYookassaInvoice(authToken, resumeId);
      window.location.href = response.confirmation_url;
    } catch {
      alert("ЮKassa сейчас недоступна. Попробуй оплату через Stars.");
    }
  };

  return (
    <Screen className="gap-5">
      <PageHeader
        eyebrow="Финальный шаг"
        title="Выбери способ оплаты"
        subtitle="Оплата Stars откроется прямо здесь — PDF придёт в чат с ботом"
      />

      <div className="flex flex-col gap-3">
        <Card className="flex flex-col gap-3">
          <div>
            <div className="font-bold text-base">Telegram Stars</div>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Оплата внутри приложения, без перехода в чат
            </p>
          </div>
          <Button variant="primary" onClick={payStars} disabled={paying}>
            {paying ? "Ожидаем оплату…" : "Оплатить через Stars"}
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <div>
            <div className="font-bold text-base">Банковская карта</div>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              ЮKassa — если Stars недоступны
            </p>
          </div>
          <Button variant="secondary" onClick={payYookassa} disabled={paying}>
            Оплатить картой
          </Button>
        </Card>
      </div>
    </Screen>
  );
}
