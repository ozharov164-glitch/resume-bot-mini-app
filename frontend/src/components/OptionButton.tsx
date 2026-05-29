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
      className={clsx("px-4 py-2 rounded-2xl border text-sm", selected && "font-semibold")}
      style={{
        background: selected ? "var(--tg-button)" : "var(--tg-secondary-bg)",
        color: selected ? "var(--tg-button-text)" : "var(--tg-text)",
        borderColor: selected ? "transparent" : "rgba(0,0,0,0.08)",
      }}
      type="button"
    >
      {label}
    </motion.button>
  );
}
