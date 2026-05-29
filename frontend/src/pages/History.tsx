import { useCallback, useEffect, useState } from "react";

import { ensureAuthToken, fetchResumeList, getResume, type ResumeListItem } from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { useAppStore } from "../store";
import { getTg } from "../telegram";
import type { ResumeData } from "../types";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function HistoryPage() {
  const { setPage, openResumeFromHistory } = useAppStore();
  const [items, setItems] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const handleBack = useCallback(() => setPage("home"), [setPage]);
  useTelegramBackButton(handleBack);

  useEffect(() => {
    void (async () => {
      try {
        const token = await ensureAuthToken();
        const { items: list } = await fetchResumeList(token);
        setItems(list);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openItem = async (item: ResumeListItem) => {
    if (openingId) return;
    getTg()?.HapticFeedback?.impactOccurred("light");
    setOpeningId(item.id);
    try {
      const token = await ensureAuthToken();
      const record = await getResume(token, item.id);
      const data = record.data as ResumeData;
      openResumeFromHistory(record.id, data, record.is_paid, record.user_answers);
    } catch {
      alert("Не удалось открыть резюме. Попробуй ещё раз.");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <Screen className="px-4">
      <AppHeader onBack={handleBack} showBack title="Мои резюме" />
      <main className="flex flex-1 flex-col gap-3 py-4">
        {loading && (
          <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Загружаем историю…
          </p>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <Icon name="description" size={48} style={{ color: "var(--text-muted)" }} />
            <p className="text-base font-semibold">Пока нет сохранённых резюме</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Создай первое — оно появится здесь автоматически.
            </p>
          </div>
        )}

        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={openingId === item.id}
            onClick={() => void openItem(item)}
            className="stitch-card flex w-full items-center gap-4 p-4 text-left active:scale-[0.99]"
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--brand-muted)" }}
            >
              <Icon name="description" style={{ color: "var(--brand)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">
                {item.full_name || "Без имени"}
              </div>
              <div className="truncate text-sm" style={{ color: "var(--text-muted)" }}>
                {item.target_position || "Должность не указана"}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                {item.created_at && <span>{formatDate(item.created_at)}</span>}
                {item.is_paid && (
                  <span className="font-semibold" style={{ color: "var(--brand)" }}>
                    · PDF оплачен
                  </span>
                )}
              </div>
            </div>
            <Icon name="chevron_right" style={{ color: "var(--text-muted)" }} />
          </button>
        ))}
      </main>
    </Screen>
  );
}
