import clsx from "clsx";
import type { CSSProperties } from "react";

interface IconProps {
  name: string;
  filled?: boolean;
  className?: string;
  size?: number;
  style?: CSSProperties;
}

export function Icon({ name, filled = false, className, size = 24, style }: IconProps) {
  return (
    <span
      className={clsx("material-symbols-outlined leading-none", filled && "filled", className)}
      style={{ fontSize: size, ...style }}
      aria-hidden
    >
      {name}
    </span>
  );
}
