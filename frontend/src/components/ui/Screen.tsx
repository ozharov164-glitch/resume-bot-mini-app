import clsx from "clsx";
import type { ReactNode } from "react";

interface ScreenProps {
  children: ReactNode;
  className?: string;
  /** Extra bottom padding when fixed bottom CTA or Telegram MainButton is visible */
  withBottomBar?: boolean;
  centered?: boolean;
  /** @deprecated use withBottomBar */
  withMainButton?: boolean;
}

export function Screen({
  children,
  className,
  withBottomBar = false,
  withMainButton = false,
  centered = false,
}: ScreenProps) {
  const bottomPad = withBottomBar || withMainButton;

  return (
    <div
      className={clsx(
        "min-h-screen flex flex-col",
        bottomPad ? "pb-[calc(var(--tg-safe-bottom)+5.5rem)]" : "pb-6",
        centered && "justify-center",
        className,
      )}
      style={{ background: "var(--tg-bg)", color: "var(--tg-text)" }}
    >
      {children}
    </div>
  );
}
