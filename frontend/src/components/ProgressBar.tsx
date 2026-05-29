interface Props {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: Props) {
  const pct = Math.max(0, Math.min(100, (current / total) * 100));
  return (
    <div
      className="w-full h-2 rounded-full overflow-hidden"
      style={{ background: "var(--tg-secondary-bg)" }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Прогресс: шаг ${current} из ${total}`}
    >
      <div
        className="h-full rounded-full transition-all duration-300 ease-out"
        style={{
          width: `${pct}%`,
          background: "linear-gradient(90deg, var(--tg-button), var(--accent))",
        }}
      />
    </div>
  );
}
