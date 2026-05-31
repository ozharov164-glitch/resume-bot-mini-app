import { useEffect } from "react";

import { fetchMe } from "../api";
import { isFounderJwt } from "../lib/jwtClient";
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
    if (!authToken || isFounder) return;
    if (isFounderJwt(authToken)) {
      setFounder(true);
      return;
    }
    void fetchMe(authToken, 6_000)
      .then((me) => {
        if (me.is_founder || me.unlimited || isFounderTelegramId(me.telegram_id)) {
          setFounder(true);
        }
      })
      .catch(() => {
        /* keep client-side founder hint if /me fails */
      });
  }, [authToken, isFounder, setFounder]);

  return isFounder;
}
