import { useCallback, useEffect, useState } from "react";

import { PreviewImageFrame } from "../components/preview/PreviewImageFrame";
import { PreviewLoadingSkeleton } from "../components/preview/PreviewLoadingSkeleton";
import { PreviewResumeCard } from "../components/preview/PreviewResumeCard";
import { PreviewStatusHero } from "../components/preview/PreviewStatusHero";
import { ensureAuthToken, requestPdf } from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { FounderBadge } from "../components/ui/FounderBadge";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { useFounderStatus } from "../hooks/useFounderStatus";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function PreviewPage() {
  const { resumeData, resumeId, authToken, setPage, setPaid, startEditResume, previewReturnPage, isPaid } =
    useAppStore();
  const founderActive = useFounderStatus();
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const previewLocked = !isPaid && !founderActive;

  const handleBack = useCallback(() => setPage(previewReturnPage), [setPage, previewReturnPage]);
  useTelegramBackButton(handleBack);

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

  if (!resumeData) return null;

  const handlePdf = async () => {
    getTg()?.HapticFeedback?.impactOccurred("medium");

    if (!resumeId) {
      alert("Резюме не найдено. Сформируй его заново.");
      return;
    }

    if (founderActive) {
      setSending(true);
      try {
        const token = authToken || (await ensureAuthToken());
        await requestPdf(token, resumeId);
        setPaid(true);
        getTg()?.HapticFeedback?.notificationOccurred("success");
        setPage("success");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Не удалось отправить PDF. Попробуй ещё раз.";
        alert(message);
      } finally {
        setSending(false);
      }
      return;
    }

    setPage("payment");
  };

  return (
    <Screen withBottomBar bottomBarButtons={2}>
      <AppHeader onBack={handleBack} showBack title="Предпросмотр" />
      <main className="flex flex-1 flex-col gap-4 px-4 py-3 pb-2">
        <PreviewStatusHero />
        {previewUrl && !previewError ? (
          <PreviewImageFrame src={previewUrl} locked={previewLocked} />
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
            {[
              "Резюме готово к отправке",
              "Оптимизировано под формат hh.ru",
              "Профессиональное оформление",
            ].map((text) => (
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
            disabled={sending}
            className="preview-pdf-btn relative flex items-center justify-center gap-2 overflow-hidden"
          >
            <span className="preview-btn-shimmer pointer-events-none absolute inset-0" aria-hidden />
            <Icon name="picture_as_pdf" size={20} />
            {sending ? "Отправляем PDF…" : "Получить PDF в Telegram"}
          </Button>
        </div>
      </FixedBottomBar>
    </Screen>
  );
}
