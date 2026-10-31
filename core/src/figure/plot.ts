import { findExtrema, findRoots, parseExpr, sampleFunction, type Pt } from "../plot";
import { estimateTextWidth, formatNumber } from "./labels";
import type { Axes, FigureDoc, FunctionGraph, NotableFeature } from "./types";

/**
 * Geometry of fnplot's elements in world units, shared by the scene, the
 * TikZ export and label placement, so they all draw the same curve.
 */

const cache = new Map<string, Pt[][]>();
const CACHE_SIZE = 64;

/** The curve of a function graph as polylines; empty when its expression doesn't parse. */
export function functionLines(el: Pick<FunctionGraph, "expr" | "domain" | "range">): Pt[][] {
  const key = `${el.expr}\u0000${el.domain.join(",")}\u0000${el.range.join(",")}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const parsed = parseExpr(el.expr);
  const lines = parsed.ok ? sampleFunction(parsed.fn, el.domain, el.range) : [];
  // Sampling is the costly part of drawing, and the same graph is drawn again on every edit.
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
  cache.set(key, lines);
  return lines;
}

const compiled = new Map<string, ((x: number) => number) | null>();

/** The expression as a function of x (NaN where undefined), or null when it doesn't parse. */
export function graphFn(expr: string): ((x: number) => number) | null {
  let fn = compiled.get(expr);
  if (fn === undefined) {
    const parsed = parseExpr(expr);
    fn = parsed.ok ? parsed.fn : null;
    if (compiled.size >= CACHE_SIZE) compiled.delete(compiled.keys().next().value!);
    compiled.set(expr, fn);
  }
  return fn;
}

/** f(x) for a graph's expression, or null where it is undefined or doesn't parse. */
export function functionValue(expr: string, x: number): number | null {
  const fn = graphFn(expr);
  if (!fn) return null;
  const y = fn(x);
  return Number.isFinite(y) ? y : null;
}

const notableCache = new Map<string, Pt[]>();

const inside = (v: number, [a, b]: [number, number]) => v >= a - 1e-9 && v <= b + 1e-9;

/**
 * A graph's roots, turning points or crossing with the y axis, left to right,
 * where its curve shows (inside its domain and y cut).
 */
export function notablePoints(
  graph: Pick<FunctionGraph, "expr" | "domain" | "range">,
  feature: NotableFeature,
): Pt[] {
  const key = `${feature}\u0000${graph.expr}\u0000${graph.domain.join(",")}\u0000${graph.range.join(",")}`;
  const hit = notableCache.get(key);
  if (hit) return hit;
  const fn = graphFn(graph.expr);
  let out: Pt[] = [];
  if (fn) {
    if (feature === "root") {
      out = inside(0, graph.range) ? findRoots(fn, graph.domain).map((x) => ({ x, y: 0 })) : [];
    } else if (feature === "extremum") {
      // A rise across the whole y window between neighbors is an asymptote.
      const jump = graph.range[1] - graph.range[0];
      out = findExtrema(fn, graph.domain, jump)
        .filter((e) => inside(e.y, graph.range))
        .map(({ x, y }) => ({ x, y }));
    } else {
      const y = functionValue(graph.expr, 0);
      out = inside(0, graph.domain) && y !== null && inside(y, graph.range) ? [{ x: 0, y }] : [];
    }
  }
  if (notableCache.size >= CACHE_SIZE) notableCache.delete(notableCache.keys().next().value!);
  notableCache.set(key, out);
  return out;
}

/**
 * The dots at the ends of a graph's domain, where the curve reaches them
 * inside its y cut. Each says whether it is open.
 */
export function functionEnds(el: FunctionGraph): { at: Pt; open: boolean }[] {
  if (!el.ends) return [];
  const out: { at: Pt; open: boolean }[] = [];
  el.ends.forEach((mark, i) => {
    if (mark === "none") return;
    const x = el.domain[i];
    const y = functionValue(el.expr, x);
    if (y === null || y < el.range[0] - 1e-9 || y > el.range[1] + 1e-9) return;
    out.push({ at: { x, y }, open: mark === "open" });
  });
  return out;
}

/** Radius in pt of a graph's end dots, from its stroke, so they keep their look. */
export const endDotRadius = (strokeWidth: number) => 1.4 + strokeWidth * 0.6;

/** Units between ticks on the x axis: a fraction of π when it counts in π. */
export function axesStepX(el: Axes): number {
  return el.xPi ? el.xPi * Math.PI : el.step;
}

/**
 * cm per world unit along x and y: the scale of the figure's axes, which
 * stretches everything with them. 1 and 1 without axes.
 */
export function figureUnits(doc: FigureDoc): { x: number; y: number } {
  const axes = doc.elements.find((e): e is Axes => e.type === "axes");
  return { x: axes?.unit?.[0] ?? 1, y: axes?.unit?.[1] ?? 1 };
}

/** Units between ticks on the y axis. */
export function axesStepY(el: Axes): number {
  return el.yStep ?? el.step;
}

/** Denominators π fractions are written with, smallest first. */
const PI_DENOMINATORS = [1, 2, 3, 4, 6, 12];

/** A multiple of π as a textbook writes it: π/2, π, 3π/2, -2π/3; null when it isn't a simple one. */
export function piText(v: number): string | null {
  const r = v / Math.PI;
  for (const q of PI_DENOMINATORS) {
    const p = Math.round(r * q);
    if (Math.abs(r * q - p) > 1e-6) continue;
    if (p === 0) return "0";
    const sign = p < 0 ? "-" : "";
    const top = Math.abs(p) === 1 ? "π" : `${Math.abs(p)}π`;
    return q === 1 ? sign + top : `${sign}${top}/${q}`;
  }
  return null;
}

/** The number under an x tick of the axes. */
export function xTickText(el: Axes, x: number): string {
  return (el.xPi ? piText(x) : null) ?? formatNumber(x);
}

/**
 * The x window that suits counting in π: each end on the nearest tick,
 * and the axis a bit longer than the last one so it isn't under the arrow.
 */
export function piWindow(x: [number, number], xPi: number): [number, number] {
  const step = xPi * Math.PI;
  const round = (v: number) => Math.round(v / step) * step;
  let a = round(x[0]);
  let b = round(x[1]);
  if (!(b > a)) b = a + step;
  a = a < 0 ? a - 0.5 : a;
  return [Math.round(a * 1000) / 1000, Math.round((b + 0.5) * 1000) / 1000];
}

/** Where the axes cross: the origin, or the nearest end when 0 is outside a range. */
export function axesOrigin(el: Axes): Pt {
  const clamp = (v: number, [a, b]: [number, number]) => Math.min(Math.max(v, a), b);
  return { x: clamp(0, el.x), y: clamp(0, el.y) };
}

/**
 * How far right, in pt, the number under the x tick at `x` moves so a
 * vertical line through it doesn't cross it: beside the line, as textbooks
 * write the 2 of an asymptote x = 2. 0 when no line goes below the axis there.
 */
export function xTickShift(doc: FigureDoc, axes: Axes, x: number, text: string): number {
  const o = axesOrigin(axes);
  const line = doc.elements.find((e) => e.type === "vline" && Math.abs(e.x - x) < 1e-9 && e.range[0] < o.y);
  if (!line || line.type !== "vline") return 0;
  return estimateTextWidth(text, axes.size) / 2 + 2 + line.stroke.width / 2;
}

/**
 * The direction of a graph's tangent at x, as a unit vector pointing right
 * (or up, where the tangent stands upright, as √x at 0). Null where f has
 * no tangent: undefined there, or a corner like |x| at 0.
 */
export function tangentDirection(expr: string, x: number): Pt | null {
  const fn = graphFn(expr);
  if (!fn || !Number.isFinite(fn(x))) return null;
  const h = 1e-5 * Math.max(1, Math.abs(x));
  const right = (fn(x + h) - fn(x)) / h;
  const left = (fn(x) - fn(x - h)) / h;
  let slope: number;
  if (Number.isFinite(right) && Number.isFinite(left)) {
    // Sides that disagree past rounding are a corner.
    if (Math.abs(right - left) > 1e-3 * Math.max(1, Math.abs(right), Math.abs(left))) return null;
    slope = (right + left) / 2;
  } else if (Number.isFinite(right)) slope = right;
  else if (Number.isFinite(left)) slope = left;
  else return null;
  if (Math.abs(slope) > 1e6) return { x: 0, y: 1 };
  const len = Math.hypot(1, slope);
  return { x: 1 / len, y: slope / len };
}

/**
 * The x in [lo, hi] of the graph's point nearest `to` on paper, where a unit
 * of x and of y measure `unit` cm. Where the curve leaves its y cut it runs
 * along the cut, as it's drawn. Null when f is defined nowhere there.
 */
export function nearestOnGraph(
  graph: Pick<FunctionGraph, "expr" | "range">,
  to: Pt,
  [lo, hi]: [number, number],
  unit: [number, number] = [1, 1],
): number | null {
  const fn = graphFn(graph.expr);
  if (!fn || !(hi >= lo)) return null;
  const far = (x: number) => {
    const y = fn(x);
    if (!Number.isFinite(y)) return Infinity;
    const cut = Math.min(Math.max(y, graph.range[0]), graph.range[1]);
    return ((x - to.x) * unit[0]) ** 2 + ((cut - to.y) * unit[1]) ** 2;
  };
  const n = 1000;
  const at = (i: number) => lo + ((hi - lo) * i) / n;
  let best = -1;
  let bestFar = Infinity;
  for (let i = 0; i <= n; i++) {
    const d = far(at(i));
    if (d < bestFar) [best, bestFar] = [i, d];
  }
  if (best < 0) return null;
  // Closer, between the samples on either side.
  let a = at(Math.max(best - 1, 0));
  let b = at(Math.min(best + 1, n));
  for (let k = 0; k < 40; k++) {
    const m1 = a + (b - a) / 3;
    const m2 = b - (b - a) / 3;
    if (far(m1) <= far(m2)) b = m2;
    else a = m1;
  }
  const x = (a + b) / 2;
  return far(x) <= bestFar ? x : at(best);
}

/** The dashed lines from a point to the axes, in world units; none along an axis it sits on. */
export function pointGuides(p: Pt, axes: Axes): [Pt, Pt][] {
  const o = axesOrigin(axes);
  const out: [Pt, Pt][] = [];
  if (Math.abs(p.y - o.y) > 1e-9) out.push([p, { x: p.x, y: o.y }]);
  if (Math.abs(p.x - o.x) > 1e-9) out.push([p, { x: o.x, y: p.y }]);
  return out;
}

/** Grid line values along one axis: every multiple of the step in the range, ends included. */
export function gridValues(range: [number, number], step: number): number[] {
  return axisTicks(range, step, NaN, true);
}

/** Tick values along one axis: multiples of the step inside the range, without the crossing and the arrow tip. */
export function axisTicks(range: [number, number], step: number, skip: number, keepTip = false): number[] {
  if (!(step > 0)) return [];
  const [a, b] = range;
  const out: number[] = [];
  const first = Math.ceil(a / step - 1e-9);
  const last = Math.floor(b / step + 1e-9);
  // A ruler with thousands of ticks is a typo, not a figure.
  if (last - first > 400) return [];
  for (let i = first; i <= last; i++) {
    const v = Math.round(i * step * 1e9) / 1e9;
    if (Math.abs(v - skip) < 1e-9 || (!keepTip && Math.abs(v - b) < step * 0.25)) continue;
    out.push(v);
  }
  return out;
}
