import { useEffect, useRef, useState } from "react";

import { ensureAuthToken, fetchWithTimeout } from "../api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export type PreviewImageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error" };

/** Fetch preview-image blob and wait for browser decode before marking ready. */
export function usePreviewImage(
  resumeId: string | null,
  authToken: string | null,
  refreshToken = 0,
) {
  const [state, setState] = useState<PreviewImageState>({ status: "idle" });
  const activeUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const revokeActive = () => {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }
    };

    if (!resumeId) {
      revokeActive();
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const token = authToken || (await ensureAuthToken());
        const res = await fetchWithTimeout(
          `${API_URL}/api/resume/${resumeId}/preview-image`,
          { headers: { Authorization: `Bearer ${token}` } },
          20_000,
        );
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "error" });
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        if (blob.size < 100) {
          setState({ status: "error" });
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("decode failed"));
          img.src = objectUrl;
        });

        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        revokeActive();
        activeUrlRef.current = objectUrl;
        setState({ status: "ready", url: objectUrl });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();

    return () => {
      cancelled = true;
      revokeActive();
    };
  }, [authToken, refreshToken, resumeId]);

  return state;
}
