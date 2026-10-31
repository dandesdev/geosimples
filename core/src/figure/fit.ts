import { DEFAULT_PLOT_WINDOW } from "./defaults";
import { pointMap } from "./geometry";
import { setAxesWindow, withElements } from "./ops";
import { axesStepX, axesStepY, functionLines, graphFn, piWindow } from "./plot";
import type { Axes, Element, FigureDoc, FunctionGraph, Grid, Id, NumberLine, Point } from "./types";

/**
 * Windows that follow the figure: axes with `fit` and grids that follow
 * "figure" take what the rest of the figure covers, with a tick of room.
 */

type Interval = [number, number];

/** Most ticks along one axis before the step grows: past it the numbers crowd. */
const MAX_TICKS = 12;

/** A graph's curve may make the axes at most this many times taller than wide on paper; past it the curve is cut. */
const MAX_TALL = 2;

/** Closest ticks may come on paper, in cm, before the numbers run together. */
const MIN_TICK_CM = 0.5;

const sameInterval = (a: Interval, b: Interval) => a[0] === b[0] && a[1] === b[1];
const tidy = (v: number) => Math.round(v * 1e6) / 1e6 || 0;

class Span {
  lo = Infinity;
  hi = -Infinity;
  add(v: number) {
    if (!Number.isFinite(v)) return;
    this.lo = Math.min(this.lo, v);
    this.hi = Math.max(this.hi, v);
  }
  get empty() {
    return this.lo > this.hi;
  }
}

/**
 * The round step (0.5, 1, 2, 5, 10, 20…) that puts at most MAX_TICKS ticks
 * over `span`: whole numbers from a span of 3 up, so a small figure counts 1,
 * 2, 3, and ticks at least MIN_TICK_CM apart on an axis of `cm` per unit.
 */
export function niceStep(span: number, cm = 1): number {
  if (!(cm > 0)) cm = 1;
  if (!(span > 0)) return Math.max(1, MIN_TICK_CM / cm);
  const least = Math.max(span >= 3 ? 1 : 0.5, MIN_TICK_CM / cm);
  let power = Math.pow(10, Math.floor(Math.log10(span / MAX_TICKS)));
  for (let guard = 0; guard < 30; guard++, power *= 10) {
    for (const m of [1, 2, 5]) {
      const step = tidy(m * power);
      if (step >= least && span / step <= MAX_TICKS + 1e-9) return step;
    }
  }
  return least;
}

/** The interval out to the ticks just past it: a step of room on each side. */
function withRoom([lo, hi]: Interval, step: number): Interval {
  return [tidy(Math.floor(lo / step + 1e-9) * step - step), tidy(Math.ceil(hi / step - 1e-9) * step + step)];
}

/** Points and segments that make up intervals on a number line: they belong to it, not to the figure. */
function onNumberLines(doc: FigureDoc): Set<Id> {
  const lines = doc.elements.filter((e): e is NumberLine => e.type === "numberline");
  const out = new Set<Id>();
  if (lines.length === 0) return out;
  const on = (p: Point) =>
    !p.construction && lines.some((l) => Math.abs(p.y - l.y) < 1e-9 && p.x >= l.x[0] - 1e-9 && p.x <= l.x[1] + 1e-9);
  for (const el of doc.elements) if (el.type === "point" && on(el)) out.add(el.id);
  return out;
}

/** f's values at evenly spaced x over [a, b], where it is defined. */
function sampleValues(graph: FunctionGraph, [a, b]: Interval): number[] {
  const fn = graphFn(graph.expr);
  if (!fn || !(b > a)) return [];
  const out: number[] = [];
  const n = 200;
  for (let i = 0; i <= n; i++) {
    const y = fn(a + ((b - a) * i) / n);
    if (Number.isFinite(y)) out.push(y);
  }
  return out;
}

/**
 * Cuts the y extent of curves to `cap` units, keeping the origin: the side
 * nearer it whole when it fits, and an even split when both run long.
 */
function capped(span: Span, cap: number): Interval | null {
  if (span.empty) return null;
  const below = Math.max(0, -span.lo);
  const above = Math.max(0, span.hi);
  if (below + above <= cap) return [span.lo, span.hi];
  const keptBelow = Math.min(below, Math.max(cap / 2, cap - above));
  const lo = Math.max(span.lo, -keptBelow);
  const hi = Math.min(span.hi, cap - keptBelow);
  if (lo <= hi) return [lo, hi];
  // All of it lies past the cap on one side: keep its part nearest the origin.
  return span.lo > 0 ? [span.lo, Math.min(span.hi, span.lo + cap)] : [Math.max(span.lo, span.hi - cap), span.hi];
}

/** The window and steps that fit everything but the axes themselves, grids and number lines. */
export function fitAxesWindow(doc: FigureDoc, axes: Axes): Pick<Axes, "x" | "y" | "step" | "yStep"> {
  const skip = onNumberLines(doc);
  const pts = pointMap(doc);
  const xs = new Span();
  const ys = new Span();
  /** Graphs drawn over the axes' x: their x is whatever the axes show, so they only count in y. */
  const following: FunctionGraph[] = [];
  /** y values of curves, which may run off to infinity: they are capped, the rest is not. */
  const curves = new Span();

  for (const el of doc.elements) {
    switch (el.type) {
      case "point":
      case "text":
        if (skip.has(el.id)) break;
        xs.add(el.x);
        ys.add(el.y);
        break;
      case "circle": {
        const c = pts.get(el.center);
        if (!c) break;
        xs.add(c.x - el.radius);
        xs.add(c.x + el.radius);
        ys.add(c.y - el.radius);
        ys.add(c.y + el.radius);
        break;
      }
      case "vline":
        xs.add(el.x);
        if (!sameInterval(el.range, axes.y)) {
          ys.add(el.range[0]);
          ys.add(el.range[1]);
        }
        break;
      case "function": {
        if (sameInterval(el.domain, axes.x)) {
          following.push(el);
          break;
        }
        xs.add(el.domain[0]);
        xs.add(el.domain[1]);
        addCurve(curves, el, el.domain, axes);
        break;
      }
    }
  }

  // x: the figure with a tick of room, at least a tick past the origin, and the usual window for graphs.
  const pi = axes.xPi;
  const cm = { x: axes.unit?.[0] ?? 1, y: axes.unit?.[1] ?? 1 };
  const geoX: Interval = xs.empty ? [0, 0] : [Math.min(xs.lo, 0), Math.max(xs.hi, 0)];
  const step = pi ? axes.step : niceStep(Math.max(geoX[1] - geoX[0], following.length > 0 ? 10 : 0), cm.x);
  const stepX = pi ? pi * Math.PI : step;
  let x: Interval = xs.empty && following.length === 0 ? [...DEFAULT_PLOT_WINDOW.x] : withRoom(geoX, stepX);
  if (following.length > 0) x = [Math.min(x[0], DEFAULT_PLOT_WINDOW.x[0]), Math.max(x[1], DEFAULT_PLOT_WINDOW.x[1])];
  if (pi) x = piWindow(x, pi);

  for (const g of following) addCurve(curves, g, x, axes);
  // Tall on paper: a y axis at a smaller scale lets a steep curve show more.
  const cut = capped(curves, (MAX_TALL * (x[1] - x[0]) * cm.x) / cm.y);
  if (cut) {
    ys.add(cut[0]);
    ys.add(cut[1]);
  }
  if (ys.empty && following.length === 0 && xs.empty) {
    return { x, y: [...DEFAULT_PLOT_WINDOW.y], step, yStep: undefined };
  }
  const geoY: Interval = ys.empty ? [0, 0] : [Math.min(ys.lo, 0), Math.max(ys.hi, 0)];
  const yStep = niceStep(geoY[1] - geoY[0], cm.y);
  const y = withRoom(geoY, yStep);
  return { x, y, step, yStep: yStep === step ? undefined : yStep };
}

/** Adds a graph's y over [a, b], inside its own y cut when it has one. */
function addCurve(span: Span, g: FunctionGraph, over: Interval, axes: Axes) {
  const own = !sameInterval(g.range, axes.y);
  for (const v of sampleValues(g, over)) {
    if (own && (v < g.range[0] || v > g.range[1])) continue;
    span.add(v);
  }
}

/** Everything drawn but grids, for a grid that follows the figure. */
function drawnBox(doc: FigureDoc): { x: Span; y: Span } {
  const pts = pointMap(doc);
  const x = new Span();
  const y = new Span();
  const add = (px: number, py: number) => {
    x.add(px);
    y.add(py);
  };
  for (const el of doc.elements) {
    switch (el.type) {
      case "point":
      case "text":
        add(el.x, el.y);
        break;
      case "circle": {
        const c = pts.get(el.center);
        if (c) {
          add(c.x - el.radius, c.y - el.radius);
          add(c.x + el.radius, c.y + el.radius);
        }
        break;
      }
      case "function":
        for (const line of functionLines(el)) for (const p of line) add(p.x, p.y);
        break;
      case "vline":
        add(el.x, el.range[0]);
        add(el.x, el.range[1]);
        break;
      case "axes":
        add(el.x[0], el.y[0]);
        add(el.x[1], el.y[1]);
        break;
      case "numberline":
        add(el.x[0], el.y);
        add(el.x[1], el.y);
        break;
    }
  }
  return { x, y };
}

/** The window a grid that follows the figure takes: everything, with a square of room. */
export function fitGridWindow(doc: FigureDoc, grid: Grid): Pick<Grid, "x" | "y"> {
  const box = drawnBox(doc);
  if (box.x.empty) return { x: [...DEFAULT_PLOT_WINDOW.x], y: [...DEFAULT_PLOT_WINDOW.y] };
  return { x: withRoom([box.x.lo, box.x.hi], grid.step), y: withRoom([box.y.lo, box.y.hi], grid.step) };
}

/** The window and squares a grid draws: the axes' when it follows them and the figure has some. */
export function gridWindow(doc: FigureDoc, grid: Grid): { x: Interval; y: Interval; stepX: number; stepY: number } {
  const axes = grid.follow === "axes" ? doc.elements.find((e): e is Axes => e.type === "axes") : undefined;
  if (axes) return { x: axes.x, y: axes.y, stepX: axesStepX(axes), stepY: axesStepY(axes) };
  return { x: grid.x, y: grid.y, stepX: grid.step, stepY: grid.step };
}

/**
 * Fits the axes and grids that follow the figure, after any edit. Graphs over
 * the axes' window follow it, as when the window is typed. The same figure
 * comes back when nothing had to change.
 */
export function fitFigure(doc: FigureDoc): FigureDoc {
  let out = doc;
  for (const el of doc.elements) {
    if (el.type !== "axes" || !el.fit) continue;
    const axes = out.elements.find((e): e is Axes => e.id === el.id)!;
    const w = fitAxesWindow(out, axes);
    if (sameInterval(w.x, axes.x) && sameInterval(w.y, axes.y) && w.step === axes.step && w.yStep === axes.yStep) continue;
    const windowed = sameInterval(w.x, axes.x) && sameInterval(w.y, axes.y) ? out : setAxesWindow(out, axes.id, w.x, w.y).doc;
    out = withElements(
      windowed,
      windowed.elements.map((e): Element => {
        if (e.id !== axes.id || e.type !== "axes") return e;
        const next: Axes = { ...e, step: w.step };
        if (w.yStep === undefined) delete next.yStep;
        else next.yStep = w.yStep;
        return next;
      }),
    );
  }
  // A grid left without its axes fits the figure instead.
  const hasAxes = out.elements.some((e) => e.type === "axes");
  for (const el of out.elements) {
    if (el.type !== "grid" || !(el.follow === "figure" || (el.follow === "axes" && !hasAxes))) continue;
    const w = fitGridWindow(out, el);
    if (sameInterval(w.x, el.x) && sameInterval(w.y, el.y)) continue;
    out = withElements(
      out,
      out.elements.map((e) => (e.id === el.id ? { ...el, ...w } : e)),
    );
  }
  return out;
}
