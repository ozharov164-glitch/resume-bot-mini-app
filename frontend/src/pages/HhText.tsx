import { useCallback, useEffect, useState } from "react";

import { ensureAuthToken, fetchTextExport } from "../api";
import { HhTextViewer } from "../components/hh/HhTextViewer";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { Screen } from "../components/ui/Screen";
import { trackEvent } from "../lib/analytics";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

export function HhTextPage() {
  const { resumeId, authToken, hhTextReturnPage, setPage } = useAppStore();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

    let cancelled = false;
    (async () => {
      try {
        const token = authToken || (await ensureAuthToken());
        const exported = await fetchTextExport(token, resumeId);
        if (!cancelled) {
          setText(exported);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authToken, resumeId]);

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

  return (
    <Screen withBottomBar className="hh-text-page px-4">
      <AppHeader onBack={handleBack} showBack title="Текст для hh.ru" />
      <main className="hh-text-page__main">
        {loading ? (
          <p className="hh-text-page__status">Загружаем текст…</p>
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
        <Button variant="brand" onClick={() => void copyText()} disabled={!text || loading}>
          Скопировать весь текст
        </Button>
      </FixedBottomBar>
    </Screen>
  );
}
