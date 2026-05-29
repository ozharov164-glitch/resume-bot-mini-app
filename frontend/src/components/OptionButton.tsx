import clsx from "clsx";
import { motion } from "motion/react";

interface Props {
  label: string;
  selected: boolean;
  onSelect: () => void;
}

export function OptionButton({ label, selected, onSelect }: Props) {
  return (
    <motion.button
      onClick={onSelect}
      whileTap={{ scale: 0.93 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      aria-pressed={selected}
      className={clsx(
        "min-h-[44px] rounded-xl border px-4 py-3 text-sm font-semibold",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        selected && "shadow-sm",
      )}
      style={{
        background: selected ? "var(--brand-muted)" : "var(--surface-elevated)",
        color: selected ? "var(--brand)" : "var(--tg-text)",
        borderColor: selected ? "var(--brand)" : "var(--border-subtle)",
        outlineColor: "var(--brand-bright)",
      }}
      type="button"
    >
      {label}
    </motion.button>
  );
}
