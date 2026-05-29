interface Props {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: Props) {
  const pct = Math.max(0, Math.min(100, (current / total) * 100));
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--tg-secondary-bg)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--tg-button)" }} />
    </div>
  );
}
