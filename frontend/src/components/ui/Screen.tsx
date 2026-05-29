import clsx from "clsx";
import type { ReactNode } from "react";

interface ScreenProps {
  children: ReactNode;
  className?: string;
  /** Extra bottom padding when Telegram MainButton is visible */
  withMainButton?: boolean;
  centered?: boolean;
}

export function Screen({ children, className, withMainButton = false, centered = false }: ScreenProps) {
  return (
    <div
      className={clsx(
        "min-h-screen px-4 pt-6 flex flex-col",
        withMainButton ? "pb-[calc(var(--tg-safe-bottom)+4.75rem)]" : "pb-6",
        centered && "justify-center",
        className,
      )}
      style={{ background: "var(--tg-bg)", color: "var(--tg-text)" }}
    >
      {children}
    </div>
  );
}
