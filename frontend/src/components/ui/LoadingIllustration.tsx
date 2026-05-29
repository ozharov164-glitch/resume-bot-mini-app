import { Icon } from "./Icon";

/** Stitch Loading screen — document scan animation. */
export function LoadingIllustration() {
  return (
    <div className="loading-illustration relative mb-8 flex h-48 w-48 items-center justify-center">
      {/* Pulsing mint circle */}
      <div
        className="loading-illustration__glow absolute inset-0 rounded-full"
        aria-hidden
      />

      {/* Document card */}
      <div className="loading-illustration__doc relative z-10 flex h-32 w-24 flex-col overflow-hidden rounded-xl border p-4 shadow-lg">
        <div className="loading-illustration__line mb-2 h-2 w-full rounded" />
        <div className="loading-illustration__line mb-2 h-2 w-3/4 rounded" />
        <div className="loading-illustration__line mb-2 h-2 w-5/6 rounded" />
        <div className="loading-illustration__line mb-4 h-2 w-full rounded" />
        <div className="loading-illustration__line-accent mt-auto h-2 w-1/2 rounded" />

        {/* Scanner beam */}
        <div className="loading-illustration__scan absolute inset-x-0 h-1 opacity-80" aria-hidden />
      </div>

      {/* Floating decorations */}
      <Icon
        name="star"
        filled
        size={28}
        className="loading-illustration__star absolute right-4 top-4 z-20 opacity-60"
        style={{ color: "var(--brand)" }}
      />
      <Icon
        name="check_circle"
        filled
        size={24}
        className="loading-illustration__check absolute bottom-8 left-2 z-20 opacity-60"
        style={{ color: "var(--brand-bright)" }}
      />
    </div>
  );
}
