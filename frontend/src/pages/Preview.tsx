import { useCallback, useEffect, useState } from "react";

import { trackEvent } from "../lib/analytics";

import { PreviewImageFrame } from "../components/preview/PreviewImageFrame";
import { PreviewPaidHero } from "../components/preview/PreviewPaidHero";
import { PreviewLoadingSkeleton } from "../components/preview/PreviewLoadingSkeleton";
import { PreviewResumeCard } from "../components/preview/PreviewResumeCard";
import { HhTextEntryCard } from "../components/hh/HhTextEntryCard";
import { ensureAuthToken, getResume, requestPdf } from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { FounderBadge } from "../components/ui/FounderBadge";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { useFounderStatus } from "../hooks/useFounderStatus";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { PREVIEW_CHECKLIST } from "../lib/marketingCopy";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function summaryTeaserText(summary: string, maxLen = 120): string {
  const trimmed = summary.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen).trimEnd()}…`;
}

export function PreviewPage() {
  const {
    resumeData,
    resumeId,
    authToken,
    setPage,
    startEditResume,
    previewReturnPage,
    isPaid,
    openHhTextView,
  } = useAppStore();
  const founderActive = useFounderStatus();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [hydrateError, setHydrateError] = useState(false);
  const [resendingPdf, setResendingPdf] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const previewLocked = !isPaid && !founderActive;
  const previewPaid = isPaid || founderActive;
  const useFitLayout = previewLocked || previewPaid;
  const handleBack = useCallback(() => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    setPage(previewReturnPage);
  }, [setPage, previewReturnPage]);
  useTelegramBackButton(handleBack);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const handleResendPdf = useCallback(async () => {
    if (!resumeId || resendingPdf) return;
    getTg()?.HapticFeedback?.impactOccurred("light");
    setResendingPdf(true);
    try {
      const token = authToken || (await ensureAuthToken());
      const result = await requestPdf(token, resumeId);
      getTg()?.HapticFeedback?.notificationOccurred("success");
      showToast(`PDF «${result.filename}» отправлен в чат с ботом`);
      trackEvent("pdf_resent", { source: "preview" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось отправить PDF";
      alert(message);
    } finally {
      setResendingPdf(false);
    }
  }, [authToken, resumeId, resendingPdf, showToast]);

  useEffect(() => {
    trackEvent("preview_viewed");
  }, []);

  useEffect(() => {
    if (resumeData || !resumeId) return;

    let cancelled = false;
    setHydrating(true);
    setHydrateError(false);

    (async () => {
      try {
        const token = authToken || (await ensureAuthToken());
        const record = await getResume(token, resumeId);
        if (cancelled) return;
        useAppStore.getState().setResumeResult(resumeId, record.data, record.is_paid);
      } catch {
        if (!cancelled) setHydrateError(true);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authToken, resumeData, resumeId]);

  useEffect(() => {
    if (!resumeId) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const token = authToken || (await ensureAuthToken());
        const res = await fetch(`${API_URL}/api/resume/${resumeId}/preview-image`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          setPreviewError(true);
          return;
        }
        const blob = await res.blob();
        if (blob.size < 100) {
          setPreviewError(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
        setPreviewError(false);
      } catch {
        if (!cancelled) setPreviewError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [authToken, resumeId]);

  if (!resumeData) {
    return (
      <Screen centered className="preview-page px-4">
        <AppHeader onBack={handleBack} showBack title="Предпросмотр" />
        <main className="preview-page-empty">
          {hydrating ? (
            <>
              <PreviewLoadingSkeleton />
              <p className="preview-page-caption">Загружаем резюме…</p>
            </>
          ) : hydrateError || !resumeId ? (
            <>
              <p className="preview-page-error-title">Не удалось открыть предпросмотр</p>
              <p className="preview-page-caption">
                Попробуйте сформировать резюме ещё раз или откройте его из истории.
              </p>
              <Button variant="brand" onClick={() => setPage("home")}>
                На главную
              </Button>
            </>
          ) : (
            <PreviewLoadingSkeleton />
          )}
        </main>
      </Screen>
    );
  }

  const goToCheckout = () => {
    getTg()?.HapticFeedback?.impactOccurred("medium");
    if (!resumeId) {
      alert("Резюме не найдено. Сформируйте его заново.");
      return;
    }
    setPage("payment");
  };

  const handleShare = () => {
    const tg = getTg();
    const userId = tg?.initDataUnsafe?.user?.id;
    if (!userId) return;
    const link = `https://t.me/resumeez_bot?start=ref_${userId}`;
    trackEvent("share_clicked", { source: "preview" });
    tg?.openTelegramLink?.(
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Создал резюме за 5 минут — попробуй!")}`,
    );
  };

  const mainClass = useFitLayout ? "preview-page-main preview-page-main--fit" : "preview-page-main";
  const summaryTeaser =
    previewLocked && resumeData.summary?.trim()
      ? summaryTeaserText(resumeData.summary)
      : "";

  return (
    <Screen
      withBottomBar
      bottomBarButtons={previewPaid ? 1 : 2}
      className={
        useFitLayout
          ? previewPaid
            ? "preview-page preview-page--fit preview-page--paid"
            : "preview-page preview-page--fit"
          : "preview-page"
      }
    >
      <AppHeader onBack={handleBack} showBack title="Предпросмотр" />
      <main className={mainClass}>
        {previewPaid ? (
          <PreviewPaidHero onResendPdf={() => void handleResendPdf()} resending={resendingPdf} />
        ) : null}

        <div className="preview-preview-slot">
          {previewUrl && !previewError ? (
            <PreviewImageFrame src={previewUrl} locked={previewLocked} />
          ) : previewError ? (
            <PreviewResumeCard resume={resumeData} />
          ) : (
            <PreviewLoadingSkeleton />
          )}

          {summaryTeaser ? (
            <div className="preview-summary-teaser">
              <p className="preview-summary-teaser__label">Раздел «О себе» из вашего резюме:</p>
              <p className="preview-summary-teaser__text">{summaryTeaser}</p>
            </div>
          ) : null}
        </div>

        {previewPaid ? (
          <HhTextEntryCard onClick={() => openHhTextView("preview")} />
        ) : null}

        {founderActive ? <FounderBadge /> : null}
      </main>

      <FixedBottomBar>
        <div className={`preview-bottom-stack${previewLocked ? " preview-bottom-stack--compact" : ""}`}>
          {previewLocked ? (
            <div className="preview-share-hint">
              <span>Знаете кого-то, кто ищет работу?</span>
              <button type="button" className="preview-share-link" onClick={handleShare}>
                Пригласить
              </button>
            </div>
          ) : null}

          {previewLocked ? (
            <ul className="preview-checklist">
              {PREVIEW_CHECKLIST.map((text) => (
                <li key={text} className="preview-checklist-item">
                  <span className="preview-checklist-mark" aria-hidden>
                    ✓
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <Button
            variant="secondary"
            onClick={() => {
              getTg()?.HapticFeedback?.impactOccurred("light");
              startEditResume();
            }}
            className="preview-secondary-btn"
          >
            <Icon name="edit" size={18} />
            Изменить ответы
          </Button>

          {previewLocked ? (
            <Button variant="brand" onClick={goToCheckout} className="preview-pdf-btn">
              <span className="preview-btn-shimmer pointer-events-none absolute inset-0" aria-hidden />
              <Icon name="picture_as_pdf" size={20} />
              Получить PDF + текст hh.ru
            </Button>
          ) : null}
        </div>
      </FixedBottomBar>

      {toast ? <div className="toast-copy">{toast}</div> : null}
    </Screen>
  );
}
