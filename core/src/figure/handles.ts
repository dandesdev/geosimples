import { placeTangentEnd, tangentOf } from "./constructions";
import { keepGraphMarks, pointMap, resolveConstructions } from "./geometry";
import { moveNumberLine, movePoints, setAxesWindow, withElements } from "./ops";
import { axesOrigin, axesStepX, axesStepY, functionValue, nearestOnGraph, tangentDirection } from "./plot";
import type { Axes, Element, FigureDoc, FunctionGraph, Id } from "./types";
import { sub, type Vec } from "./vec";

/**
 * What Mover drags: whole shapes by their points, and the ends of axes,
 * grids, number lines, vertical lines, graphs and tangents by their handles.
 */

/** An end of a window or line: its start or end along x or y. */
export type HandleEnd = "x0" | "x1" | "y0" | "y1";

export interface Handle {
  owner: Id;
  end: HandleEnd;
  /** Where it is drawn, in world units. */
  at: Vec;
}

const firstAxes = (doc: FigureDoc) => doc.elements.find((e): e is Axes => e.type === "axes");

/** Handles of the element, if it has ends to drag. A grid over the axes has none: it follows theirs. */
export function elementHandles(doc: FigureDoc, el: Element): Handle[] {
  const h = (end: HandleEnd, at: Vec): Handle => ({ owner: el.id, end, at });
  switch (el.type) {
    case "axes": {
      const o = axesOrigin(el);
      return [h("x0", { x: el.x[0], y: o.y }), h("x1", { x: el.x[1], y: o.y }), h("y0", { x: o.x, y: el.y[0] }), h("y1", { x: o.x, y: el.y[1] })];
    }
    case "grid": {
      if (el.follow === "axes" && firstAxes(doc)) return [];
      const mx = (el.x[0] + el.x[1]) / 2;
      const my = (el.y[0] + el.y[1]) / 2;
      return [h("x0", { x: el.x[0], y: my }), h("x1", { x: el.x[1], y: my }), h("y0", { x: mx, y: el.y[0] }), h("y1", { x: mx, y: el.y[1] })];
    }
    case "numberline":
      return [h("x0", { x: el.x[0], y: el.y }), h("x1", { x: el.x[1], y: el.y })];
    case "vline":
      return [h("y0", { x: el.x, y: el.range[0] }), h("y1", { x: el.x, y: el.range[1] })];
    case "function": {
      // On the curve where it can be, so the handle sits at the end it moves.
      const at = (x: number): Vec => {
        const y = functionValue(el.expr, x);
        return { x, y: y === null ? 0 : Math.min(Math.max(y, el.range[0]), el.range[1]) };
      };
      return [h("x0", at(el.domain[0])), h("x1", at(el.domain[1]))];
    }
    case "segment": {
      // A tangent's ends slide along it; other segments move by their points.
      const tangent = tangentOf(doc, el);
      const pts = pointMap(doc);
      const ends = tangent?.ends.map((id) => pts.get(id));
      return ends?.[0] && ends[1] ? [h("x0", ends[0]), h("x1", ends[1])] : [];
    }
    default:
      return [];
  }
}

/** Round to the step, in the units the element counts in. */
const snap = (v: number, step: number) => Math.round(Math.round(v / step) * step * 1e6) / 1e6 || 0;

/** Moves one end of an interval, keeping at least `gap` before the other. */
function withEnd([a, b]: [number, number], end: 0 | 1, v: number, gap: number): [number, number] {
  return end === 0 ? [Math.min(v, b - gap), b] : [a, Math.max(v, a + gap)];
}

/**
 * Where a graph's end goes when its handle is dragged to `to`: the x of the
 * curve's point nearest the pointer on paper, so the end slides along the
 * curve. Looked for on the end's side of the other end, out to a stretch past it.
 */
function alongCurve(el: FunctionGraph, end: 0 | 1, to: Vec, unit: [number, number]): number {
  const out = Math.max(el.domain[1] - el.domain[0], 10);
  const span: [number, number] = end === 0 ? [el.domain[0] - out, el.domain[1]] : [el.domain[0], el.domain[1] + out];
  return nearestOnGraph(el, to, span, unit) ?? to.x;
}

/** To hundredths, as Mover places points. */
const fine = (v: number) => Math.round(v * 100) / 100 || 0;

/**
 * The figure with a handle dragged to `to` (world units). Ends of axes, grids
 * and number lines go to the nearest tick, since their ticks start there. The
 * ends of a graph or vertical line follow the pointer, and land on a tick
 * only within `reach` (world units along x and y) of one, when given.
 * Axes and grids set this way stop fitting the figure.
 */
export function dragHandle(doc: FigureDoc, handle: Pick<Handle, "owner" | "end">, to: Vec, reach?: Vec): FigureDoc {
  const el = doc.elements.find((e) => e.id === handle.owner);
  if (!el) return doc;
  const along = handle.end[0] === "x" ? to.x : to.y;
  const end = handle.end[1] === "0" ? 0 : 1;
  const replace = (next: Element) =>
    resolveConstructions(keepGraphMarks(doc, withElements(doc, doc.elements.map((e) => (e.id === el.id ? next : e)))));
  // An end that snaps back where it was changes nothing, so a tap doesn't stop the axes or grid fitting.
  const same = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];
  const axes = firstAxes(doc);
  /** On the tick when one is in reach, else where the pointer is. */
  const free = (step: number, at = along) => {
    const tick = snap(at, step);
    const r = reach && (handle.end[0] === "x" ? reach.x : reach.y);
    return r !== undefined && Math.abs(tick - at) <= r ? tick : fine(at);
  };
  // Ends this close stay apart, the way they read on the paper.
  const gap = 0.01;
  switch (el.type) {
    case "axes": {
      const step = handle.end[0] === "x" ? axesStepX(el) : axesStepY(el);
      const v = snap(along, step);
      const x = handle.end[0] === "x" ? withEnd(el.x, end, v, step) : el.x;
      const y = handle.end[0] === "y" ? withEnd(el.y, end, v, step) : el.y;
      if (same(x, el.x) && same(y, el.y)) return doc;
      const r = setAxesWindow(doc, el.id, x, y);
      return r.error ? doc : withElements(r.doc, r.doc.elements.map((e) => (e.id === el.id && e.type === "axes" ? { ...e, fit: false } : e)));
    }
    case "grid": {
      const v = snap(along, el.step);
      const x = handle.end[0] === "x" ? withEnd(el.x, end, v, el.step) : el.x;
      const y = handle.end[0] === "y" ? withEnd(el.y, end, v, el.step) : el.y;
      return same(x, el.x) && same(y, el.y) ? doc : replace({ ...el, x, y, follow: "none" });
    }
    case "numberline": {
      const x = withEnd(el.x, end, snap(along, el.step), el.step);
      return same(x, el.x) ? doc : replace({ ...el, x });
    }
    case "vline": {
      const range = withEnd(el.range, end, free(axes ? axesStepY(axes) : 1), gap);
      return same(range, el.range) ? doc : replace({ ...el, range });
    }
    case "function": {
      const at = alongCurve(el, end, to, axes?.unit ?? [1, 1]);
      // The tick's point of the curve must be in reach of the pointer: on a steep arm a
      // little x is a long way along the curve, and an x-only reach held the end for a whole unit.
      const tick = snap(at, axes ? axesStepX(axes) : 1);
      const y = functionValue(el.expr, tick);
      const near =
        reach !== undefined &&
        y !== null &&
        Math.hypot((tick - to.x) / reach.x, (Math.min(Math.max(y, el.range[0]), el.range[1]) - to.y) / reach.y) <= 1;
      const domain = withEnd(el.domain, end, near ? tick : fine(at), gap);
      return same(domain, el.domain) ? doc : replace({ ...el, domain });
    }
    case "segment":
      return dragTangentEnd(doc, el, end, to, reach);
    default:
      return doc;
  }
}

/**
 * A tangent's end dragged to `to`: it slides along the line to the spot
 * nearest the pointer on paper, staying on its side of the point. With
 * `reach`, it lands where the line crosses a tick of x or y in reach.
 */
function dragTangentEnd(doc: FigureDoc, el: Element, end: 0 | 1, to: Vec, reach?: Vec): FigureDoc {
  const tangent = tangentOf(doc, el);
  const pts = pointMap(doc);
  const p = tangent && pts.get(tangent.point);
  const graph = tangent && doc.elements.find((e): e is FunctionGraph => e.id === tangent.graph && e.type === "function");
  const dir = p && graph ? tangentDirection(graph.expr, p.x) : null;
  if (!tangent || !p || !dir) return doc;
  const axes = firstAxes(doc);
  const [ux, uy] = axes?.unit ?? [1, 1];
  // Nearest on paper, where a unit of y may be longer than one of x.
  const w = { x: dir.x * ux * ux, y: dir.y * uy * uy };
  const off = sub(to, p);
  let t = (w.x * off.x + w.y * off.y) / (w.x * dir.x + w.y * dir.y);
  let snapped = false;
  if (reach) {
    const onPaper = (s: number) => Math.hypot((p.x + s * dir.x - to.x) / reach.x, (p.y + s * dir.y - to.y) / reach.y);
    const ticks: number[] = [];
    if (Math.abs(dir.x) > 1e-9) ticks.push((snap(p.x + t * dir.x, axes ? axesStepX(axes) : 1) - p.x) / dir.x);
    if (Math.abs(dir.y) > 1e-9) ticks.push((snap(p.y + t * dir.y, axes ? axesStepY(axes) : 1) - p.y) / dir.y);
    const best = ticks.filter((s) => onPaper(s) <= 1).sort((a, b) => onPaper(a) - onPaper(b))[0];
    if (best !== undefined) {
      t = best;
      snapped = true;
    }
  }
  // Each end stays on its side, a hundredth from the point at least. On a tick it stays exactly there.
  const at = snapped ? t : fine(t);
  const along = end === 0 ? Math.min(at, -0.01) : Math.max(at, 0.01);
  const id = tangent.ends[end];
  const c = pts.get(id)?.construction;
  if (c?.kind === "tangent" && !c.fill && Math.abs(c.along - along) < 1e-12) return doc;
  return placeTangentEnd(doc, id, along);
}

/**
 * Points a drag on the element moves: a shape moves by its points, so what
 * is built on them follows. A tangent moves by the point it touches, which
 * slides along the graph.
 */
export function draggedPoints(el: Element, doc?: FigureDoc): Id[] {
  switch (el.type) {
    case "point":
      return [el.id];
    case "segment": {
      const tangent = doc && tangentOf(doc, el);
      return tangent ? [tangent.point] : [el.a, el.b];
    }
    case "polygon":
      return el.vertices;
    case "vector":
    case "component":
      return [el.a, el.b];
    case "circle": {
      const c = el.construction;
      if (c.kind === "through") return [el.center, c.point];
      if (c.kind === "circumcircle") return c.points;
      return [el.center];
    }
    default:
      return [];
  }
}

/** Whether Mover drags the element. */
export function isDraggable(el: Element): boolean {
  return el.type === "text" || el.type === "board" || el.type === "study" || el.type === "vline" || el.type === "numberline" || draggedPoints(el).length > 0;
}

/**
 * The figure with elements moved by `by` (world units) from where they are
 * in `doc`: points, texts and shapes by their points, a vertical line along
 * x and a number line along y. Positions are rounded to hundredths.
 */
export function moveElements(doc: FigureDoc, ids: Id[], by: Vec): FigureDoc {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const byId = new Map(doc.elements.map((e) => [e.id, e]));
  const pts = pointMap(doc);
  const points = new Set<Id>();
  const moves: { id: Id; x: number; y: number }[] = [];
  let working = doc;
  for (const id of ids) {
    const el = byId.get(id);
    if (!el) continue;
    if (el.type === "text") moves.push({ id, x: r2(el.x + by.x), y: r2(el.y + by.y) });
    else if (el.type === "board" || el.type === "study") {
      working = withElements(working, working.elements.map((e) => (e.id === id && (e.type === "board" || e.type === "study") ? { ...e, x: r2(el.x + by.x), y: r2(el.y + by.y) } : e)));
    } else if (el.type === "vline") {
      working = withElements(working, working.elements.map((e) => (e.id === id && e.type === "vline" ? { ...e, x: r2(el.x + by.x) } : e)));
    } else if (el.type === "numberline") working = moveNumberLine(working, id, r2(el.y + by.y));
    else for (const p of draggedPoints(el, doc)) points.add(p);
  }
  for (const id of points) {
    const p = pts.get(id);
    if (p) moves.push({ id, x: r2(p.x + by.x), y: r2(p.y + by.y) });
  }
  return movePoints(working, moves);
}
