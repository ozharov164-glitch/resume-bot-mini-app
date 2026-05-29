import { createStarsInvoice, createYookassaInvoice, requestPdf } from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Screen } from "../components/ui/Screen";
import { useAppStore } from "../store";
import { tg } from "../telegram";

export function PaymentPage() {
  const { authToken, resumeId, setPage } = useAppStore();
  if (!authToken || !resumeId) return null;

  const payStars = async () => {
    tg?.HapticFeedback?.impactOccurred("medium");
    try {
      await createStarsInvoice(authToken, resumeId);
      await requestPdf(authToken, resumeId);
      setPage("success");
    } catch {
      alert("Не удалось создать счёт в Telegram Stars. Попробуй ещё раз.");
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
        subtitle="После оплаты PDF-резюме автоматически придёт в чат с ботом"
      />

      <div className="flex flex-col gap-3">
        <Card className="flex flex-col gap-3">
          <div>
            <div className="font-bold text-base">Telegram Stars</div>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Быстро, без карты — прямо в приложении
            </p>
          </div>
          <Button variant="primary" onClick={payStars}>
            Оплатить через Stars
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <div>
            <div className="font-bold text-base">Банковская карта</div>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              ЮKassa — если Stars недоступны
            </p>
          </div>
          <Button variant="secondary" onClick={payYookassa}>
            Оплатить картой
          </Button>
        </Card>
      </div>
    </Screen>
  );
}
