import { Icon } from "../ui/Icon";

interface PreviewPaidHeroProps {
  onResendPdf: () => void;
  resending: boolean;
}

export function PreviewPaidHero({ onResendPdf, resending }: PreviewPaidHeroProps) {
  return (
    <section className="preview-paid-hero">
      <span className="preview-paid-hero__icon" aria-hidden>
        <Icon name="check_circle" filled size={20} style={{ color: "var(--brand)" }} />
      </span>
      <div className="preview-paid-hero__copy">
        <strong>PDF отправлен в Telegram</strong>
        <span>Можно сразу отправлять работодателю</span>
      </div>
      <div className="preview-paid-hero__actions">
        <button
          type="button"
          className="preview-resend-pdf-btn"
          onClick={onResendPdf}
          disabled={resending}
        >
          <Icon name="send" size={16} />
          {resending ? "Отправляем…" : "В чат ещё раз"}
        </button>
      </div>
    </section>
  );
}
