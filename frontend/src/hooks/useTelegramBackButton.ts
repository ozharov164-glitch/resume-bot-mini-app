import { useEffect, useRef } from "react";

import { getTg } from "../telegram";

/** Native Telegram «Назад» — same handler as header back button. */
export function useTelegramBackButton(onBack: (() => void) | null) {
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;
  const enabled = Boolean(onBack);

  useEffect(() => {
    const back = getTg()?.BackButton;
    if (!back) return;

    if (!enabled) {
      back.hide();
      return;
    }

    const handler = () => {
      handlerRef.current?.();
    };

    back.show();
    back.onClick(handler);
    return () => {
      back.offClick(handler);
      back.hide();
    };
  }, [enabled]);
}
