import { useEffect } from "react";

import { fetchMe } from "../api";
import { isFounderTelegramId } from "../lib/founder";
import { useAppStore } from "../store";
import { getTelegramUserId } from "../telegram";

/** Sync founder flag from Telegram user id + API /me. */
export function useFounderStatus() {
  const { authToken, isFounder, setFounder } = useAppStore();

  useEffect(() => {
    const tgId = getTelegramUserId();
    if (isFounderTelegramId(tgId)) {
      setFounder(true);
    }
  }, [setFounder]);

  useEffect(() => {
    if (!authToken) return;
    void fetchMe(authToken)
      .then((me) => {
        if (me.is_founder || me.unlimited || isFounderTelegramId(me.telegram_id)) {
          setFounder(true);
        }
      })
      .catch(() => {
        /* keep client-side founder hint if /me fails */
      });
  }, [authToken, setFounder]);

  return isFounder;
}
