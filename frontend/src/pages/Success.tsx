import { useEffect } from "react";
import confetti from "canvas-confetti";

import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { getTg } from "../telegram";

export function SuccessPage() {
  useEffect(() => {
    const accent = "#10b981";
    const brand = "#006c49";
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.55 },
      colors: [accent, brand, "#ffffff"],
    });
    getTg()?.HapticFeedback?.notificationOccurred("success");
    getTg()?.MainButton?.hide();
  }, []);

  const close = () => getTg()?.close?.();

  return (
    <Screen withBottomBar centered className="px-4">
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <div
          className="animate-pop-in flex h-24 w-24 items-center justify-center rounded-full shadow-brand"
          style={{ background: "var(--brand-muted)" }}
        >
          <Icon name="check_circle" filled className="text-primary-container" size={64} />
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Ура! Твое резюме готово</h2>
          <p className="px-2 text-base" style={{ color: "var(--text-muted)" }}>
            PDF-файл отправлен в твой чат с ботом. Удачи в поиске работы!
          </p>
        </div>
      </main>

      <FixedBottomBar>
        <Button variant="brand" onClick={close}>
          Вернуться в бот
        </Button>
      </FixedBottomBar>
    </Screen>
  );
}
