import { parseExpr, sampleFunction, type Pt } from "../plot";
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

/** Where the axes cross: the origin, or the nearest end when 0 is outside a range. */
export function axesOrigin(el: Axes): Pt {
  const clamp = (v: number, [a, b]: [number, number]) => Math.min(Math.max(v, a), b);
  return { x: clamp(0, el.x), y: clamp(0, el.y) };
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
