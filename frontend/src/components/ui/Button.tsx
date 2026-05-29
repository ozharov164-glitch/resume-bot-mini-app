import clsx from "clsx";
import { motion } from "motion/react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type ButtonVariant = "primary" | "accent" | "brand" | "secondary" | "ghost" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const variantStyle: Record<ButtonVariant, CSSProperties> = {
  primary: { background: "var(--tg-button)", color: "var(--tg-button-text)" },
  accent: { background: "var(--accent)", color: "var(--on-accent)" },
  brand: {
    background: "var(--brand-bright)",
    color: "#ffffff",
    boxShadow: "0 4px 20px rgba(16, 185, 129, 0.2)",
  },
  secondary: {
    background: "var(--surface-elevated)",
    color: "var(--tg-text)",
    border: "1px solid var(--border-subtle)",
  },
  outline: {
    background: "transparent",
    color: "var(--brand)",
    border: "2px solid var(--brand-bright)",
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
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={clsx(
        "rounded-xl py-3.5 px-5 text-base font-semibold min-h-[48px]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        fullWidth && "w-full",
        disabled && "opacity-45 cursor-not-allowed",
        className,
      )}
      style={{
        ...variantStyle[variant],
        outlineColor: "var(--brand-bright)",
      }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
