import clsx from "clsx";
import { useSyncExternalStore } from "react";
import type { CSSProperties } from "react";

import { areMaterialIconsReady, subscribeMaterialIcons } from "../../lib/materialIcons";

interface IconProps {
  name: string;
  filled?: boolean;
  className?: string;
  size?: number;
  style?: CSSProperties;
}

export function Icon({ name, filled = false, className, size = 24, style }: IconProps) {
  const ready = useSyncExternalStore(
    subscribeMaterialIcons,
    areMaterialIconsReady,
    () => true,
  );

  return (
    <span
      className={clsx(
        "material-symbols-outlined inline-flex shrink-0 items-center justify-center leading-none",
        filled && "filled",
        className,
      )}
      style={{ fontSize: size, width: size, height: size, ...style }}
      aria-hidden
    >
      {ready ? name : null}
    </span>
  );
}
