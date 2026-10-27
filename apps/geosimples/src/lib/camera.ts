/** The preview camera: the SVG viewBox, in preview coordinates (pt, Y down). */
export type View = { x: number; y: number; w: number; h: number };

/** Two fingers on screen: their midpoint and the distance between them, in client px. */
export type Pinch = { x: number; y: number; dist: number };

/** Below this finger distance a pinch can't measure a zoom reliably. */
const MIN_PINCH_DIST = 8;

/** Scales the view by `factor` (above 1 zooms out) keeping the point `at` in place. */
export function zoomView(v: View, factor: number, at: { x: number; y: number }): View {
  const w = Math.min(Math.max(v.w * factor, 5), 1e6);
  const f = w / v.w;
  return { x: at.x - (at.x - v.x) * f, y: at.y - (at.y - v.y) * f, w, h: v.h * f };
}

export function pinchOf(a: { x: number; y: number }, b: { x: number; y: number }): Pinch {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(b.x - a.x, b.y - a.y) };
}

/**
 * The view after two fingers moved from `from` to `to`. The figure point that was
 * under the fingers' midpoint (`at`, in view coordinates) follows the midpoint, and
 * the zoom follows the change in distance between the fingers, so pinching and
 * two-finger dragging are one gesture. `unitsPerPx` is the scale of `view`.
 */
export function pinchView(view: View, unitsPerPx: number, at: { x: number; y: number }, from: Pinch, to: Pinch): View {
  const factor = Math.max(from.dist, MIN_PINCH_DIST) / Math.max(to.dist, MIN_PINCH_DIST);
  const zoomed = zoomView(view, factor, at);
  const u = unitsPerPx * (zoomed.w / view.w);
  return { ...zoomed, x: zoomed.x - (to.x - from.x) * u, y: zoomed.y - (to.y - from.y) * u };
}
