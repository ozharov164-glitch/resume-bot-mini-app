import clsx from "clsx";
import { motion } from "motion/react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const variantStyle: Record<ButtonVariant, CSSProperties> = {
  primary: { background: "var(--tg-button)", color: "var(--tg-button-text)" },
  accent: { background: "var(--accent)", color: "var(--on-accent)" },
  secondary: {
    background: "var(--surface-elevated)",
    color: "var(--tg-text)",
    border: "1px solid var(--border-subtle)",
  },
  ghost: { background: "transparent", color: "var(--text-muted)" },
};

export function Button({
  children,
  variant = "primary",
  fullWidth = true,
  className,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={clsx(
        "rounded-2xl py-4 px-5 text-base font-bold min-h-[52px]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        fullWidth && "w-full",
        disabled && "opacity-45 cursor-not-allowed",
        className,
      )}
      style={{
        ...variantStyle[variant],
        outlineColor: "var(--accent)",
      }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
