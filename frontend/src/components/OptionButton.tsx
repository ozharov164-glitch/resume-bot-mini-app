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
        "px-4 py-3 rounded-2xl border text-sm font-semibold min-h-[44px]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        selected && "shadow-sm",
      )}
      style={{
        background: selected ? "var(--tg-button)" : "var(--surface-elevated)",
        color: selected ? "var(--tg-button-text)" : "var(--tg-text)",
        borderColor: selected ? "transparent" : "var(--border-subtle)",
        outlineColor: "var(--accent)",
      }}
      type="button"
    >
      {label}
    </motion.button>
  );
}
