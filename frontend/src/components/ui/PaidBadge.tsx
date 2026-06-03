import { Icon } from "./Icon";

/** Compact «Оплачено» mark for history cards and lists. */
export function PaidBadge() {
  return (
    <span className="paid-badge" aria-label="Резюме оплачено">
      <Icon name="verified" filled size={13} />
      <span>Оплачено</span>
    </span>
  );
}
