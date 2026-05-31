import { useEffect, useRef } from "react";

import { completePaymentReturn } from "../lib/paymentReturn";
import { useAppStore } from "../store";

/** When user returns to Telegram after card checkout, detect paid status and go to success. */
export function useYookassaReturnPoll(active: boolean) {
  const { authToken, resumeId, setPage, setPaid, setResumeResult } = useAppStore();
  const resolving = useRef(false);

  useEffect(() => {
    if (!active || !authToken || !resumeId) return;

    const tryResolve = async () => {
      if (resolving.current || document.hidden) return;
      resolving.current = true;
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
    const timer = window.setInterval(() => void tryResolve(), 2500);
    void tryResolve();

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [active, authToken, resumeId, setPage, setPaid, setResumeResult]);
}
