import { useEffect, useRef } from "react";

import { completePaymentReturn } from "../lib/paymentReturn";
import { useAppStore } from "../store";

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 120; // ~5 minutes maximum

/** When user returns to Telegram after card checkout, detect paid status and go to success. */
export function useYookassaReturnPoll(active: boolean) {
  const { authToken, resumeId, setPage, setPaid, setResumeResult } = useAppStore();
  const resolving = useRef(false);
  const attempts = useRef(0);

  useEffect(() => {
    if (!active || !authToken || !resumeId) return;
    attempts.current = 0;

    const tryResolve = async () => {
      if (resolving.current || document.hidden) return;
      if (attempts.current >= POLL_MAX_ATTEMPTS) return;
      resolving.current = true;
      attempts.current += 1;
      try {
        const { outcome, data } = await completePaymentReturn(authToken, resumeId);
        if (outcome === "success" && data) {
          setResumeResult(resumeId, data, true);
          setPaid(true);
          setPage("success");
        }
      } finally {
        resolving.current = false;
      }
    };

    const onVisible = () => {
      if (!document.hidden) void tryResolve();
    };

    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (attempts.current >= POLL_MAX_ATTEMPTS) {
        clearInterval(timer);
        return;
      }
      void tryResolve();
    }, POLL_INTERVAL_MS);
    void tryResolve();

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [active, authToken, resumeId, setPage, setPaid, setResumeResult]);
}
