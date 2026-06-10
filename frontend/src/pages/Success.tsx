import { useCallback, useEffect, useState } from "react";
import confetti from "canvas-confetti";

import {
  createAdaptInvoice,
  createAdaptYookassaInvoice,
  ensureAuthToken,
  fetchAtsScore,
  generateCoverLetter,
  getResume,
  saveAdaptVacancy,
  type AtsScoreResult,
} from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { trackEvent } from "../lib/analytics";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

const ATS_LEVEL_CFG = {
  great:  { color: "#059669", bg: "rgba(5,150,105,0.1)",  border: "rgba(5,150,105,0.28)"  },
  good:   { color: "#065f46", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.30)" },
  medium: { color: "#92400e", bg: "rgba(217,119,6,0.1)",  border: "rgba(217,119,6,0.25)"  },
  low:    { color: "#991b1b", bg: "rgba(220,38,38,0.09)", border: "rgba(220,38,38,0.22)"  },
} as const;

function AtsShareRing({ score, color }: { score: number; color: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" fill="none" aria-hidden>
      <circle cx={28} cy={28} r={r} stroke="rgba(0,0,0,0.07)" strokeWidth={4} />
      <circle
        cx={28} cy={28} r={r}
        stroke={color} strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 28 28)"
        style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }}
      />
      <text x={28} y={33} textAnchor="middle" fill={color} fontSize={13} fontWeight={800} fontFamily="inherit">
        {score}
      </text>
    </svg>
  );
}

function AtsShareCard({ token, resumeId }: { token: string; resumeId: string }) {
  const [result, setResult] = useState<AtsScoreResult | null>(null);

  useEffect(() => {
    fetchAtsScore(token, resumeId).then(setResult).catch(() => undefined);
  }, [token, resumeId]);

  const share = () => {
    if (!result) return;
    const tg = getTg();
    const userId = tg?.initDataUnsafe?.user?.id;
    const link = userId ? `https://t.me/resumeez_bot?start=ref_${userId}` : "https://t.me/resumeez_bot";
    const text = `Мой ATS-балл резюме: ${result.score}/100 (${result.label}) 🎯\nСделал в ResumeBot за 5 минут → ${link}`;
    trackEvent("ats_share_clicked");
    tg?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
  };

  if (!result) return null;

  const cfg = ATS_LEVEL_CFG[result.level];

  return (
    <div className="success-ats-share">
      <div className="success-ats-share__header">
        <div className="success-ats-share__ring-wrap">
          <AtsShareRing score={result.score} color={cfg.color} />
        </div>
        <div className="success-ats-share__copy">
          <div className="success-ats-share__title">ATS-готовность резюме</div>
          <div className="success-ats-share__desc">{result.description}</div>
          <span
            className="success-ats-share__badge"
            style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
          >
            {result.label}
          </span>
        </div>
      </div>
      <div className="success-ats-share__actions">
        <button type="button" className="success-ats-share__btn success-ats-share__btn--share" onClick={share}>
          <Icon name="share" size={15} />
          Поделиться
        </button>
      </div>
    </div>
  );
}

const BOT_USERNAME = "resumeez_bot";

function AdaptCardPayBtn({
  resumeId,
  authToken,
  vacancy,
  busy,
  setBusy,
}: {
  resumeId: string | null;
  authToken: string | null;
  vacancy: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const handleCardPay = async () => {
    if (!resumeId || !authToken || vacancy.trim().length < 20) {
      alert("Вставьте текст вакансии (не менее 20 символов).");
      return;
    }
    setBusy(true);
    try {
      const token = authToken || (await ensureAuthToken());
      await saveAdaptVacancy(token, resumeId, vacancy.trim());
      const { confirmation_url } = await createAdaptYookassaInvoice(token, resumeId);
      if (confirmation_url) {
        const tg = getTg();
        tg?.openLink?.(confirmation_url) ?? window.open(confirmation_url, "_blank");
      }
      trackEvent("adapt_yookassa_redirect");
    } catch {
      alert("Не удалось создать платёж. Попробуйте позже.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={() => void handleCardPay()}
      disabled={busy}
      className="success-adapt-pay-btn"
    >
      💳 Картой
    </Button>
  );
}

export function SuccessPage() {
  const { resumeId, authToken, openHhTextView, setPage, pendingVacancyText } = useAppStore();
  const [toast, setToast] = useState<string | null>(null);
  const [vacancy, setVacancy] = useState(pendingVacancyText);
  const [adaptBusy, setAdaptBusy] = useState(false);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);

  const handleBack = useCallback(() => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    setPage("preview");
  }, [setPage]);
  useTelegramBackButton(handleBack);

  useEffect(() => {
    if (!resumeId || !authToken) return;
    void (async () => {
      try {
        const record = await getResume(authToken, resumeId);
        if (record.cover_letter?.trim()) {
          setCoverLetter(record.cover_letter.trim());
        }
      } catch {
        /* ignore */
      }
    })();
  }, [resumeId, authToken]);

  useEffect(() => {
    if (pendingVacancyText && !vacancy) {
      setVacancy(pendingVacancyText);
    }
  }, [pendingVacancyText, vacancy]);

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
      alert("Stars-оплата доступна только в Telegram. Используйте кнопку «Картой».");
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
          if (status === "paid") { resolve(); return; }
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

  const handleGenerateCoverLetter = async () => {
    if (!resumeId || !authToken || coverLetterLoading) return;
    setCoverLetterLoading(true);
    trackEvent("cover_letter_generate");
    try {
      const token = authToken || (await ensureAuthToken());
      const { cover_letter: text } = await generateCoverLetter(
        token,
        resumeId,
        vacancy.trim(),
      );
      setCoverLetter(text);
      getTg()?.HapticFeedback?.notificationOccurred("success");
      showToast("Сопроводительное письмо готово");
    } catch {
      alert("Не удалось создать письмо. Попробуйте позже.");
    } finally {
      setCoverLetterLoading(false);
    }
  };

  const copyCoverLetter = async () => {
    if (!coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      getTg()?.HapticFeedback?.notificationOccurred("success");
      showToast("Письмо скопировано");
    } catch {
      showToast("Не удалось скопировать");
    }
  };

  return (
    <Screen withBottomBar className="success-page px-4">
      <AppHeader onBack={handleBack} showBack />
      <main className="success-page__main">
        <header className="success-page__hero">
          <div className="success-page__hero-icon" aria-hidden>
            <Icon name="check_circle" filled size={56} style={{ color: "var(--brand)" }} />
          </div>
          <h2 className="success-page__title">Ура! Ваше резюме готово</h2>
          <p className="success-page__lead">
            PDF, DOCX уже в чате с ботом. Осталось скопировать текст на hh.ru — ниже одна кнопка.
          </p>
        </header>

        <div className="success-page__primary">
          <Button variant="brand" onClick={close} className="w-full">
            <Icon name="chat" size={20} />
            Вернуться в бот
          </Button>

          {resumeId && authToken && (
            <AtsShareCard token={authToken} resumeId={resumeId} />
          )}

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

          <section className="success-section" aria-labelledby="success-cover-heading">
            <div className="success-section__head">
              <h3 id="success-cover-heading" className="success-section__title">
                ✉️ Сопроводительное письмо
              </h3>
              <p className="success-section__text">
                Отклики с письмом получают на 27% больше приглашений на собеседование
              </p>
            </div>
            {coverLetter ? (
              <>
                <textarea
                  readOnly
                  value={coverLetter}
                  rows={6}
                  className="success-section__textarea success-section__textarea--readonly"
                  aria-label="Сопроводительное письмо"
                />
                <Button variant="outline" onClick={() => void copyCoverLetter()} className="w-full">
                  <Icon name="content_copy" size={18} />
                  Скопировать письмо
                </Button>
              </>
            ) : (
              <Button
                variant="brand"
                onClick={() => void handleGenerateCoverLetter()}
                disabled={coverLetterLoading}
                className="w-full"
              >
                {coverLetterLoading ? "Генерирую письмо…" : "✨ Создать сопроводительное письмо"}
              </Button>
            )}
          </section>
        </div>

        <section className="success-section" aria-labelledby="success-adapt-heading">
          <div className="success-section__head">
            <span className="success-section__eyebrow">Дополнительно</span>
            <h3 id="success-adapt-heading" className="success-section__title">
              Хотите ещё лучше?
            </h3>
            <p className="success-section__text">
              Подстроим резюме под текст конкретной вакансии с hh.ru — добавим ключевые слова из ваших фактов
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
          <div className="success-adapt-pay-row">
            <Button
              variant="brand"
              onClick={() => void payAdapt()}
              disabled={adaptBusy}
              className="success-adapt-pay-btn"
            >
              {adaptBusy ? "Оплата…" : "⭐ 99 Stars"}
            </Button>
            <AdaptCardPayBtn
              resumeId={resumeId}
              authToken={authToken}
              vacancy={vacancy}
              busy={adaptBusy}
              setBusy={setAdaptBusy}
            />
          </div>
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
