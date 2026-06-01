import { Icon } from "../ui/Icon";

interface HhTextEntryCardProps {
  onClick: () => void;
  disabled?: boolean;
}

export function HhTextEntryCard({ onClick, disabled }: HhTextEntryCardProps) {
  return (
    <button
      type="button"
      className="hh-text-entry-card"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="hh-text-entry-card__icon" aria-hidden>
        <Icon name="article" size={22} style={{ color: "var(--brand)" }} />
      </span>
      <span className="hh-text-entry-card__copy">
        <span className="hh-text-entry-card__title">Текст для hh.ru</span>
        <span className="hh-text-entry-card__subtitle">Готово к вставке в профиль</span>
      </span>
      <Icon name="chevron_right" size={22} style={{ color: "var(--text-muted)" }} />
    </button>
  );
}
