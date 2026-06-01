import clsx from "clsx";
import { motion } from "motion/react";

interface Props {
  label: string;
  selected: boolean;
  onSelect: () => void;
}

export function SkillPill({ label, selected, onSelect }: Props) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      animate={{ scale: selected ? [0.96, 1.04, 1] : 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={clsx(
        "skill-pill min-h-[40px] rounded-full border px-4 py-2 text-sm font-medium",
        selected ? "skill-pill--selected" : "skill-pill--default",
      )}
    >
      {label}
    </motion.button>
  );
}
