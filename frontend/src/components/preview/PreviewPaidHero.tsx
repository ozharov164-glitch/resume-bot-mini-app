import { Icon } from "../ui/Icon";

export function PreviewPaidHero() {
  return (
    <section className="preview-paid-hero">
      <span className="preview-paid-hero__icon" aria-hidden>
        <Icon name="check_circle" filled size={20} style={{ color: "var(--brand)" }} />
      </span>
      <div className="preview-paid-hero__copy">
        <strong>PDF отправлен в Telegram</strong>
        <span>Можно сразу отправлять работодателю</span>
      </div>
    </section>
  );
}
