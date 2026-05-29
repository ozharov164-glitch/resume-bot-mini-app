import { useEffect } from "react";
import confetti from "canvas-confetti";

import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { Screen } from "../components/ui/Screen";
import { tg } from "../telegram";

export function SuccessPage() {
  useEffect(() => {
    const root = getComputedStyle(document.documentElement);
    const accent = root.getPropertyValue("--accent").trim() || "#E8962A";
    const tgButton = root.getPropertyValue("--tg-button").trim() || "#3390EC";
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: [accent, "#2D9E6B", tgButton],
    });
    tg?.HapticFeedback?.notificationOccurred("success");
  }, []);

  const close = () => {
    tg?.close();
  };

  return (
    <Screen centered className="gap-6 text-center px-6">
      <div className="success-icon" aria-hidden>
        ✅
      </div>

      <PageHeader
        align="center"
        title={
          <>
            Готово! <span aria-hidden>🎉</span>
          </>
        }
        subtitle="Резюме уже в чате с ботом. Желаем уверенных откликов и быстрого оффера!"
      />

      {tg?.close && (
        <Button variant="secondary" onClick={close} className="max-w-xs mx-auto">
          Закрыть
        </Button>
      )}
    </Screen>
  );
}
