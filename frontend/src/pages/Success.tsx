import { useEffect, useState } from "react";
import confetti from "canvas-confetti";

import {
  createAdaptInvoice,
  ensureAuthToken,
  fetchTextExport,
  saveAdaptVacancy,
} from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { trackEvent } from "../lib/analytics";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

const BOT_USERNAME = "resumeez_bot";

export function SuccessPage() {
  const { resumeId, authToken } = useAppStore();
  const [toast, setToast] = useState<string | null>(null);
  const [vacancy, setVacancy] = useState("");
  const [adaptBusy, setAdaptBusy] = useState(false);

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
    trackEvent("payment_completed", { amount: 149 });
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  };

  const copyForHh = async () => {
    if (!resumeId || !authToken) return;
    try {
      const token = authToken || (await ensureAuthToken());
      const text = await fetchTextExport(token, resumeId);
      await navigator.clipboard.writeText(text);
      trackEvent("text_exported");
      showToast("Скопировано в буфер");
    } catch {
      alert("Не удалось скопировать текст. Попробуйте ещё раз.");
    }
  };

  const shareInvite = () => {
    const tg = getTg();
    const userId = tg?.initDataUnsafe?.user?.id;
    if (!userId) return;
    const link = `https://t.me/${BOT_USERNAME}?start=ref_${userId}`;
    trackEvent("share_clicked");
    tg?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent(link)}`);
  };

  const payAdapt = async () => {
    if (!resumeId || !authToken || vacancy.trim().length < 20) {
      alert("Вставьте текст вакансии (не менее 20 символов).");
      return;
    }
    const tg = getTg();
    if (!tg?.openInvoice) {
      alert("Оплата доступна только в Telegram.");
      return;
    }
    setAdaptBusy(true);
    try {
      const token = authToken || (await ensureAuthToken());
      await saveAdaptVacancy(token, resumeId, vacancy.trim());
      const { invoice_link: invoiceLink } = await createAdaptInvoice(token, resumeId);
      await new Promise<void>((resolve, reject) => {
        tg.openInvoice!(invoiceLink, (status) => {
          if (status === "paid") {
            resolve();
            return;
          }
          if (status === "cancelled") reject(new Error("cancelled"));
          if (status === "failed") reject(new Error("failed"));
        });
      });
      showToast("Адаптированное резюме придёт в чат с ботом");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message !== "cancelled") {
        alert("Не удалось завершить адаптацию. Попробуйте позже.");
      }
    } finally {
      setAdaptBusy(false);
    }
  };

  const close = () => getTg()?.close?.();

  return (
    <Screen withBottomBar centered className="px-4">
      <AppHeader />
      <main className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full shadow-brand"
            style={{ background: "var(--brand-muted)" }}
          >
            <Icon name="check_circle" filled className="text-primary-container" size={64} />
          </div>
          <h2 className="text-2xl font-bold">Ура! Ваше резюме готово</h2>
          <p className="text-base" style={{ color: "var(--text-muted)" }}>
            PDF отправлен в чат с ботом. Удачи в поиске работы!
          </p>
        </div>

        <Button variant="brand" onClick={close} className="w-full">
          Вернуться в бот
        </Button>

        <Button variant="outline" onClick={() => void copyForHh()} className="w-full">
          Скопировать текст для hh.ru
        </Button>

        <section className="flex flex-col gap-3 rounded-xl p-4" style={{ background: "#f3f4f6" }}>
          <h3 className="font-medium" style={{ color: "#374151" }}>
            Хотите ещё лучше?
          </h3>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            Адаптируем резюме под конкретную вакансию с hh.ru
          </p>
          <textarea
            value={vacancy}
            onChange={(e) => setVacancy(e.target.value)}
            placeholder="Вставьте текст вакансии с hh.ru..."
            rows={4}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: "#e5e7eb", background: "#fff" }}
          />
          <Button
            variant="outline"
            onClick={() => void payAdapt()}
            disabled={adaptBusy}
            className="w-full"
          >
            {adaptBusy ? "Оплата…" : "Адаптировать за 99 ₽"}
          </Button>
        </section>

        <section className="mt-2 flex flex-col gap-3 rounded-xl p-4" style={{ background: "#f3f4f6" }}>
          <p className="text-sm font-medium" style={{ color: "#374151" }}>
            Знаете кого-то, кто ищет работу?
          </p>
          <Button variant="outline" onClick={shareInvite} className="w-full">
            Пригласить друга
          </Button>
          <p className="text-xs" style={{ color: "#6b7280" }}>
            Друг получит скидку, вы получите бонусные Stars
          </p>
        </section>
      </main>

      {toast ? <div className="toast-copy">{toast}</div> : null}

      <FixedBottomBar>
        <Button variant="brand" onClick={close}>
          Готово
        </Button>
      </FixedBottomBar>
    </Screen>
  );
}
