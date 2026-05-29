import { useEffect } from "react";

import { getTg } from "../telegram";

/** Native Telegram «Назад» — same handler as header back button. */
export function useTelegramBackButton(onBack: (() => void) | null) {
  useEffect(() => {
    const back = getTg()?.BackButton;
    if (!back) return;

    if (!onBack) {
      back.hide();
      return;
    }

    back.show();
    back.onClick(onBack);
    return () => {
      back.offClick(onBack);
      back.hide();
    };
  }, [onBack]);
}
