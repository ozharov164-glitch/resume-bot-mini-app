import clsx from "clsx";
import type { CSSProperties, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClass =
  "w-full min-w-0 rounded-xl px-4 py-3.5 text-base outline-none border min-h-[52px] select-text focus-visible:ring-2 focus-visible:ring-offset-0 transition-shadow focus-visible:ring-[color:var(--brand-bright)]";

const fieldStyle: CSSProperties = {
  background: "#ffffff",
  borderColor: "var(--border-subtle)",
  color: "#161d19",
  WebkitTextFillColor: "#161d19",
  caretColor: "#161d19",
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
