import { getTg } from "../../telegram";
import { Icon } from "./Icon";

export const APP_TITLE = "Конструктор резюме";

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function AppHeader({ title = APP_TITLE, showBack = false, onBack }: AppHeaderProps) {
  const close = () => getTg()?.close?.();

  return (
    <header
      className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b px-4"
      style={{ background: "#ffffff", borderColor: "var(--border-subtle)" }}
    >
      {showBack && onBack ? (
        <button
          type="button"
          aria-label="Назад"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full active:scale-95"
          style={{ color: "var(--brand)" }}
        >
          <Icon name="arrow_back" />
        </button>
      ) : (
        <span className="w-10" />
      )}
      <h1 className="flex-1 truncate px-2 text-center text-base font-bold tracking-tight">{title}</h1>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={close}
        className="flex h-10 w-10 items-center justify-center rounded-full active:scale-95"
        style={{ color: "var(--brand)" }}
      >
        <Icon name="close" />
      </button>
    </header>
  );
}
