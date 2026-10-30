import { parseExpr, sampleFunction, type Pt } from "../plot";
import { formatNumber } from "./labels";
import type { Axes, FunctionGraph } from "./types";

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

/** f(x) for a graph's expression, or null where it is undefined or doesn't parse. */
export function functionValue(expr: string, x: number): number | null {
  let fn = compiled.get(expr);
  if (fn === undefined) {
    const parsed = parseExpr(expr);
    fn = parsed.ok ? parsed.fn : null;
    if (compiled.size >= CACHE_SIZE) compiled.delete(compiled.keys().next().value!);
    compiled.set(expr, fn);
  }
  if (!fn) return null;
  const y = fn(x);
  return Number.isFinite(y) ? y : null;
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
