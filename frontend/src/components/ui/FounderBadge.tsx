import { Icon } from "./Icon";

export function FounderBadge() {
  return (
    <div className="flex justify-center">
      <div
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
        style={{
          background: "var(--surface-elevated)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <Icon name="workspace_premium" filled className="text-primary-container" size={16} />
        <span
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--on-surface-variant, #3c4a42)" }}
        >
          Режим основателя · безлимит
        </span>
      </div>
    </div>
  );
}
