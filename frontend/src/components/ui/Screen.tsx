import clsx from "clsx";
import type { ReactNode } from "react";

interface ScreenProps {
  children: ReactNode;
  className?: string;
  /** Extra bottom padding when fixed bottom CTA or Telegram MainButton is visible */
  withBottomBar?: boolean;
  /** Stacked buttons in FixedBottomBar — affects scroll padding (default 1) */
  bottomBarButtons?: 1 | 2;
  centered?: boolean;
  /** @deprecated use withBottomBar */
  withMainButton?: boolean;
}

const BOTTOM_BAR_PADDING: Record<1 | 2, string> = {
  1: "pb-[calc(var(--tg-safe-bottom)+5.75rem)]",
  2: "pb-[calc(var(--tg-safe-bottom)+9.5rem)]",
};

export function Screen({
  children,
  className,
  withBottomBar = false,
  bottomBarButtons = 1,
  withMainButton = false,
  centered = false,
}: ScreenProps) {
  const bottomPad = withBottomBar || withMainButton;

  return (
    <div
      className={clsx(
        "flex min-h-[100dvh] flex-col",
        bottomPad && "overflow-y-auto overscroll-y-contain",
        bottomPad ? BOTTOM_BAR_PADDING[bottomBarButtons] : "pb-6",
        centered && "justify-center",
        className,
      )}
      style={{ background: "var(--tg-bg)", color: "var(--tg-text)" }}
    >
      {children}
    </div>
  );
}
