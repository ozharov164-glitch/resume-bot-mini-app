/** Hero illustration — green circle with worker + resume (no photo). */
export function HeroIllustration() {
  return (
    <div className="flex justify-center py-1">
      <div
        className="relative flex h-[168px] w-[168px] items-end justify-center overflow-hidden rounded-full"
        style={{ background: "var(--brand-bright)" }}
        aria-hidden
      >
        <svg viewBox="0 0 168 168" className="absolute inset-0 h-full w-full" fill="none">
          <circle cx="84" cy="84" r="84" fill="#10b981" />
        </svg>
        <svg viewBox="0 0 120 140" className="relative z-10 mb-1 h-[130px] w-[110px]" aria-hidden>
          {/* Body / overalls */}
          <rect x="38" y="72" width="44" height="52" rx="8" fill="#1e5aa8" />
          <rect x="46" y="80" width="28" height="6" rx="2" fill="#ffffff" opacity="0.35" />
          {/* Head */}
          <circle cx="60" cy="52" r="22" fill="#f4c89a" />
          {/* Hard hat */}
          <path d="M34 48c0-14 12-24 26-24s26 10 26 24v6H34V48z" fill="#f59e0b" />
          <rect x="30" y="52" width="60" height="6" rx="3" fill="#d97706" />
          {/* Resume document */}
          <rect x="72" y="58" width="34" height="44" rx="4" fill="#ffffff" stroke="#006c49" strokeWidth="2" />
          <rect x="78" y="66" width="22" height="3" rx="1.5" fill="#10b981" opacity="0.5" />
          <rect x="78" y="73" width="18" height="2" rx="1" fill="#cbd5e1" />
          <rect x="78" y="78" width="20" height="2" rx="1" fill="#cbd5e1" />
          <rect x="78" y="83" width="16" height="2" rx="1" fill="#cbd5e1" />
          <circle cx="89" cy="92" r="5" fill="#10b981" opacity="0.25" />
          {/* Arm */}
          <rect x="68" y="76" width="10" height="24" rx="5" fill="#f4c89a" transform="rotate(-18 73 88)" />
        </svg>
      </div>
    </div>
  );
}
