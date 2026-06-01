interface Props {
  current: number;
  total: number;
  hint?: string;
}

export function ProgressBar({ current, total, hint }: Props) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : 0;
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div
        className="h-[3px] w-full overflow-hidden rounded-full"
        style={{ background: "var(--surface-variant, #e5e7eb)" }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Шаг ${current} из ${total}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%`, background: "#10b981" }}
        />
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-xs" style={{ color: "#9ca3af" }}>
          Шаг {current} из {total}
        </span>
        {hint ? (
          <span className="text-xs italic" style={{ color: "#9ca3af" }}>
            {hint}
          </span>
        ) : null}
      </div>
    </div>
  );
}
