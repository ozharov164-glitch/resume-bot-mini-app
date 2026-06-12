import { useCallback, useEffect, useState } from "react";

import { clearResumeHistory, ensureAuthToken, fetchResumeList, type ResumeListItem } from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Icon } from "../components/ui/Icon";
import { PaidBadge } from "../components/ui/PaidBadge";
import { Screen } from "../components/ui/Screen";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

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

const TEMPLATE_BADGE_COLOR: Record<string, string> = {
  classic: "#006c49",
  modern: "#2563eb",
  compact: "#7c3aed",
};

function initialsFromName(name: string | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

export function HistoryPage() {
  const { setPage, openResumeFromHistoryPending, openHhTextView } = useAppStore();
  const [items, setItems] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  const openItem = (item: ResumeListItem) => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    openResumeFromHistoryPending(item.id, item.is_paid);
  };

  const openHhText = (item: ResumeListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.is_paid) return;
    getTg()?.HapticFeedback?.impactOccurred("light");
    useAppStore.setState({ resumeId: item.id, isPaid: true });
    openHhTextView("history");
  };

  const clearHistory = async () => {
    if (clearing || items.length === 0) return;
    const ok = window.confirm(
      "Удалить все резюме из истории?\n\nPDF, DOCX в чате с ботом останутся — пропадёт только список здесь.",
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
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Загружаем историю">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="history-skeleton-item stitch-card flex items-center gap-4 p-4">
                <div className="h-11 w-11 shrink-0 rounded-xl" style={{ background: "var(--surface-variant)" }} />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-3 w-3/4 rounded-full" style={{ background: "var(--surface-variant)" }} />
                  <div className="h-2.5 w-1/2 rounded-full" style={{ background: "var(--surface-variant)" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <Icon name="description" size={48} style={{ color: "var(--text-muted)" }} />
            <p className="text-base font-semibold">Пока нет сохранённых резюме</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Создайте первое — оно появится здесь автоматически.
            </p>
          </div>
        )}

        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openItem(item)}
            className="history-card stitch-card flex w-full items-center gap-4 p-4 text-left active:scale-[0.99]"
          >
            <div className="history-card-icon-wrap">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                style={{ background: "var(--brand-muted)", color: "var(--brand)" }}
              >
                {initialsFromName(item.full_name)}
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
                {item.is_paid ? <PaidBadge /> : (
                  <span className="history-unpaid-badge">Не оплачено</span>
                )}
              </div>
              <div className="truncate text-sm" style={{ color: "var(--text-muted)" }}>
                {item.target_position || "Должность не указана"}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {item.has_photo ? (
                  <span className="history-photo-badge">С фото</span>
                ) : null}
                {item.template_id ? (
                  <span
                    className="history-template-badge"
                    style={{ color: TEMPLATE_BADGE_COLOR[item.template_id] ?? "#6b7280" }}
                  >
                    {item.template_id}
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
              {item.is_paid ? (
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: "var(--surface-variant, #f3f4f6)" }}
                  aria-label="Текст для hh.ru"
                  onClick={(e) => openHhText(item, e)}
                >
                  <Icon name="article" size={18} style={{ color: "var(--brand)" }} />
                </button>
              ) : null}
              <Icon name="chevron_right" style={{ color: "var(--text-muted)" }} />
            </div>
          </button>
        ))}
      </main>
    </Screen>
  );
}
