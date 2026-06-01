import { useEffect, useState } from "react";

/** Time bucket index that advances every `intervalMs` (e.g. 10 min social proof rotation). */
export function useRotatingBucket(intervalMs: number): number {
  const [bucket, setBucket] = useState(() => Math.floor(Date.now() / intervalMs));

  useEffect(() => {
    const sync = () => setBucket(Math.floor(Date.now() / intervalMs));
    const msToNext = intervalMs - (Date.now() % intervalMs);
    let intervalId: number | undefined;

    const timeoutId = window.setTimeout(() => {
      sync();
      intervalId = window.setInterval(sync, intervalMs);
    }, msToNext);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [intervalMs]);

  return bucket;
}
