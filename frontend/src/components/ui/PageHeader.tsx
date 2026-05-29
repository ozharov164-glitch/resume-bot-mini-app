import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  align?: "left" | "center";
}

export function PageHeader({ eyebrow, title, subtitle, align = "left" }: PageHeaderProps) {
  const alignClass = align === "center" ? "text-center items-center" : "text-left";

  return (
    <header className={`flex flex-col gap-2 ${alignClass}`}>
      {eyebrow && (
        <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
          {eyebrow}
        </p>
      )}
      <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{title}</h1>
      {subtitle && (
        <p className="text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      )}
    </header>
  );
}
