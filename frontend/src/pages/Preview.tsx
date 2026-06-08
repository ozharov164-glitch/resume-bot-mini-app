import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";

import { trackEvent } from "../lib/analytics";

import { AtsBadge } from "../components/preview/AtsBadge";
import { PreviewAssemblyLoader } from "../components/preview/PreviewAssemblyLoader";
import { PreviewImageFrame } from "../components/preview/PreviewImageFrame";
import { PreviewPaidHero } from "../components/preview/PreviewPaidHero";
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
import { usePreviewImage } from "../hooks/usePreviewImage";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { PREVIEW_CHECKLIST } from "../lib/marketingCopy";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

function summaryTeaserText(summary: string, maxLen = 180): string {
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
  const previewImage = usePreviewImage(resumeId, authToken);
  const [hydrating, setHydrating] = useState(false);
  const [hydrateError, setHydrateError] = useState(false);
  const [resendingPdf, setResendingPdf] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const previewLocked = !isPaid;
  const previewPaid = isPaid;
  const useFitLayout = previewLocked || previewPaid;

  const imageReady = previewImage.status === "ready";
  const imageFailed = previewImage.status === "error";
  const dataReady = !!resumeData && !hydrating;
  const assemblyDone = dataReady && (imageReady || imageFailed);

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
      await requestPdf(token, resumeId);
      getTg()?.HapticFeedback?.notificationOccurred("success");
      showToast("PDF, DOCX отправлены в чат с ботом");
      trackEvent("pdf_resent", { source: "preview" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось отправить PDF, DOCX";
      alert(message);
    } finally {
      setResendingPdf(false);
    }
  }, [authToken, resumeId, resendingPdf, showToast]);

  useEffect(() => {
    trackEvent("preview_viewed");
  }, []);

  useEffect(() => {
    if (previewLocked && resumeData?.summary?.trim()) {
      trackEvent("teaser_viewed");
    }
  }, [previewLocked, resumeData]);

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
        if (record.user_answers) {
          useAppStore.setState({ answers: record.user_answers });
        }
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

  if (hydrateError || (!resumeId && !resumeData)) {
    return (
      <Screen centered className="preview-page px-4">
        <AppHeader onBack={handleBack} showBack title="Предпросмотр" />
        <main className="preview-page-empty">
          <p className="preview-page-error-title">Не удалось открыть предпросмотр</p>
          <p className="preview-page-caption">
            Попробуйте сформировать резюме ещё раз или откройте его из истории.
          </p>
          <Button variant="brand" onClick={() => setPage("home")}>
            На главную
          </Button>
        </main>
      </Screen>
    );
  }

  if (!assemblyDone) {
    return (
      <Screen className="preview-page preview-page--assembly px-4">
        <AppHeader onBack={handleBack} showBack title="Предпросмотр" />
        <main className="preview-page-assembly-main">
          <PreviewAssemblyLoader
            secondary={
              previewReturnPage === "history"
                ? "Открываем сохранённое резюме из истории"
                : "Секунду — собираем экран предпросмотра"
            }
          />
        </main>
      </Screen>
    );
  }

  if (!resumeData) {
    return null;
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
  const experienceTeaser = (() => {
    if (!previewLocked || !resumeData.experience?.length) return "";
    const desc = resumeData.experience[0]?.description?.trim();
    if (!desc) return "";
    const first = desc.split(/[•·\n]+/).map((s) => s.trim()).find(Boolean);
    if (!first) return "";
    return first.length > 100 ? `${first.slice(0, 100).trimEnd()}…` : first;
  })();

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

      <motion.div
        key="preview-content"
        className="preview-page-reveal"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <main className={mainClass}>
              {previewPaid ? (
                <PreviewPaidHero onResendPdf={() => void handleResendPdf()} resending={resendingPdf} />
              ) : null}

              <div className="preview-preview-slot">
                {imageReady ? (
                  <PreviewImageFrame src={previewImage.url} locked={previewLocked} />
                ) : (
                  <PreviewResumeCard resume={resumeData} />
                )}

                {summaryTeaser || experienceTeaser ? (
                  <div className="preview-summary-teaser">
                    {summaryTeaser ? (
                      <>
                        <p className="preview-summary-teaser__label">Раздел «О себе» из вашего резюме:</p>
                        <p className="preview-summary-teaser__text">{summaryTeaser}</p>
                      </>
                    ) : null}
                    {experienceTeaser ? (
                      <>
                        <p className="preview-summary-teaser__label">Из опыта работы:</p>
                        <p className="preview-summary-teaser__text preview-summary-teaser__text--muted">
                          {experienceTeaser}
                        </p>
                      </>
                    ) : null}
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

                {previewLocked ? (
                  <p className="preview-adapt-hint">
                    Вставьте текст вакансии в ATS — увидите, чего не хватает. Усиление под вакансию — 99 ₽ после
                    оплаты PDF.
                  </p>
                ) : null}

                <div className="preview-edit-ats-row">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      getTg()?.HapticFeedback?.impactOccurred("light");
                      startEditResume();
                    }}
                    className="preview-secondary-btn preview-edit-btn"
                    fullWidth={false}
                  >
                    <Icon name="edit" size={16} />
                    Изменить ответы
                  </Button>
                  {resumeId && authToken ? (
                    <AtsBadge
                      token={authToken}
                      resumeId={resumeId}
                      isPaid={previewPaid}
                      onGetPdf={goToCheckout}
                    />
                  ) : null}
                </div>

                {previewLocked ? (
                  <Button variant="brand" onClick={goToCheckout} className="preview-pdf-btn">
                    <Icon name="picture_as_pdf" size={20} />
                    Получить PDF, DOCX и текст hh.ru
                  </Button>
                ) : null}
              </div>
            </FixedBottomBar>
      </motion.div>

      {toast ? <div className="toast-copy">{toast}</div> : null}
    </Screen>
  );
}
