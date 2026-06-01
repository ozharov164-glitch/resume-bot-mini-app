import { useCallback, useEffect, useState } from "react";

import {
  clearResumeHistory,
  ensureAuthToken,
  fetchResumeList,
  fetchTextExport,
  getResume,
  type ResumeListItem,
} from "../api";
import { trackEvent } from "../lib/analytics";
import { AppHeader } from "../components/ui/AppHeader";
import { Icon } from "../components/ui/Icon";
import { PaidBadge } from "../components/ui/PaidBadge";
import { Screen } from "../components/ui/Screen";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { useAppStore } from "../store";
import { getTg } from "../telegram";
import type { ResumeData } from "../types";

function formatRelative(iso: string) {
  try {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 1) return "сегодня";
    if (days === 1) return "вчера";
    if (days < 7) return `${days} дня назад`;
    if (days < 30) return `${Math.floor(days / 7)} нед. назад`;
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
  } catch {
    return "";
  }
}

const TEMPLATE_LABELS: Record<string, string> = {
  classic: "classic",
  modern: "modern",
  compact: "compact",
};

export function HistoryPage() {
  const { setPage, openResumeFromHistory } = useAppStore();
  const [items, setItems] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const handleBack = useCallback(() => setPage("home"), [setPage]);
  useTelegramBackButton(handleBack);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const token = await ensureAuthToken();
      const { items: list } = await fetchResumeList(token);
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

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
      alert("Не удалось открыть резюме. Попробуйте ещё раз.");
    } finally {
      setOpeningId(null);
    }
  };

  const copyText = async (item: ResumeListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = await ensureAuthToken();
      const text = await fetchTextExport(token, item.id);
      await navigator.clipboard.writeText(text);
      trackEvent("text_exported", { source: "history" });
      getTg()?.HapticFeedback?.notificationOccurred("success");
    } catch {
      alert("Не удалось скопировать текст.");
    }
  };

  const clearHistory = async () => {
    if (clearing || items.length === 0) return;
    const ok = window.confirm(
      "Удалить все резюме из истории?\n\nPDF в чате с ботом останутся — пропадёт только список здесь.",
    );
    if (!ok) return;

    getTg()?.HapticFeedback?.impactOccurred("medium");
    setClearing(true);
    try {
      const token = await ensureAuthToken();
      await clearResumeHistory(token);
      setItems([]);
      getTg()?.HapticFeedback?.notificationOccurred("success");
    } catch {
      alert("Не удалось очистить историю. Проверьте интернет и попробуйте снова.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Screen className="px-4">
      <AppHeader onBack={handleBack} showBack title="Мои резюме" />
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain py-4">
        {!loading && items.length > 0 && (
          <button
            type="button"
            onClick={() => void clearHistory()}
            disabled={clearing}
            className="history-clear-btn"
          >
            <Icon name="delete_sweep" size={18} />
            {clearing ? "Удаляем…" : "Очистить историю"}
          </button>
        )}

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
            className="history-card stitch-card flex w-full items-center gap-4 p-4 text-left active:scale-[0.99]"
          >
            <div className="history-card-icon-wrap">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--brand-muted)" }}
              >
                <Icon name="description" style={{ color: "var(--brand)" }} />
              </div>
              {item.is_paid ? (
                <span className="history-card-paid-mark" aria-hidden>
                  <Icon name="verified" filled size={12} />
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="truncate font-semibold">{item.full_name || "Без имени"}</div>
                {item.is_paid ? <PaidBadge /> : null}
              </div>
              <div className="truncate text-sm" style={{ color: "var(--text-muted)" }}>
                {item.target_position || "Должность не указана"}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {item.template_id ? (
                  <span className="history-template-badge">
                    {TEMPLATE_LABELS[item.template_id] ?? item.template_id}
                  </span>
                ) : null}
                {item.created_at ? (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatRelative(item.created_at)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: "var(--surface-variant, #f3f4f6)" }}
                aria-label="Скопировать текст"
                onClick={(e) => void copyText(item, e)}
              >
                <Icon name="content_copy" size={18} style={{ color: "#6b7280" }} />
              </button>
              <Icon name="chevron_right" style={{ color: "var(--text-muted)" }} />
            </div>
          </button>
        ))}
      </main>
    </Screen>
  );
}
