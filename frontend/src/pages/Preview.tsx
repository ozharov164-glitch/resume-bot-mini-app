import { useCallback, useState } from "react";

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

export function PreviewPage() {
  const { resumeData, resumeId, authToken, setPage, setPaid, startEditResume, previewReturnPage } =
    useAppStore();
  const founderActive = useFounderStatus();
  const [sending, setSending] = useState(false);

  const handleBack = useCallback(() => setPage(previewReturnPage), [setPage, previewReturnPage]);
  useTelegramBackButton(handleBack);

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
        <PreviewResumeCard resume={resumeData} />
        {founderActive && <FounderBadge />}
      </main>

      <FixedBottomBar>
        <div className="flex flex-col gap-2">
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
