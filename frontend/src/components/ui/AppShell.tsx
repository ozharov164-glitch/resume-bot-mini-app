import type { ReactNode } from "react";

/** Constrains layout to phone-width column — desktop Telegram / browser fullscreen. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <div className="app-shell-inner">{children}</div>
    </div>
  );
}
