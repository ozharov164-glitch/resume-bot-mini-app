import type { ReactNode } from "react";

export function FixedBottomBar({ children }: { children: ReactNode }) {
  return <div className="fixed-bottom-bar">{children}</div>;
}
