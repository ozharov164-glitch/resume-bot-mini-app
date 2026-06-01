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
  const showHeaderBack = showBack && Boolean(onBack);

  return (
    <>
      <header className="app-header">
        {showHeaderBack ? (
          <button
            type="button"
            aria-label="Назад"
            onClick={onBack}
            className="app-header-btn"
          >
            <Icon name="arrow_back" />
          </button>
        ) : (
          <span className="app-header-side" aria-hidden />
        )}
        <h1 className="app-header-title">{title}</h1>
        <button type="button" aria-label="Закрыть" onClick={close} className="app-header-btn">
          <Icon name="close" />
        </button>
      </header>
    </>
  );
}
