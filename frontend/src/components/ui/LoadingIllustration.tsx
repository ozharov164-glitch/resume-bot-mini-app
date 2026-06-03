/** Stitch: Animated Premium AI Resume Assembly (project 17728584795721097694). */
export function LoadingIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={compact ? "loading-assembly-stage loading-assembly-stage--compact mb-4 shrink-0" : "loading-assembly-stage mb-10 shrink-0"}
      aria-hidden
    >
      <div className="loading-assembly loading-assembly__float relative h-[282px] w-[200px]">
        <div className="loading-assembly__back loading-assembly__drift absolute h-full w-full rounded-2xl border border-black/5 bg-white opacity-30 shadow-sm" />

        <div className="loading-assembly__front relative z-10 flex h-full w-full flex-col overflow-hidden rounded-2xl border border-black/5 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04),0_20px_60px_rgba(0,108,73,0.08)]">
          <div className="loading-assembly__stagger loading-assembly__stagger--1 mb-4 flex gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-[#dde4de]" />
            <div className="flex flex-1 flex-col gap-1.5 pt-1">
              <div className="h-2.5 w-[85%] rounded-[2px] bg-[#161d19]" />
              <div className="loading-assembly__stagger loading-assembly__stagger--2 h-2 w-[55%] rounded-[2px] bg-[#707579]" />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="loading-assembly__stagger loading-assembly__stagger--3 -mx-2 flex flex-col gap-2 rounded-md bg-[#ecfdf5] p-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#005136]">ОПЫТ</div>
              <div className="h-1.5 w-full rounded-sm bg-[#bec9c0]/40" />
              <div className="h-1.5 w-[90%] rounded-sm bg-[#bec9c0]/40" />
            </div>

            <div className="loading-assembly__stagger loading-assembly__stagger--4 relative flex flex-col gap-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#005136] opacity-60">
                НАВЫКИ
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="loading-assembly__pill loading-assembly__pill--1 h-5 w-12 rounded-[10px] opacity-80" />
                <div className="loading-assembly__pill loading-assembly__pill--2 h-5 w-16 rounded-[10px] opacity-60" />
                <div className="loading-assembly__pill loading-assembly__pill--3 h-5 w-10 rounded-[10px] opacity-40" />
              </div>
              {!compact ? (
                <div className="loading-assembly__cursor absolute -right-2 top-0 w-0.5 bg-[#10b981] shadow-[0_0_8px_#10b981]" />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
