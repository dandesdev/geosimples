import { darkColor, paddedBox, type Box, type Paper } from "@geosimples/core/figure";
import type { View } from "@/lib/camera";

/** Paper pt per world unit along x and y: they differ when the axes count x and y at different scales. */
export type PerUnit = { x: number; y: number };

/** View shown for an empty figure: about x ∈ [-1, 6], y ∈ [-1, 4]. */
export const EMPTY_WORLD = { minX: -1, minY: -1, maxX: 6, maxY: 4 };

/** A helper color of the preview as it shows on its paper. */
export function onPaper(color: string, paper: Paper): string {
  return paper === "dark" ? darkColor(color) : color;
}

/** The view that shows the whole figure with a margin around it, or the empty world when there is nothing yet. */
export function fitView(box: Box | null, k: number): View {
  const b =
    box ??
    { minX: EMPTY_WORLD.minX * k, minY: -EMPTY_WORLD.maxY * k, maxX: EMPTY_WORLD.maxX * k, maxY: -EMPTY_WORLD.minY * k };
  const size = Math.max(b.maxX - b.minX, b.maxY - b.minY, k);
  const p = paddedBox(b, Math.max(14, size * 0.08));
  return { x: p.minX, y: p.minY, w: p.maxX - p.minX, h: p.maxY - p.minY };
}
