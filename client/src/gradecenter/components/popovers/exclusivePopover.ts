import { useEffect } from "react";

export const EXCLUSIVE_POPOVER_EVENT = "educore:exclusive-popover";

export function announcePopover() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EXCLUSIVE_POPOVER_EVENT));
}

export function useExclusivePopover(close: () => void) {
  useEffect(() => {
    const handler = () => close();
    window.addEventListener(EXCLUSIVE_POPOVER_EVENT, handler);
    return () => window.removeEventListener(EXCLUSIVE_POPOVER_EVENT, handler);
  }, [close]);
}
