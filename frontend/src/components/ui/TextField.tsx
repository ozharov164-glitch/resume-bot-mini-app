import clsx from "clsx";
import type { CSSProperties, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClass =
  "w-full rounded-2xl px-4 py-3.5 text-base outline-none border min-h-[52px] focus-visible:ring-2 focus-visible:ring-offset-0 transition-shadow";

const fieldStyle: CSSProperties = {
  background: "var(--surface-elevated)",
  borderColor: "var(--border-subtle)",
  color: "var(--tg-text)",
};

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(fieldClass, props.className)}
      style={{ ...fieldStyle, ...props.style }}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(fieldClass, "resize-none min-h-[140px]", props.className)}
      style={{ ...fieldStyle, ...props.style }}
    />
  );
}
