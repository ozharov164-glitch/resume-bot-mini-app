import { motion } from "motion/react";

import { Icon } from "../ui/Icon";

export function PreviewStatusHero() {
  return (
    <motion.section
      className="flex flex-col items-center gap-2 px-2 text-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div
        className="mb-1 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: "var(--brand-muted)" }}
      >
        <Icon name="check_circle" filled size={36} style={{ color: "var(--brand)" }} />
      </div>
      <h2 className="text-2xl font-bold leading-tight">Готово к скачиванию</h2>
      <p className="max-w-[280px] text-[15px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Твоё резюме успешно создано. Проверь данные перед получением PDF.
      </p>
    </motion.section>
  );
}
