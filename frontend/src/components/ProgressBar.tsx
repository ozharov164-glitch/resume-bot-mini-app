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
        className="loading-progress-track loading-progress-track--prominent h-3 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Шаг ${current} из ${total}`}
      >
        <div
          className="loading-progress-fill h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(pct, pct > 0 ? 6 : 0)}%` }}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium" style={{ color: "#9ca3af" }}>
            Шаг {current} из {total}
          </span>
          <span className="loading-progress-block__pct text-base">{Math.round(pct)}%</span>
        </div>
        {hint ? (
          <span className="text-xs italic" style={{ color: "#9ca3af" }}>
            {hint}
          </span>
        ) : null}
      </div>
    </div>
  );
}
