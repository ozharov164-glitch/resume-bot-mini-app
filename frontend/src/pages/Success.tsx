import { useEffect } from "react";
import confetti from "canvas-confetti";

import { tg } from "../telegram";

export function SuccessPage() {
  useEffect(() => {
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#E8962A", "#2D9E6B", "#3390EC"],
    });
    tg?.HapticFeedback?.notificationOccurred("success");
  }, []);

  return (
    <div
      className="min-h-screen px-4 py-6 flex flex-col justify-center gap-4 text-center"
      style={{ background: "var(--tg-bg)", color: "var(--tg-text)" }}
    >
      <h1 className="text-2xl font-bold">Готово! Выглядит отлично 🎉</h1>
      <p className="text-base opacity-80">
        Спасибо за оплату. Резюме уже отправлено в чат с ботом. Желаем уверенных откликов и быстрого
        оффера.
      </p>
    </div>
  );
}
