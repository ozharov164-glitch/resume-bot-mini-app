import { useEffect, useState } from "react";
import confetti from "canvas-confetti";

import {
  createAdaptInvoice,
  ensureAuthToken,
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
  const { resumeId, authToken, openHhTextView } = useAppStore();
  const [toast, setToast] = useState<string | null>(null);
  const [vacancy, setVacancy] = useState("");
  const [adaptBusy, setAdaptBusy] = useState(false);

  useEffect(() => {
    try {
      const accent = "#10b981";
      const brand = "#006c49";
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.55 },
        colors: [accent, brand, "#ffffff"],
      });
    } catch {
      /* canvas-confetti may fail in some Telegram WebViews */
    }
    getTg()?.HapticFeedback?.notificationOccurred("success");
    getTg()?.MainButton?.hide();
    trackEvent("payment_completed", { amount: 149 });
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
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
    trackEvent("adapt_clicked");
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
      trackEvent("adapt_purchased");
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

  const openHhText = () => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    openHhTextView("success");
  };

  return (
    <Screen withBottomBar className="success-page px-4">
      <AppHeader />
      <main className="success-page__main">
        <header className="success-page__hero">
          <div className="success-page__hero-icon" aria-hidden>
            <Icon name="check_circle" filled size={56} style={{ color: "var(--brand)" }} />
          </div>
          <h2 className="success-page__title">Ура! Ваше резюме готово</h2>
          <p className="success-page__lead">
            PDF уже в чате с ботом. Осталось скопировать текст на hh.ru — ниже одна кнопка.
          </p>
        </header>

        <div className="success-page__primary">
          <Button variant="brand" onClick={close} className="w-full">
            <Icon name="chat" size={20} />
            Вернуться в бот
          </Button>

          <button type="button" className="success-hh-card" onClick={openHhText}>
            <span className="success-hh-card__badge">Включено в оплату</span>
            <span className="success-hh-card__icon-wrap" aria-hidden>
              <Icon name="content_paste" size={28} style={{ color: "var(--brand)" }} />
            </span>
            <span className="success-hh-card__title">Текст для hh.ru</span>
            <span className="success-hh-card__desc">
              Готовые блоки «О себе», опыт и навыки — откройте, скопируйте и вставьте в профиль на сайте
            </span>
            <span className="success-hh-card__cta">
              Открыть и скопировать
              <Icon name="chevron_right" size={20} />
            </span>
          </button>
        </div>

        <section className="success-section" aria-labelledby="success-adapt-heading">
          <div className="success-section__head">
            <span className="success-section__eyebrow">Дополнительно</span>
            <h3 id="success-adapt-heading" className="success-section__title">
              Хотите ещё лучше?
            </h3>
            <p className="success-section__text">
              Подстроим резюме под текст конкретной вакансии с hh.ru
            </p>
          </div>
          <textarea
            value={vacancy}
            onChange={(e) => setVacancy(e.target.value)}
            placeholder="Вставьте текст вакансии с hh.ru…"
            rows={4}
            className="success-section__textarea"
            aria-label="Текст вакансии"
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

        <section className="success-section success-section--referral" aria-labelledby="success-referral-heading">
          <div className="success-section__head">
            <h3 id="success-referral-heading" className="success-section__title">
              Знаете кого-то, кто ищет работу?
            </h3>
            <p className="success-section__text">
              Пригласите друга — за его оплату начислим бонусные Stars (~20% от суммы)
            </p>
          </div>
          <Button variant="outline" onClick={shareInvite} className="w-full">
            <Icon name="group_add" size={20} />
            Пригласить друга
          </Button>
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
