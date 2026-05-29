import clsx from "clsx";
import { motion } from "motion/react";

import { Icon } from "./ui/Icon";

interface Props {
  label: string;
  icon: string;
  selected: boolean;
  onSelect: () => void;
}

export function ProfessionChip({ label, icon, selected, onSelect }: Props) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.95 }}
      aria-pressed={selected}
      className={clsx(
        "relative flex h-32 flex-col items-center justify-center rounded-xl border p-4 transition-colors",
        selected ? "shadow-sm" : "",
      )}
      style={{
        background: selected ? "var(--brand-muted)" : "var(--tg-secondary-bg)",
        borderColor: selected ? "var(--brand)" : "transparent",
      }}
    >
      <div
        className={clsx(
          "absolute top-3 right-3 flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors",
        )}
        style={{ borderColor: selected ? "var(--brand)" : "var(--border-subtle)" }}
      >
        <div
          className="h-2 w-2 rounded-full transition-transform"
          style={{
            background: "var(--brand)",
            transform: selected ? "scale(1)" : "scale(0)",
          }}
        />
      </div>
      <Icon
        name={icon}
        size={36}
        className="mb-2 transition-colors"
        style={{ color: selected ? "var(--brand)" : "var(--text-muted)" }}
      />
      <span
        className="text-center text-sm font-semibold transition-colors"
        style={{ color: selected ? "var(--brand)" : "var(--tg-text)" }}
      >
        {label}
      </span>
    </motion.button>
  );
}
