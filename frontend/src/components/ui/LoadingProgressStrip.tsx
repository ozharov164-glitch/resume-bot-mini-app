interface Props {
  progress: number;
  label: string;
  ariaLabel?: string;
}

/** Progress bar + % under the loading illustration (same on Loading + SkillPick). */
export function LoadingProgressStrip({ progress, label, ariaLabel }: Props) {
  const pct = Math.round(progress);
  const width = Math.max(progress, pct > 0 ? 4 : 0);

  return (
    <div className="loading-progress-block mt-6 w-full" aria-live="polite">
      <div className="loading-progress-block__meta">
        <span className="loading-progress-block__label">{label}</span>
        <span className="loading-progress-block__pct">{pct}%</span>
      </div>
      <div
        className="loading-progress-track loading-progress-track--prominent h-3 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel ?? label}
      >
        <div
          className="loading-progress-fill relative h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${width}%` }}
        >
          <div className="loading-progress-shimmer absolute inset-0" aria-hidden />
        </div>
      </div>
    </div>
  );
}
