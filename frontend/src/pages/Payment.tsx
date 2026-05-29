import { createStarsInvoice, createYookassaInvoice, requestPdf } from "../api";
import { useAppStore } from "../store";

export function PaymentPage() {
  const { authToken, resumeId, setPage } = useAppStore();
  if (!authToken || !resumeId) return null;

  const payStars = async () => {
    try {
      await createStarsInvoice(authToken, resumeId);
      await requestPdf(authToken, resumeId);
      setPage("success");
    } catch {
      alert("Не удалось создать счет в Telegram Stars. Попробуйте еще раз.");
    }
  };

  const payYookassa = async () => {
    try {
      const response = await createYookassaInvoice(authToken, resumeId);
      window.location.href = response.confirmation_url;
    } catch {
      alert("ЮKassa сейчас недоступна. Попробуйте оплату через Stars.");
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 flex flex-col gap-4" style={{ background: "var(--tg-bg)", color: "var(--tg-text)" }}>
      <h1 className="text-xl font-semibold">Выбери удобный способ оплаты</h1>
      <p className="text-sm opacity-75">
        После оплаты PDF-резюме автоматически отправится в ваш Telegram-чат с ботом.
      </p>
      <button className="w-full rounded-2xl py-4 font-semibold" onClick={payStars} style={{ background: "var(--tg-button)", color: "var(--tg-button-text)" }}>
        Оплатить через Telegram Stars
      </button>
      <button className="w-full rounded-2xl py-4 font-semibold border" onClick={payYookassa} style={{ borderColor: "rgba(0,0,0,0.1)" }}>
        Оплатить через ЮKassa
      </button>
    </div>
  );
}
