import { AXES_GRID, PT_PER_CM, resolveColor } from "./defaults";
import {
  angleArc,
  angleArcRadii,
  angleTicks,
  pointMap,
  rightAngleSquare,
  segmentTicks,
  type OffsetLine,
} from "./geometry";
import {
  estimateTextWidth,
  formatNumber,
  labelPlacement,
  labelRuns,
  labelText,
  measureNumber,
  measureRuns,
  type LabelRun,
} from "./labels";
import { axesOrigin, axisTicks, functionLines, gridValues } from "./plot";
import type {
  Dash,
  Element,
  ElementType,
  FigureDoc,
  Fill,
  FillPattern,
  Id,
  LabelFont,
  Point,
  Stroke,
} from "./types";
import { mid, polar, type Vec } from "./vec";

/**
 * A scene is the figure laid out on paper: coordinates in pt with Y pointing
 * down, like SVG. The editor preview and the SVG and PNG exports all draw from
 * the same scene, so what the teacher sees is what gets exported.
 */

export interface PaintStroke {
  color: string;
  width: number;
  dash: Dash;
  opacity: number;
}

export interface PaintFill {
  color: string;
  opacity: number;
  pattern: FillPattern;
  angle: number;
}

export type Prim =
  | {
      kind: "path";
      owner: Id;
      d: string;
      stroke: PaintStroke | null;
      fill: PaintFill | null;
    }
  | {
      kind: "text";
      owner: Id;
      x: number;
      y: number;
      text: string;
      size: number;
      color: string;
      /** The text split by style, italic where LaTeX math would be. */
      runs: LabelRun[];
      font: LabelFont;
    };

/** Shapes the editor uses to pick elements with the mouse. */
export type Hit =
  | { owner: Id; type: "point"; x: number; y: number; r: number }
  | { owner: Id; type: Exclude<ElementType, "point">; d: string; area: boolean };

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Scene {
  prims: Prim[];
  hits: Hit[];
  /** Bounds of everything drawn, null for an empty figure. */
  box: Box | null;
  /** Paper pt per world unit. */
  k: number;
}

export interface SceneOptions {
  /** cm per world unit. Default 1. */
  scale?: number;
}

const f = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};

class BoxBuilder {
  box: Box | null = null;
  add(x: number, y: number, pad = 0) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const b = this.box;
    if (!b) {
      this.box = { minX: x - pad, minY: y - pad, maxX: x + pad, maxY: y + pad };
      return;
    }
    b.minX = Math.min(b.minX, x - pad);
    b.minY = Math.min(b.minY, y - pad);
    b.maxX = Math.max(b.maxX, x + pad);
    b.maxY = Math.max(b.maxY, y + pad);
  }
}

export function paintStroke(s: Stroke): PaintStroke {
  return { color: resolveColor(s.color), width: s.width, dash: s.dash, opacity: s.opacity };
}

export function paintFill(fl: Fill): PaintFill {
  return { color: resolveColor(fl.color), opacity: fl.opacity, pattern: fl.pattern, angle: fl.angle };
}

/** SVG path of a full circle. */
export function circlePath(cx: number, cy: number, r: number): string {
  return (
    `M${f(cx - r)} ${f(cy)}` +
    `A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}` +
    `A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}Z`
  );
}

export function buildScene(doc: FigureDoc, options: SceneOptions = {}): Scene {
  const k = PT_PER_CM * (options.scale ?? 1);
  const pts = pointMap(doc);
  const box = new BoxBuilder();
  const layers: Record<
    "grid" | "axes" | "polygon" | "circle" | "function" | "angle" | "segment" | "point" | "label",
    Prim[]
  > = {
    grid: [],
    axes: [],
    polygon: [],
    circle: [],
    function: [],
    angle: [],
    segment: [],
    point: [],
    label: [],
  };
  const hits: Record<ElementType, Hit[]> = {
    axes: [],
    function: [],
    polygon: [],
    circle: [],
    angle: [],
    segment: [],
    point: [],
    text: [],
  };

  /** World point to paper. */
  const P = (w: Vec): Vec => ({ x: w.x * k, y: -w.y * k });
  /** Paper position of a pt offset (Y up) from a world point. */
  const O = (w: Vec, o: Vec): Vec => ({ x: w.x * k + o.x, y: -w.y * k - o.y });

  /** Arc around paper center c, counterclockwise on screen from `start` over `sweep` degrees. */
  const arc = (c: Vec, r: number, start: number, sweep: number, moveTo = true): string => {
    if (sweep >= 359.999) return circlePath(c.x, c.y, r);
    const p0 = { x: c.x + r * Math.cos((start * Math.PI) / 180), y: c.y - r * Math.sin((start * Math.PI) / 180) };
    const end = start + sweep;
    const p1 = { x: c.x + r * Math.cos((end * Math.PI) / 180), y: c.y - r * Math.sin((end * Math.PI) / 180) };
    const large = sweep > 180 ? 1 : 0;
    return `${moveTo ? `M${f(p0.x)} ${f(p0.y)}` : `L${f(p0.x)} ${f(p0.y)}`}A${f(r)} ${f(r)} 0 ${large} 0 ${f(p1.x)} ${f(p1.y)}`;
  };

  /** Includes an arc in the bounds: its ends and any axis extreme it passes. */
  const boxArc = (c: Vec, r: number, start: number, sweep: number, pad: number) => {
    const angles = [start, start + sweep];
    for (let a = Math.ceil(start / 90) * 90; a < start + sweep; a += 90) angles.push(a);
    for (const a of angles) {
      box.add(c.x + r * Math.cos((a * Math.PI) / 180), c.y - r * Math.sin((a * Math.PI) / 180), pad);
    }
  };

  const offsetLines = (w: Vec, lines: OffsetLine[]): string =>
    lines
      .map((l) => {
        const a = O(w, l.from);
        const b = O(w, l.to);
        box.add(a.x, a.y);
        box.add(b.x, b.y);
        return `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`;
      })
      .join("");

  const solid = (s: PaintStroke): PaintStroke => ({ ...s, dash: "solid" });

  for (const el of doc.elements) {
    switch (el.type) {
      case "point": {
        const c = P(el);
        if (el.shape !== "none") {
          const color = resolveColor(el.color);
          const ring = el.shape === "ring";
          layers.point.push({
            kind: "path",
            owner: el.id,
            d: circlePath(c.x, c.y, el.size),
            fill: { color: ring ? "#ffffff" : color, opacity: 1, pattern: "solid", angle: 0 },
            stroke: ring ? { color, width: 0.6, dash: "solid", opacity: 1 } : null,
          });
          box.add(c.x, c.y, el.size + 0.3);
        } else {
          box.add(c.x, c.y);
        }
        hits.point.push({ owner: el.id, type: "point", x: c.x, y: c.y, r: el.size });
        break;
      }
      case "segment": {
        const a = pts.get(el.a);
        const b = pts.get(el.b);
        if (!a || !b) break;
        const pa = P(a);
        const pb = P(b);
        const d = `M${f(pa.x)} ${f(pa.y)}L${f(pb.x)} ${f(pb.y)}`;
        const stroke = paintStroke(el.stroke);
        layers.segment.push({ kind: "path", owner: el.id, d, stroke, fill: null });
        if (el.ticks > 0) {
          layers.segment.push({
            kind: "path",
            owner: el.id,
            // Tick offsets are relative to the midpoint, like in the TikZ export.
            d: offsetLines(mid(a, b), segmentTicks(a, b, el.ticks)),
            stroke: solid(stroke),
            fill: null,
          });
        }
        box.add(pa.x, pa.y, stroke.width / 2);
        box.add(pb.x, pb.y, stroke.width / 2);
        hits.segment.push({ owner: el.id, type: "segment", d, area: false });
        break;
      }
      case "angle": {
        const a = pts.get(el.a);
        const v = pts.get(el.vertex);
        const b = pts.get(el.b);
        const geo = a && v && b ? angleArc(a, v, b, el.reflex) : null;
        if (!v || !geo) break;
        const c = P(v);
        const stroke = paintStroke(el.stroke);
        const square = el.rightMark && geo.isRight;
        let fillD: string;
        let strokeD: string;
        if (square) {
          const [u1, corner, u2] = rightAngleSquare(geo, el.radius).map((o) => O(v, o));
          strokeD = `M${f(u1.x)} ${f(u1.y)}L${f(corner.x)} ${f(corner.y)}L${f(u2.x)} ${f(u2.y)}`;
          fillD = `M${f(c.x)} ${f(c.y)}L${f(u1.x)} ${f(u1.y)}L${f(corner.x)} ${f(corner.y)}L${f(u2.x)} ${f(u2.y)}Z`;
          for (const p of [u1, corner, u2]) box.add(p.x, p.y, stroke.width);
        } else {
          const radii = angleArcRadii(el);
          strokeD = radii.map((r) => arc(c, r, geo.start, geo.sweep)).join("");
          fillD = `M${f(c.x)} ${f(c.y)}${arc(c, el.radius, geo.start, geo.sweep, false)}Z`;
          boxArc(c, radii[radii.length - 1], geo.start, geo.sweep, stroke.width);
        }
        box.add(c.x, c.y);
        if (el.fill) {
          layers.angle.push({ kind: "path", owner: el.id, d: fillD, stroke: null, fill: paintFill(el.fill) });
        }
        layers.angle.push({ kind: "path", owner: el.id, d: strokeD, stroke, fill: null });
        if (square) {
          // Brazilian textbooks mark right angles with a dot inside the square.
          const dot = O(v, polar(el.radius * 0.35 * Math.SQRT2, geo.start + 45));
          layers.angle.push({
            kind: "path",
            owner: el.id,
            d: circlePath(dot.x, dot.y, Math.max(0.7, stroke.width)),
            stroke: null,
            fill: { color: stroke.color, opacity: stroke.opacity, pattern: "solid", angle: 0 },
          });
        } else if (el.ticks > 0) {
          layers.angle.push({
            kind: "path",
            owner: el.id,
            d: offsetLines(v, angleTicks(geo, el.radius, el.ticks)),
            stroke: solid(stroke),
            fill: null,
          });
        }
        hits.angle.push({ owner: el.id, type: "angle", d: fillD, area: true });
        break;
      }
      case "circle": {
        const center = pts.get(el.center);
        if (!center) break;
        const c = P(center);
        const r = el.radius * k;
        const stroke = paintStroke(el.stroke);
        const start = el.arc?.start ?? 0;
        const sweep = el.arc ? ((el.arc.end - el.arc.start) % 360 + 360) % 360 || 360 : 360;
        const outline = arc(c, r, start, sweep);
        if (el.fill) {
          const d = sweep >= 359.999 ? outline : `M${f(c.x)} ${f(c.y)}${arc(c, r, start, sweep, false)}Z`;
          layers.circle.push({ kind: "path", owner: el.id, d, stroke: null, fill: paintFill(el.fill) });
        }
        layers.circle.push({ kind: "path", owner: el.id, d: outline, stroke, fill: null });
        if (el.radii && sweep < 359.999) {
          const p0 = O(center, polar(r, start));
          const p1 = O(center, polar(r, start + sweep));
          layers.circle.push({
            kind: "path",
            owner: el.id,
            d: `M${f(p0.x)} ${f(p0.y)}L${f(c.x)} ${f(c.y)}L${f(p1.x)} ${f(p1.y)}`,
            stroke,
            fill: null,
          });
          box.add(c.x, c.y);
        }
        boxArc(c, r, start, sweep, stroke.width / 2);
        hits.circle.push({ owner: el.id, type: "circle", d: outline, area: false });
        break;
      }
      case "polygon": {
        const vs = el.vertices.map((id) => pts.get(id)).filter((p): p is Point => !!p);
        if (vs.length < 3) break;
        const d =
          vs
            .map((p, i) => {
              const q = P(p);
              box.add(q.x, q.y, el.stroke ? el.stroke.width / 2 : 0);
              return `${i === 0 ? "M" : "L"}${f(q.x)} ${f(q.y)}`;
            })
            .join("") + "Z";
        layers.polygon.push({
          kind: "path",
          owner: el.id,
          d,
          stroke: el.stroke ? paintStroke(el.stroke) : null,
          fill: el.fill ? paintFill(el.fill) : null,
        });
        hits.polygon.push({ owner: el.id, type: "polygon", d, area: true });
        break;
      }
      case "function": {
        const stroke = paintStroke(el.stroke);
        const d = functionLines(el)
          .map((line) =>
            line
              .map((w, i) => {
                const p = P(w);
                box.add(p.x, p.y, stroke.width / 2);
                return `${i === 0 ? "M" : "L"}${f(p.x)} ${f(p.y)}`;
              })
              .join(""),
          )
          .join("");
        if (!d) break;
        layers.function.push({ kind: "path", owner: el.id, d, stroke, fill: null });
        hits.function.push({ owner: el.id, type: "function", d, area: false });
        break;
      }
      case "axes": {
        const stroke = paintStroke(el.stroke);
        const o = axesOrigin(el);
        const xs = axisTicks(el.x, el.step, o.x);
        const ys = axisTicks(el.y, el.step, o.y);
        if (el.grid) {
          const lines = gridValues(el.x, el.step)
            .map((x) => `M${f(x * k)} ${f(-el.y[0] * k)}L${f(x * k)} ${f(-el.y[1] * k)}`)
            .concat(gridValues(el.y, el.step).map((y) => `M${f(el.x[0] * k)} ${f(-y * k)}L${f(el.x[1] * k)} ${f(-y * k)}`))
            .join("");
          layers.grid.push({ kind: "path", owner: el.id, d: lines, stroke: paintStroke(AXES_GRID), fill: null });
        }
        const x0 = P({ x: el.x[0], y: o.y });
        const x1 = P({ x: el.x[1], y: o.y });
        const y0 = P({ x: o.x, y: el.y[0] });
        const y1 = P({ x: o.x, y: el.y[1] });
        const d = `M${f(x0.x)} ${f(x0.y)}L${f(x1.x)} ${f(x1.y)}M${f(y0.x)} ${f(y0.y)}L${f(y1.x)} ${f(y1.y)}`;
        layers.axes.push({ kind: "path", owner: el.id, d, stroke, fill: null });
        // Arrowheads at the positive ends, as textbooks draw them.
        const head = (tip: Vec, dx: number, dy: number) => {
          const len = 4 + stroke.width * 2;
          const half = len * 0.4;
          const back = { x: tip.x - dx * len, y: tip.y - dy * len };
          return `M${f(tip.x)} ${f(tip.y)}L${f(back.x - dy * half)} ${f(back.y + dx * half)}L${f(back.x + dy * half)} ${f(back.y - dx * half)}Z`;
        };
        layers.axes.push({
          kind: "path",
          owner: el.id,
          d: head(x1, 1, 0) + head(y1, 0, -1),
          stroke: null,
          fill: { color: stroke.color, opacity: stroke.opacity, pattern: "solid", angle: 0 },
        });
        const tick = 2.5;
        const tickD =
          xs.map((x) => `M${f(x * k)} ${f(x0.y - tick)}L${f(x * k)} ${f(x0.y + tick)}`).join("") +
          ys.map((y) => `M${f(y0.x - tick)} ${f(-y * k)}L${f(y0.x + tick)} ${f(-y * k)}`).join("");
        if (tickD) layers.axes.push({ kind: "path", owner: el.id, d: tickD, stroke: { ...stroke, dash: "solid" }, fill: null });
        for (const p of [x0, x1, y0, y1]) box.add(p.x, p.y, tick);
        const text = (s: string, at: Vec) =>
          textRect(layers.label, el.id, at, s, labelRuns(s, "serif"), el.size, el.stroke.color, "serif", box);
        if (el.numbers) {
          const gap = el.size * 0.9;
          for (const x of xs) text(formatNumber(x), { x: x * k, y: x0.y + tick + gap * 0.7 });
          for (const y of ys) {
            const s = formatNumber(y);
            text(s, { x: y0.x - tick - 2 - estimateTextWidth(s, el.size) / 2, y: -y * k });
          }
        }
        const [xName, yName] = el.names;
        if (xName) text(xName, { x: x1.x + 2, y: x1.y + el.size });
        if (yName) text(yName, { x: y1.x + el.size * 0.9, y: y1.y });
        hits.axes.push({ owner: el.id, type: "axes", d, area: false });
        break;
      }
      case "text": {
        const at = P(el);
        const r = textRect(layers.label, el.id, at, el.text, labelRuns(el.text, el.font), el.size, el.color, el.font, box);
        hits.text.push({
          owner: el.id,
          type: "text",
          d: `M${f(r.minX)} ${f(r.minY)}H${f(r.maxX)}V${f(r.maxY)}H${f(r.minX)}Z`,
          area: true,
        });
        break;
      }
    }
    addLabel(doc, el, layers.label, box, O);
  }

  return {
    prims: [
      ...layers.grid,
      ...layers.axes,
      ...layers.polygon,
      ...layers.circle,
      ...layers.function,
      ...layers.angle,
      ...layers.segment,
      ...layers.point,
      ...layers.label,
    ],
    hits: [
      ...hits.axes,
      ...hits.polygon,
      ...hits.circle,
      ...hits.function,
      ...hits.angle,
      ...hits.segment,
      ...hits.text,
      ...hits.point,
    ],
    box: box.box,
    k,
  };
}

function addLabel(
  doc: FigureDoc,
  el: Element,
  out: Prim[],
  box: BoxBuilder,
  O: (w: Vec, o: Vec) => Vec,
) {
  if (el.type === "text" || el.type === "axes") return;
  const placement = labelPlacement(doc, el);
  if (!placement || !el.label) return;
  const { size, color, font, measure } = el.label;
  const text = labelText(doc, el);
  const number = measure ? measureNumber(doc, el, measure) : null;
  const runs = measure && number !== null ? measureRuns(measure, number, font) : labelRuns(text, font);
  textRect(out, el.id, O(placement.anchor, placement.offset), text, runs, size, color, font, box);
}

/** Draws text centered on a paper point and returns the box it takes. */
function textRect(
  out: Prim[],
  owner: Id,
  at: Vec,
  text: string,
  runs: LabelRun[],
  size: number,
  color: string,
  font: LabelFont,
  box: BoxBuilder,
): Box {
  out.push({
    kind: "text",
    owner,
    x: at.x,
    y: at.y,
    text,
    size,
    color: resolveColor(color),
    runs,
    font,
  });
  const w = estimateTextWidth(text, size) / 2;
  const r = { minX: at.x - w, minY: at.y - size * 0.6, maxX: at.x + w, maxY: at.y + size * 0.6 };
  box.add(r.minX, r.minY);
  box.add(r.maxX, r.maxY);
  return r;
}
