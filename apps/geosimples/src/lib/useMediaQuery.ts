import { useSyncExternalStore } from "react";

/** Whether a CSS media query matches, kept up to date. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True when the main pointer is a finger, so targets need to be bigger. */
export const useCoarsePointer = () => useMediaQuery("(pointer: coarse)");
