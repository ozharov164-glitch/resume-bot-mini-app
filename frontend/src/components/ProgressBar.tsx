interface Props {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round((current / total) * 100)));
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <span
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Шаг {current} из {total}
        </span>
        <span className="text-xs font-bold" style={{ color: "var(--brand)" }}>
          {pct}%
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--surface-variant, #dde4dd)" }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Прогресс: шаг ${current} из ${total}`}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: "var(--brand)" }}
        />
      </div>
    </div>
  );
}
