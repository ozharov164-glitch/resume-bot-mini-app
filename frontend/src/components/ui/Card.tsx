import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "benefit" | "resume";
}

export function Card({ children, className, variant = "default" }: CardProps) {
  const styles: Record<typeof variant, CSSProperties> = {
    default: {
      background: "var(--surface-elevated)",
      border: "1px solid var(--border-subtle)",
    },
    benefit: {
      background: "var(--benefit-bg)",
      border: "1px solid var(--benefit-border)",
      color: "var(--benefit-text)",
    },
    resume: {
      background: "var(--surface-elevated)",
      border: "1px solid var(--border-subtle)",
    },
  };

  return (
    <div className={clsx("rounded-2xl p-4", className)} style={styles[variant]}>
      {children}
    </div>
  );
}
