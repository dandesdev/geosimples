import { DEFAULT_PLOT_WINDOW } from "./defaults";
import { pointMap } from "./geometry";
import { setAxesWindow, withElements } from "./ops";
import { axesStepX, axesStepY, functionLines, graphFn, notablePoints, piWindow } from "./plot";
import type { Axes, Element, FigureDoc, FunctionGraph, Grid, Id, NumberLine, Point } from "./types";

/**
 * Windows that follow the figure: axes with `fit` and grids that follow
 * "figure" take what the rest of the figure covers, with a tick of room.
 */

type Interval = [number, number];

/** Most ticks along one axis before the step grows: past it the numbers crowd. */
const MAX_TICKS = 12;

/** Narrowest x window, in units, a graph gets: enough to show the shape around what it marks. */
const MIN_GRAPH_WIDTH = 6;

/** Where a graph's turning points are looked for: a rise past this between samples is an asymptote, not a peak. */
const FEATURE_RANGE: Interval = [-100, 100];

/** Closest ticks may come on paper, in cm, before the numbers run together. */
const MIN_TICK_CM = 0.5;

const sameInterval = (a: Interval, b: Interval) => a[0] === b[0] && a[1] === b[1];
const tidy = (v: number) => Math.round(v * 1e6) / 1e6 || 0;

/** How far past a tick, in steps, an end may sit and still count as on it: 6.2832 is 2π, not a bit more. */
const ON_TICK = 1e-3;

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
  return [tidy(Math.floor(lo / step + ON_TICK) * step - step), tidy(Math.ceil(hi / step - ON_TICK) * step + step)];
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
 * What a reader looks for on a graph, within the usual window: its roots,
 * turning points and crossing with the y axis.
 */
function features(g: FunctionGraph): { x: number; y: number }[] {
  const look = { expr: g.expr, domain: DEFAULT_PLOT_WINDOW.x, range: FEATURE_RANGE };
  return (["root", "extremum", "yAxis"] as const).flatMap((f) => notablePoints(look, f));
}

/** Points that sit on a graph drawn over the axes' x: on it, at its roots or turning points, or where it crosses something. */
function pointsOnFollowing(doc: FigureDoc, axes: Axes): Set<Id> {
  const following = new Set(doc.elements.filter((e) => e.type === "function" && sameInterval(e.domain, axes.x)).map((e) => e.id));
  const out = new Set<Id>();
  if (following.size === 0) return out;
  for (const el of doc.elements) {
    const c = el.type === "point" ? el.construction : undefined;
    if (!c) continue;
    const on =
      ((c.kind === "onGraph" || c.kind === "notable") && following.has(c.graph)) ||
      (c.kind === "intersection" && c.of.some((id) => following.has(id)));
    if (on) out.add(el.id);
  }
  return out;
}

/** Where a graph jumps across a vertical asymptote in the usual window. */
function asymptoteXs(fn: (x: number) => number): number[] {
  const [a, b] = DEFAULT_PLOT_WINDOW.x;
  const n = 400;
  const out: number[] = [];
  let prev = fn(a);
  for (let i = 1; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const y = fn(x);
    const flip = Number.isFinite(prev) && Number.isFinite(y) && Math.sign(prev) !== Math.sign(y) && Math.min(Math.abs(prev), Math.abs(y)) > 5;
    if (flip || Number.isFinite(prev) !== Number.isFinite(y)) out.push(x - (b - a) / n / 2);
    prev = y;
  }
  return out;
}

/** A found root or turning point lands a hair off a round number: put it back on. */
const settle = (v: number) => {
  const r = Math.round(v * 8) / 8;
  return Math.abs(v - r) < 0.02 ? r : v;
};

/**
 * The center the graphs are symmetric about, when they are: a mirror line
 * x = c, like a parabola's axis (y null), or a center point (c, y), like a
 * hyperbola's. The window is laid out around it, so both sides match.
 */
function symmetryCenter(graphs: FunctionGraph[]): { x: number; y: number | null } | null {
  const fns = graphs.map((g) => graphFn(g.expr)).filter((f): f is (x: number) => number => f !== null);
  if (fns.length === 0) return null;
  const candidates = [0];
  for (const g of graphs) for (const f of features(g)) candidates.push(settle(f.x));
  for (const fn of fns) for (const x of asymptoteXs(fn)) candidates.push(settle(x));
  const ts = Array.from({ length: 40 }, (_, i) => 0.1 + i * 0.1);
  // A line is symmetric about each of its points, which says nothing: only its x center counts.
  const straight = fns.every((fn) => [-2, -1, 1, 2].every((t) => Math.abs(fn(t) - fn(0) - t * (fn(1) - fn(0))) < 1e-9 * (1 + Math.abs(fn(t)))));
  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * (1 + Math.abs(a) + Math.abs(b));
  for (const c of [...new Set(candidates)].sort((a, b) => Math.abs(a) - Math.abs(b))) {
    let mirror = true;
    let point = true;
    let k: number | null = null;
    let seen = 0;
    for (const fn of fns) {
      for (const t of ts) {
        const l = fn(c - t);
        const r = fn(c + t);
        if (!Number.isFinite(l) && !Number.isFinite(r)) continue;
        if (!Number.isFinite(l) || !Number.isFinite(r)) {
          mirror = point = false;
          break;
        }
        seen++;
        if (!close(l, r)) mirror = false;
        const mid = (l + r) / 2;
        if (k === null) k = mid;
        else if (!close(k, mid)) point = false;
      }
    }
    if (seen < 10) continue;
    if (mirror) return { x: c, y: null };
    if (point && k !== null) return { x: c, y: straight ? null : k };
  }
  return null;
}

/** The window's shape on paper, width over height: 4:3, or a square for what stands taller. */
const WIDE = 4 / 3;
/** Share of a curve, by height, that decides how tall the window is: the far arms past it are cut. */
const CORE = 0.7;
/** Content under this share of a 4:3 window's height stretches y; over this many widths, y shrinks. */
const FLAT = 1 / 3;
const STEEP = 2;
/** Scales y may take, in cm per unit, when the fit sets it. */
const Y_SCALES = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 3, 4, 5, 10];

/** The fitted window. `unitY` is the y scale the fit picked, or null when y keeps the scale it has. */
export type AxesFit = Pick<Axes, "x" | "y" | "step" | "yStep"> & { unitY: number | null };

/**
 * Shapes that a stretched y would bend: circles into ellipses, angles out of
 * true. A segment along a number line (both ends in `skip`), like an interval, lies flat and can't bend.
 */
function hasShapes(doc: FigureDoc, skip: Set<Id>): boolean {
  return doc.elements.some(
    (e) =>
      e.type === "circle" ||
      e.type === "polygon" ||
      e.type === "angle" ||
      e.type === "vector" ||
      (e.type === "segment" && !(skip.has(e.a) && skip.has(e.b))),
  );
}

/**
 * The window and steps that fit everything but the axes themselves, grids and
 * number lines.
 *
 * x takes the geometry with a tick of room. A graph drawn over the axes' x
 * gets a window centered on its symmetry (a parabola's axis, a hyperbola's
 * center), or else on what it shows, reaching its roots, turning points and y
 * crossing; so both sides of it match. Then the window takes a common shape,
 * 4:3, or a square for taller content. A curve that runs past it is cut where
 * the most of it shows. One that would sit flat (a sine, a bell curve) or
 * shoot past (x³) gets its own y scale, when nothing in the figure would bend.
 */
export function fitAxesWindow(doc: FigureDoc, axes: Axes): AxesFit {
  const skip = onNumberLines(doc);
  const xs = new Span();
  const ys = new Span();
  const pts = pointMap(doc);
  /** Graphs drawn over the axes' x: their x is whatever the axes show, so they only count in y. */
  const following: FunctionGraph[] = [];
  /** Graphs over a domain of their own, which counts like geometry. */
  const own: FunctionGraph[] = [];
  const onFollowing = pointsOnFollowing(doc, axes);
  /** y of points on those graphs: inside the window, but with no room of their own, which would stretch it. */
  const onCurve = new Span();

  for (const el of doc.elements) {
    switch (el.type) {
      case "point":
      case "text":
        if (skip.has(el.id)) break;
        // A tangent's end that fills the window sits on its edge: counting it would push the window out.
        if (el.type === "point" && el.construction?.kind === "tangent" && el.construction.fill) break;
        // A point on a graph that follows the axes is inside its window already: room around it would stretch the curve.
        if (onFollowing.has(el.id)) onCurve.add(el.y);
        else {
          xs.add(el.x);
          ys.add(el.y);
        }
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
      case "function":
        if (sameInterval(el.domain, axes.x)) following.push(el);
        else {
          own.push(el);
          xs.add(el.domain[0]);
          xs.add(el.domain[1]);
        }
        break;
    }
  }

  // x: the geometry with a tick of room, and graphs over the axes' x laid out about their center.
  const pi = axes.xPi;
  const scaleX = axes.unit?.[0] ?? 1;
  const geoX: Interval | null = xs.empty ? null : [Math.min(xs.lo, 0), Math.max(xs.hi, 0)];
  const center = following.length > 0 ? symmetryCenter(following) : null;
  const marks = following.flatMap(features);
  let x: Interval;
  let step: number;
  if (following.length > 0) {
    const fx = [0, ...marks.map((m) => m.x)];
    const span = Math.max(...fx) - Math.min(...fx);
    step = pi ? axes.step : niceStep(Math.max(span, MIN_GRAPH_WIDTH), scaleX);
    const stepX = pi ? pi * Math.PI : step;
    // With no symmetry, the middle of what it shows, on a tick.
    const c = center?.x ?? Math.round((Math.min(...fx) + Math.max(...fx)) / 2 / stepX) * stepX;
    const reach = Math.max(...fx.map((v) => Math.abs(v - c)));
    const half = Math.max(Math.ceil((reach + stepX) / stepX - ON_TICK), Math.ceil(MIN_GRAPH_WIDTH / 2 / stepX - ON_TICK)) * stepX;
    x = [tidy(c - half), tidy(c + half)];
    // Geometry past the graphs' window gets its tick of room, on its side only.
    if (geoX) {
      const room = withRoom(geoX, stepX);
      x = [geoX[0] < x[0] ? room[0] : x[0], geoX[1] > x[1] ? room[1] : x[1]];
    }
  } else {
    step = pi ? axes.step : niceStep(geoX ? geoX[1] - geoX[0] : 0, scaleX);
    x = geoX ? withRoom(geoX, pi ? pi * Math.PI : step) : [...DEFAULT_PLOT_WINDOW.x];
  }
  if (pi) x = piWindow(x, pi);
  // Empty axes: the usual window, and a y scale the fit had picked goes back to 1.
  if (!geoX && following.length === 0 && ys.empty) {
    return { x, y: [...DEFAULT_PLOT_WINDOW.y], step, yStep: undefined, unitY: !axes.unit || axes.fitUnit ? 1 : null };
  }

  // y: what must show (the x axis, geometry, turning points, a center of symmetry), then the curves.
  const must = new Span();
  must.add(0);
  if (!ys.empty) {
    must.add(ys.lo);
    must.add(ys.hi);
  }
  for (const m of marks) if (m.x >= x[0] && m.x <= x[1]) must.add(m.y);
  if (center && center.y !== null) must.add(center.y);
  const samples: number[] = [];
  for (const g of following) samples.push(...curveValues(g, x, axes));
  for (const g of own) samples.push(...curveValues(g, g.domain, axes));
  samples.sort((a, b) => a - b);
  const core = new Span();
  core.add(must.lo);
  core.add(must.hi);
  if (samples.length > 0) {
    core.add(samples[Math.floor(((1 - CORE) / 2) * (samples.length - 1))]);
    core.add(samples[Math.ceil(((1 + CORE) / 2) * (samples.length - 1))]);
  }

  // The y scale: the axes' own, or one the fit picks when a curve would sit flat or shoot past.
  const width = (x[1] - x[0]) * scaleX;
  // The fit owns y when no scale was set by hand. It stretches y only when nothing would bend, unless the axes allow it.
  const ownsY = !axes.unit || !!axes.fitUnit;
  const canScale = ownsY && (!!axes.scaleShapes || !hasShapes(doc, skip)) && samples.length > 0;
  const coreH = Math.max(core.hi - core.lo, 1e-9);
  let scaleY = ownsY ? 1 : (axes.unit?.[1] ?? 1);
  if (canScale && coreH < (width / WIDE) * FLAT) {
    // The most stretch that still fits 4:3 with a tick of room on each side.
    scaleY = Math.max(1, ...Y_SCALES.filter((s) => s * (coreH + 2 * niceStep(coreH, s)) <= width / WIDE));
  } else if (canScale && coreH > width * STEEP) {
    scaleY = Math.max(Y_SCALES[0], ...Y_SCALES.filter((s) => s < 1 && s * coreH <= width * 0.9));
  }

  const roughStep = niceStep(coreH, scaleY);
  const need: Interval = [Math.min(must.lo - roughStep, onCurve.lo), Math.max(must.hi + roughStep, onCurve.hi)];
  const content: Interval = [Math.min(core.lo - roughStep / 2, need[0]), Math.max(core.hi + roughStep / 2, need[1])];

  /** y for a window this wide on paper: 4:3 when the content fits it with room, a square otherwise. */
  const place = (width: number): { y: Interval; yStep: number } => {
    // A curve with a center (a hyperbola's) needs as much room on each side of it.
    const c = center?.y ?? null;
    const box: Interval = c === null ? content : [Math.min(content[0], 2 * c - content[1]), Math.max(content[1], 2 * c - content[0])];
    const tall = (box[1] - box[0]) * scaleY > width / WIDE;
    const height = (tall ? width : width / WIDE) / scaleY;
    // Same scale on both axes: y counts like x, unless that crowds it.
    const yStep = !pi && scaleY === scaleX && height / step <= MAX_TICKS ? step : niceStep(height, scaleY);
    let y: Interval;
    if (box[1] - box[0] <= height) {
      // Room to spare: centered on the curve's center when it has one, or on the content.
      if (c !== null) y = [c - height / 2, c + height / 2];
      else {
        // Centered, with the ends on ticks when they can be: of the two ticks, the one that shows more of the curves.
        const lo = (content[0] + content[1]) / 2 - height / 2;
        // Half a tick of room is enough once the ends sit on ticks.
        const shows = (t: number) =>
          t <= Math.min(must.lo - roughStep / 2, onCurve.lo) + 1e-9 && t + height >= Math.max(must.hi + roughStep / 2, onCurve.hi) - 1e-9;
        const shown = (t: number) => samples.filter((v) => v >= t && v <= t + height).length;
        const near = [Math.ceil(lo / yStep - ON_TICK) * yStep, Math.floor(lo / yStep + ON_TICK) * yStep].filter(shows);
        const t = near.length > 0 ? near.reduce((a, b) => (shown(b) > shown(a) ? b : a)) : lo;
        y = [t, t + height];
      }
    } else if (need[1] - need[0] >= height) {
      // What must show doesn't fit the shape: it shows anyway.
      y = need;
    } else {
      // A curve taller than the window: the cut that keeps the most of it, with what must show.
      const lowest = need[1] - height;
      const target = center?.y ?? (need[0] + need[1]) / 2;
      let best = { lo: lowest, count: -1, off: Infinity };
      for (let i = 0; i <= 60; i++) {
        const lo = lowest + ((need[0] - lowest) * i) / 60;
        const count = samples.filter((v) => v >= lo && v <= lo + height).length;
        const off = Math.abs(lo + height / 2 - target);
        if (count > best.count || (count === best.count && off < best.off)) best = { lo, count, off };
      }
      // The bottom on the tick next to the best cut that shows the most, when one still shows what must.
      const shown = (lo: number) => samples.filter((v) => v >= lo && v <= lo + height).length;
      const ticks = [Math.ceil(best.lo / yStep - ON_TICK) * yStep, Math.floor(best.lo / yStep + ON_TICK) * yStep].filter(
        (t) => t >= lowest - 1e-9 && t <= need[0] + 1e-9,
      );
      const lo = ticks.length > 0 ? ticks.reduce((a, b) => (shown(b) > shown(a) ? b : a)) : best.lo;
      y = [lo, lo + height];
    }
    return { y, yStep };
  };

  let { y, yStep } = place(width);
  // What must show stood taller than a square: x widens evenly, out to ticks, and y takes the new width.
  const over = ((y[1] - y[0]) * scaleY - width) / scaleX / 2;
  if (over > 1e-9) {
    const stepX = pi ? pi * Math.PI : step;
    const pad = Math.ceil(over / stepX - ON_TICK) * stepX;
    x = [tidy(x[0] - pad), tidy(x[1] + pad)];
    ({ y, yStep } = place((x[1] - x[0]) * scaleX));
  }
  return { x, y: [tidy(y[0]), tidy(y[1])], step, yStep: yStep === step ? undefined : yStep, unitY: ownsY ? scaleY : null };
}

/** A graph's y over [a, b], inside its own y cut when it has one. */
function curveValues(g: FunctionGraph, over: Interval, axes: Axes): number[] {
  const own = !sameInterval(g.range, axes.y);
  return sampleValues(g, over).filter((v) => !own || (v >= g.range[0] && v <= g.range[1]));
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
      case "board":
        add(el.x, el.y);
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

/** The scale fitted axes take: the y the fit picked, with x as it was. Undefined is the plain 1 and 1. */
function fittedUnit(axes: Axes, unitY: number | null): [number, number] | undefined {
  if (unitY === null) return axes.unit;
  const x = axes.unit?.[0] ?? 1;
  return x === 1 && unitY === 1 ? undefined : [x, unitY];
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
    const unit = fittedUnit(axes, w.unitY);
    const sameUnit = unit === undefined ? !axes.unit : !!axes.unit && axes.unit[0] === unit[0] && axes.unit[1] === unit[1];
    if (sameInterval(w.x, axes.x) && sameInterval(w.y, axes.y) && w.step === axes.step && w.yStep === axes.yStep && sameUnit) continue;
    const windowed = sameInterval(w.x, axes.x) && sameInterval(w.y, axes.y) ? out : setAxesWindow(out, axes.id, w.x, w.y).doc;
    out = withElements(
      windowed,
      windowed.elements.map((e): Element => {
        if (e.id !== axes.id || e.type !== "axes") return e;
        const next: Axes = { ...e, step: w.step };
        if (w.yStep === undefined) delete next.yStep;
        else next.yStep = w.yStep;
        if (w.unitY !== null) {
          if (unit) next.unit = unit;
          else delete next.unit;
          if (unit && unit[1] !== 1) next.fitUnit = true;
          else delete next.fitUnit;
        }
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
