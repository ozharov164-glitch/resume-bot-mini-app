import clsx from "clsx";

interface Props {
  label: string;
  selected: boolean;
  onSelect: () => void;
}

export function OptionButton({ label, selected, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className={clsx("px-4 py-2 rounded-2xl border text-sm", selected && "font-semibold")}
      style={{
        background: selected ? "var(--tg-button)" : "var(--tg-secondary-bg)",
        color: selected ? "var(--tg-button-text)" : "var(--tg-text)",
        borderColor: selected ? "transparent" : "rgba(0,0,0,0.08)",
      }}
      type="button"
    >
      {label}
    </button>
  );
}
