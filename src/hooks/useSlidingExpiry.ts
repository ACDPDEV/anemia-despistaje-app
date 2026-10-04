// Sliding expiry for armed confirms: any keydown or pointer activity
// inside the armed group restarts the auto-disarm fuse. Pointer coverage
// uses pointerover-capture (the bubbling equivalent: pointerenter itself
// does not bubble, so React offers no onPointerEnterCapture). One hook
// serves the row delete, bulk delete, and dirty-discard confirms — same
// 4s hygiene, no behavior change beyond the reset.
import { useCallback, useEffect, useRef } from "react";

export const ARMED_CONFIRM_TIMEOUT_MS = 4000;

export function useSlidingExpiry(
  armed: boolean,
  onExpire: () => void,
  timeoutMs: number = ARMED_CONFIRM_TIMEOUT_MS,
): {
  reset: () => void;
  slideProps: {
    onKeyDownCapture: () => void;
    onPointerOverCapture: () => void;
  };
} {
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  const armedRef = useRef(armed);
  armedRef.current = armed;
  const timer = useRef<number | undefined>(undefined);

  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const reset = useCallback(() => {
    if (!armedRef.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => expireRef.current(), timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    if (!armed) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
      return;
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => expireRef.current(), timeoutMs);
    return () => window.clearTimeout(timer.current);
  }, [armed, timeoutMs]);

  useEffect(() => clear, [clear]);

  return {
    reset,
    slideProps: {
      onKeyDownCapture: () => reset(),
      onPointerOverCapture: () => reset(),
    },
  };
}
