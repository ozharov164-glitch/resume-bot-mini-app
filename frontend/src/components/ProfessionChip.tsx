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
      whileTap={{ scale: 0.96 }}
      aria-pressed={selected}
      className={clsx(
        "relative flex min-h-[88px] flex-col items-center justify-center rounded-xl border px-3 py-4 transition-all",
      )}
      style={{
        background: selected ? "var(--brand-bright)" : "var(--tg-secondary-bg)",
        borderColor: selected ? "var(--brand-bright)" : "var(--border-subtle)",
        color: selected ? "#ffffff" : "var(--tg-text)",
      }}
    >
      <Icon
        name={icon}
        size={32}
        filled={selected}
        className="mb-2"
        style={{ color: selected ? "#ffffff" : "var(--text-muted)" }}
      />
      <span className="text-center text-sm font-semibold">{label}</span>
    </motion.button>
  );
}
