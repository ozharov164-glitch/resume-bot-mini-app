import { Button } from "./ui/Button";

interface BootstrapScreenProps {
  message: string;
  error?: string | null;
  onRetry?: () => void;
}

export function BootstrapScreen({ message, error, onRetry }: BootstrapScreenProps) {
  return (
    <div
      className="flex h-full min-h-[var(--tg-viewport-stable-height)] flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: "var(--tg-bg)", color: "var(--tg-text)" }}
    >
      {!error ? (
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--brand-bright)", borderTopColor: "transparent" }}
          aria-hidden
        />
      ) : (
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
          style={{ background: "var(--accent-light)" }}
          aria-hidden
        >
          !
        </div>
      )}
      <p className="max-w-sm text-base font-semibold" style={{ color: error ? "var(--tg-text)" : "var(--text-muted)" }}>
        {error || message}
      </p>
      {error && onRetry ? (
        <Button type="button" onClick={onRetry}>
          Повторить
        </Button>
      ) : null}
      {error ? (
        <p className="max-w-sm text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Если не помогает — закройте Mini App и откройте снова через{" "}
          <a href="https://t.me/resumeez_bot" style={{ color: "var(--brand-bright)" }}>
            @resumeez_bot
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
