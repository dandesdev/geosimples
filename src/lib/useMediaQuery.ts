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

/**
 * True when the preview has room for controls floating over it. Phones,
 * upright or sideways, get them around the preview instead.
 */
export const useRoomyPreview = () => useMediaQuery("(min-width: 640px) and (min-height: 500px)");

/** True when the side panel sits beside the preview; narrower, it stacks below the page fold. */
export const useSidePanelBeside = () => useMediaQuery("(min-width: 1024px)");

/** True when the main pointer is a finger, so targets need to be bigger. */
export const useCoarsePointer = () => useMediaQuery("(pointer: coarse)");
