import { useCallback, useEffect, useState } from "react";

import { ensureAuthToken, fetchHhText } from "../api";
import { HhTextViewer } from "../components/hh/HhTextViewer";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { Screen } from "../components/ui/Screen";
import { useFounderStatus } from "../hooks/useFounderStatus";
import { trackEvent } from "../lib/analytics";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

export function HhTextPage() {
  const { resumeId, authToken, hhTextReturnPage, isPaid, setPage } = useAppStore();
  const founderActive = useFounderStatus();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleBack = useCallback(() => setPage(hhTextReturnPage), [hhTextReturnPage, setPage]);
  useTelegramBackButton(handleBack);

  useEffect(() => {
    if (!resumeId) {
      setError(true);
      setLoading(false);
      return;
    }

    if (!isPaid && !founderActive) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = authToken || (await ensureAuthToken());
        const data = await fetchHhText(token, resumeId);
        if (cancelled) return;
        if (!data.is_paid || !data.text) {
          setAccessDenied(true);
          setText(null);
          return;
        }
        setText(data.text);
        setAccessDenied(false);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authToken, founderActive, isPaid, resumeId]);

  const copyText = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      getTg()?.HapticFeedback?.notificationOccurred("success");
      trackEvent("text_exported", { source: "hh_text_page" });
      setToast("Скопировано");
      window.setTimeout(() => setToast(null), 2000);
    } catch {
      alert("Не удалось скопировать текст.");
    }
  };

  const goToPayment = () => {
    setPage("template_select");
  };

  return (
    <Screen withBottomBar className="hh-text-page px-4">
      <AppHeader onBack={handleBack} showBack title="Текст для hh.ru" />
      <main className="hh-text-page__main">
        {loading ? (
          <p className="hh-text-page__status">Загружаем текст…</p>
        ) : accessDenied ? (
          <div className="hh-text-page__status">
            <p className="hh-text-page__error">Текст для hh.ru доступен после оплаты</p>
            <p className="hh-text-page__hint">Оплатите резюме — PDF и полный текст откроются сразу.</p>
            <Button variant="brand" onClick={goToPayment}>
              Получить PDF + текст
            </Button>
          </div>
        ) : error || !text ? (
          <div className="hh-text-page__status">
            <p className="hh-text-page__error">Не удалось загрузить текст</p>
            <Button variant="brand" onClick={handleBack}>
              Назад
            </Button>
          </div>
        ) : (
          <HhTextViewer text={text} />
        )}
      </main>

      {toast ? <div className="toast-copy">{toast}</div> : null}

      <FixedBottomBar>
        {text && !accessDenied ? (
          <Button variant="brand" onClick={() => void copyText()} disabled={loading}>
            Скопировать весь текст
          </Button>
        ) : null}
      </FixedBottomBar>
    </Screen>
  );
}
