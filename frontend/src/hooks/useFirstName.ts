import { tg } from "../telegram";

export function useFirstName(): string | undefined {
  return (tg as { initDataUnsafe?: { user?: { first_name?: string } } })?.initDataUnsafe?.user
    ?.first_name;
}
