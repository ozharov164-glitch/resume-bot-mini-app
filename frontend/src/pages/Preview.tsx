import { useCallback, useEffect, useState } from "react";

import { trackEvent } from "../lib/analytics";

import { PreviewImageFrame } from "../components/preview/PreviewImageFrame";
import { PreviewLoadingSkeleton } from "../components/preview/PreviewLoadingSkeleton";
import { PreviewResumeCard } from "../components/preview/PreviewResumeCard";
import { PreviewStatusHero } from "../components/preview/PreviewStatusHero";
import { ensureAuthToken, getResume } from "../api";
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

export function PreviewPage() {
  const { resumeData, resumeId, authToken, setPage, setPaid, startEditResume, previewReturnPage, isPaid } =
    useAppStore();
  const founderActive = useFounderStatus();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [hydrateError, setHydrateError] = useState(false);
  const previewLocked = !isPaid && !founderActive;

  const handleBack = useCallback(() => setPage(previewReturnPage), [setPage, previewReturnPage]);
  useTelegramBackButton(handleBack);

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
      <Screen centered className="px-4">
        <AppHeader onBack={handleBack} showBack title="Предпросмотр" />
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          {hydrating ? (
            <>
              <PreviewLoadingSkeleton />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Загружаем резюме…
              </p>
            </>
          ) : hydrateError || !resumeId ? (
            <>
              <p className="text-base font-medium">Не удалось открыть предпросмотр</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
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

  const handlePdf = async () => {
    getTg()?.HapticFeedback?.impactOccurred("medium");

    if (!resumeId) {
      alert("Резюме не найдено. Сформируй его заново.");
      return;
    }

    setPage("template_select");
  };

  return (
    <Screen withBottomBar bottomBarButtons={2}>
      <AppHeader onBack={handleBack} showBack title="Предпросмотр" />
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain px-4 py-3 pb-2">
        <PreviewStatusHero />
        {previewUrl && !previewError ? (
          <>
            <PreviewImageFrame src={previewUrl} locked={previewLocked} />
            {previewLocked && (
              <div className="preview-unlock-block">
                <p className="preview-unlock-text">Полное резюме (2 стр.) — после оплаты</p>
                <Button variant="brand" onClick={handlePdf} className="w-full">
                  Получить PDF
                </Button>
              </div>
            )}
          </>
        ) : previewError ? (
          <PreviewResumeCard resume={resumeData} />
        ) : (
          <PreviewLoadingSkeleton />
        )}
        {founderActive && <FounderBadge />}
      </main>

      <FixedBottomBar>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5 mb-3">
            {PREVIEW_CHECKLIST.map((text) => (
              <div
                key={text}
                className="flex items-center gap-2 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                <span className="text-[#2de08a]">✓</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              getTg()?.HapticFeedback?.impactOccurred("light");
              startEditResume();
            }}
            className="!min-h-[44px] flex items-center justify-center gap-2"
          >
            <Icon name="edit" size={18} />
            Изменить ответы
          </Button>
          <Button
            variant="brand"
            onClick={handlePdf}
            className="preview-pdf-btn relative flex items-center justify-center gap-2 overflow-hidden"
          >
            <span className="preview-btn-shimmer pointer-events-none absolute inset-0" aria-hidden />
            <Icon name="picture_as_pdf" size={20} />
            Получить PDF в Telegram
          </Button>
        </div>
      </FixedBottomBar>
    </Screen>
  );
}
