import { useMemo } from "react";
import { useEditorStore } from "@/store/useEditorStore";

/**
 * Hook for getting the total scale factor for converting pixels to world units.
 *
 * This consolidates the common pattern of `transform.scale * pixelsPerUnit`
 * used throughout the codebase for scaling visual elements.
 *
 * @returns Object containing:
 *   - `totalScale`: Combined scale factor (zoom * pixelsPerUnit)
 *   - `pixelToWorld`: Function to convert pixel value to world units
 *   - `worldToPixel`: Function to convert world value to pixels
 */
export function useTotalScale() {
  const transform = useEditorStore((s) => s.transform);
  const { pixelsPerUnit } = useEditorStore((s) => s.coordinateSystem);

  const totalScale = useMemo(
    () => transform.scale * pixelsPerUnit,
    [transform.scale, pixelsPerUnit],
  );

  const pixelToWorld = useMemo(
    () => (pixels: number) => pixels / totalScale,
    [totalScale],
  );

  const worldToPixel = useMemo(
    () => (world: number) => world * totalScale,
    [totalScale],
  );

  return {
    totalScale,
    pixelToWorld,
    worldToPixel,
    // Expose underlying values for edge cases
    zoomScale: transform.scale,
    pixelsPerUnit,
  };
}
