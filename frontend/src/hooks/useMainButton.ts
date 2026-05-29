import { useEffect } from "react";

import { tg } from "../telegram";

export function useMainButton(text: string, onClick: () => void, enabled = true) {
  useEffect(() => {
    const mainButton = tg?.MainButton;
    if (!mainButton) return;

    mainButton.text = text;
    if (enabled) mainButton.show();
    else mainButton.hide();
    mainButton.onClick(onClick);

    return () => {
      mainButton.offClick(onClick);
      mainButton.hide();
    };
  }, [text, onClick, enabled]);
}
