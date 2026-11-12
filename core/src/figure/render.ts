import { PT_PER_CM, resolveColor } from "./defaults";
import { gridWindow } from "./fit";
import {
  angleArc,
  angleArcRadii,
  angleTicks,
  extensionEnds,
  pointMap,
  rightAngleSquare,
  segmentTicks,
  type OffsetLine,
} from "./geometry";
import {
  estimateTextWidth,
  formatNumber,
  labelPlacement,
  canHaveLabel,
  labelRuns,
  labelText,
  measureNumber,
  measureRuns,
  vectorNameSpans,
  type LabelRun,
} from "./labels";
import { boardLayout, boardSlots, layoutMath, type Mark, type MathPart } from "./board";
import { studyLayout, type StudyHit } from "./study";
import { circuitDrawings, componentDrawing } from "./circuit";
import { regionOutline, vennItemSpots, type RegionEdge } from "./sets";
import { grow, LineIndex, overlap, pathLines, textBox } from "./lines";
import {
  axesOrigin,
  axesStepX,
  axesStepY,
  axisTicks,
  figureUnits,
  endDotRadius,
  functionEnds,
  functionLines,
  gridValues,
  pointGuides,
  xTickShift,
  xTickText,
} from "./plot";
import type {
  Axes,
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
import { add, mid, polar, scale, type Vec } from "./vec";

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
  /** Paper pt per cm of the figure: the export scale. */
  k: number;
  /** Paper pt per world unit along x and y: k times each axis' scale. */
  kx: number;
  ky: number;
  /** Where each axis number went, by axes id: TikZ writes them in the same spots. */
  numberSpots: Map<Id, AxisNumberSpots>;
  /** The results of each "gaps" board, in scene pt, for picking its gaps in the preview. */
  boardSlots: SceneSlot[];
  /** Each place a piece of a study shows, for picking the piece in the preview. */
  parts: ScenePart[];
  /** Where the points and stretches of each study are, for dragging and adding points in the preview. */
  studies: SceneStudy[];
}

/** A piece of an element, as a shape in the scene to pick it by. A piece may show in more than one place. */
export interface ScenePart {
  owner: Id;
  path: string;
  d: string;
  area: boolean;
  /** A piece with a text to type and none yet. */
  empty: boolean;
  /** Where its text is, for typing over it. */
  text?: { x: number; y: number; w: number; h: number };
}

/** A study's points (with the bottom of their dividers) and stretch middles, in scene pt. */
export interface SceneStudy {
  owner: Id;
  points: { id: Id; x: number; y: number; bottom: number | null }[];
  stretches: { index: number; x: number; y: number }[];
}

/** A result a board can leave as a gap, as a rectangle in the scene. */
export interface SceneSlot {
  owner: Id;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  gap: boolean;
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

/** SVG path of a full circle, or of an ellipse when `ry` differs. */
export function circlePath(cx: number, cy: number, r: number, ry = r): string {
  return (
    `M${f(cx - r)} ${f(cy)}` +
    `A${f(r)} ${f(ry)} 0 1 0 ${f(cx + r)} ${f(cy)}` +
    `A${f(r)} ${f(ry)} 0 1 0 ${f(cx - r)} ${f(cy)}Z`
  );
}

/** How wide an open arrowhead opens, as a share of its length on each side. */
export const OPEN_HEAD = 0.5;

/**
 * An open arrowhead: two strokes from the tip back to either side of `back`.
 * Axes and number lines have it; vectors keep a filled head, so the two never look alike.
 */
function openHead(tip: Vec, back: Vec, dir: Vec, half: number): string {
  return (
    `M${f(back.x - dir.y * half)} ${f(back.y + dir.x * half)}L${f(tip.x)} ${f(tip.y)}L${f(back.x + dir.y * half)} ${f(back.y - dir.x * half)}` +
    `M${f(back.x)} ${f(back.y)}L${f(tip.x)} ${f(tip.y)}`
  );
}

export function buildScene(doc: FigureDoc, options: SceneOptions = {}): Scene {
  const k = PT_PER_CM * (options.scale ?? 1);
  // Axes with their own scale stretch the whole figure, so graphs and geometry stay on one plane.
  const unit = figureUnits(doc);
  const kx = k * unit.x;
  const ky = k * unit.y;
  /** A world point as it lies on paper, before the pt conversion: directions there are what shows. */
  const S = (w: Vec): Vec => ({ x: w.x * unit.x, y: w.y * unit.y });
  const pts = pointMap(doc);
  const box = new BoxBuilder();
  const layers: Record<
    "grid" | "axes" | "guide" | "polygon" | "region" | "circle" | "function" | "angle" | "segment" | "board" | "point" | "label",
    Prim[]
  > = {
    grid: [],
    axes: [],
    guide: [],
    polygon: [],
    region: [],
    circle: [],
    function: [],
    angle: [],
    segment: [],
    board: [],
    point: [],
    label: [],
  };
  const axisNumbers: { el: Axes; x: AxisNumber[]; y: AxisNumber[] }[] = [];
  const slots: SceneSlot[] = [];
  const parts: ScenePart[] = [];
  const studies: SceneStudy[] = [];
  const hits: Record<ElementType, Hit[]> = {
    axes: [],
    grid: [],
    numberline: [],
    function: [],
    vline: [],
    polygon: [],
    region: [],
    circle: [],
    angle: [],
    segment: [],
    vector: [],
    extension: [],
    board: [],
    study: [],
    vennitems: [],
    component: [],
    circuit: [],
    point: [],
    text: [],
  };

  /** World point to paper. */
  const P = (w: Vec): Vec => ({ x: w.x * kx, y: -w.y * ky });
  /** Paper position of a pt offset (Y up) from a world point. */
  const O = (w: Vec, o: Vec): Vec => ({ x: w.x * kx + o.x, y: -w.y * ky - o.y });

  /**
   * Arc around paper center c, counterclockwise on screen from `start` over
   * `sweep` degrees. With `ry`, an arc of an ellipse, the angles being where a
   * circle's would be before the axes stretched it.
   */
  const arc = (c: Vec, r: number, start: number, sweep: number, moveTo = true, ry = r): string => {
    if (sweep >= 359.999) return circlePath(c.x, c.y, r, ry);
    const p0 = { x: c.x + r * Math.cos((start * Math.PI) / 180), y: c.y - ry * Math.sin((start * Math.PI) / 180) };
    const end = start + sweep;
    const p1 = { x: c.x + r * Math.cos((end * Math.PI) / 180), y: c.y - ry * Math.sin((end * Math.PI) / 180) };
    const large = sweep > 180 ? 1 : 0;
    return `${moveTo ? `M${f(p0.x)} ${f(p0.y)}` : `L${f(p0.x)} ${f(p0.y)}`}A${f(r)} ${f(ry)} 0 ${large} 0 ${f(p1.x)} ${f(p1.y)}`;
  };

  /** Includes an arc in the bounds: its ends and any axis extreme it passes. */
  const boxArc = (c: Vec, r: number, start: number, sweep: number, pad: number, ry = r) => {
    const angles = [start, start + sweep];
    for (let a = Math.ceil(start / 90) * 90; a < start + sweep; a += 90) angles.push(a);
    for (const a of angles) {
      box.add(c.x + r * Math.cos((a * Math.PI) / 180), c.y - ry * Math.sin((a * Math.PI) / 180), pad);
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

  /**
   * Draws board marks, given in pt with Y up, through T onto paper. Boards
   * and circuit pieces both draw this way, as their TikZ does.
   */
  const drawMarks = (owner: Id, marks: Mark[], T: (o: Vec) => Vec, look: MarkLook, layer: Prim[], bounds: boolean) => {
    const color = resolveColor(look.color);
    const lineStroke = (width?: number, dash?: Dash): PaintStroke => ({ color, width: width ?? look.width, dash: dash ?? "solid", opacity: look.opacity });
    const solidFill: PaintFill = { color, opacity: look.opacity, pattern: "solid", angle: 0 };
    const path = (d: string, stroke: PaintStroke | null, fillWith: PaintFill | null) => layer.push({ kind: "path", owner, d, stroke, fill: fillWith });
    const reach = (p: Vec, pad = 0) => {
      if (bounds) box.add(p.x, p.y, pad);
    };
    const writePart = (part: MathPart, origin: Vec) => {
      if (part.kind === "line") {
        const [a, b] = [T({ x: origin.x + part.a.x, y: origin.y + part.a.y }), T({ x: origin.x + part.b.x, y: origin.y + part.b.y })];
        path(`M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`, lineStroke(Math.min(look.width, 0.6)), null);
        return;
      }
      const at = T({ x: origin.x + part.x, y: origin.y + part.y });
      // Words stay upright; inside math, letters go italic as in LaTeX.
      const runs = part.word ? [{ text: part.text, italic: false }] : labelRuns(part.text, look.font);
      textRect(layer, owner, at, part.text, runs, part.size, look.color, look.font, bounds ? box : new BoxBuilder());
    };
    for (const m of marks) {
      switch (m.kind) {
        case "line": {
          const [a, b] = [T(m.a), T(m.b)];
          path(`M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`, lineStroke(m.width, m.dash), null);
          reach(a, (m.width ?? look.width) / 2);
          reach(b, (m.width ?? look.width) / 2);
          break;
        }
        case "curve": {
          const d = m.points.map((p, i) => `${i === 0 ? "M" : "L"}${f(T(p).x)} ${f(T(p).y)}`).join("");
          path(d, lineStroke(m.width, m.dash), null);
          for (const p of m.points) reach(T(p), (m.width ?? look.width) / 2);
          break;
        }
        case "text": {
          const b = layoutMath(m.node, m.size);
          for (const part of b.parts) writePart(part, { x: m.at.x - b.w / 2, y: m.at.y });
          break;
        }
        case "dot": {
          const c = T(m.at);
          path(circlePath(c.x, c.y, m.r), m.open ? lineStroke(0.7) : null, m.open ? { ...solidFill, color: "#ffffff" } : solidFill);
          reach(c, m.r + 0.4);
          break;
        }
        case "ring": {
          const c = T(m.at);
          path(circlePath(c.x, c.y, m.r), lineStroke(m.width ?? 0.6), null);
          reach(c, m.r + (m.width ?? 0.6) / 2);
          break;
        }
        case "head": {
          const c = T(m.tip);
          const dir = { x: m.dir.x, y: -m.dir.y };
          const back = { x: c.x - dir.x * m.length, y: c.y - dir.y * m.length };
          if (m.open) {
            const half = m.length * OPEN_HEAD;
            path(openHead(c, back, dir, half), lineStroke(0.6), null);
            reach(c, half);
            break;
          }
          const half = m.length * 0.4;
          path(`M${f(c.x)} ${f(c.y)}L${f(back.x - dir.y * half)} ${f(back.y + dir.x * half)}L${f(back.x + dir.y * half)} ${f(back.y - dir.x * half)}Z`, null, solidFill);
          reach(c, half);
          break;
        }
        case "box": {
          const a = T({ x: m.at.x - m.w / 2, y: m.at.y + m.h / 2 });
          path(`M${f(a.x)} ${f(a.y)}h${f(m.w)}v${f(m.h)}h${f(-m.w)}Z`, lineStroke(0.5), null);
          reach(a);
          reach({ x: a.x + m.w, y: a.y + m.h });
          break;
        }
      }
    }
  };

  const solid = (s: PaintStroke): PaintStroke => ({ ...s, dash: "solid" });
  const axes = doc.elements.find((e): e is Axes => e.type === "axes");

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
        if (el.guides && axes) {
          const d = pointGuides(el, axes)
            .map(([a, b]) => {
              const pa = P(a);
              const pb = P(b);
              box.add(pb.x, pb.y);
              return `M${f(pa.x)} ${f(pa.y)}L${f(pb.x)} ${f(pb.y)}`;
            })
            .join("");
          if (d) layers.guide.push({ kind: "path", owner: el.id, d, stroke: paintStroke(el.guides), fill: null });
        }
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
            d: offsetLines(mid(a, b), segmentTicks(S(a), S(b), el.ticks)),
            stroke: solid(stroke),
            fill: null,
          });
        }
        box.add(pa.x, pa.y, stroke.width / 2);
        box.add(pb.x, pb.y, stroke.width / 2);
        hits.segment.push({ owner: el.id, type: "segment", d, area: false });
        break;
      }
      case "vector": {
        const a = pts.get(el.a);
        const b = pts.get(el.b);
        if (!a || !b) break;
        const pa = P(a);
        const pb = P(b);
        const length = Math.hypot(pb.x - pa.x, pb.y - pa.y);
        if (length === 0) break;
        const dir = { x: (pb.x - pa.x) / length, y: (pb.y - pa.y) / length };
        // A short vector keeps a head that fits it.
        const head = Math.min(el.head, length * 0.6);
        const half = head * 0.38;
        const stroke = paintStroke(el.stroke);
        const neck = { x: pb.x - dir.x * head * 0.8, y: pb.y - dir.y * head * 0.8 };
        const d = `M${f(pa.x)} ${f(pa.y)}L${f(neck.x)} ${f(neck.y)}`;
        layers.segment.push({ kind: "path", owner: el.id, d, stroke, fill: null });
        const back = { x: pb.x - dir.x * head, y: pb.y - dir.y * head };
        layers.segment.push({
          kind: "path",
          owner: el.id,
          d: `M${f(pb.x)} ${f(pb.y)}L${f(back.x - dir.y * half)} ${f(back.y + dir.x * half)}L${f(back.x + dir.y * half)} ${f(back.y - dir.x * half)}Z`,
          stroke: null,
          fill: { color: stroke.color, opacity: stroke.opacity, pattern: "solid", angle: 0 },
        });
        box.add(pa.x, pa.y, stroke.width / 2);
        box.add(pb.x, pb.y, half);
        hits.vector.push({ owner: el.id, type: "vector", d: `M${f(pa.x)} ${f(pa.y)}L${f(pb.x)} ${f(pb.y)}`, area: false });
        break;
      }
      case "region": {
        const d = regionOutline(doc, el).map((loop) => loopPath(loop, kx, ky)).join("");
        if (!d) break;
        layers.region.push({ kind: "path", owner: el.id, d, stroke: el.stroke ? paintStroke(el.stroke) : null, fill: paintFill(el.fill) });
        hits.region.push({ owner: el.id, type: "region", d, area: true });
        break;
      }
      case "vennitems": {
        for (const spot of vennItemSpots(doc, el)) {
          const at = O(spot.anchor, spot.offset);
          const r = textRect(layers.label, el.id, at, spot.text, labelRuns(spot.text, el.font), el.size, el.color, el.font, box);
          hits.vennitems.push({
            owner: el.id,
            type: "vennitems",
            d: `M${f(r.minX)} ${f(r.minY)}H${f(r.maxX)}V${f(r.maxY)}H${f(r.minX)}Z`,
            area: true,
          });
        }
        break;
      }
      case "board": {
        const layout = boardLayout(el, doc);
        if (!layout) break;
        const base = P(el);
        const T = (o: Vec): Vec => ({ x: base.x + o.x, y: base.y - o.y });
        drawMarks(el.id, layout.marks, T, { color: el.color, width: el.width, font: el.font, opacity: 1 }, layers.board, true);
        const [c0, c1] = [T({ x: layout.box.minX, y: layout.box.maxY }), T({ x: layout.box.maxX, y: layout.box.minY })];
        box.add(c0.x, c0.y, 2);
        box.add(c1.x, c1.y, 2);
        hits.board.push({ owner: el.id, type: "board", d: `M${f(c0.x)} ${f(c0.y)}H${f(c1.x)}V${f(c1.y)}H${f(c0.x)}Z`, area: true });
        if (el.show === "gaps") {
          for (const s of boardSlots(el, doc)) {
            const c = T({ x: s.at.x - s.w / 2, y: s.at.y + s.h / 2 });
            slots.push({ owner: el.id, index: s.index, x: c.x, y: c.y, w: s.w, h: s.h, gap: s.gap });
          }
        }
        break;
      }
      case "study": {
        const layout = studyLayout(el);
        const base = P(el);
        const T = (o: Vec): Vec => ({ x: base.x + o.x, y: base.y - o.y });
        const look = { color: el.color, width: el.width, font: el.font, opacity: 1 };
        // Picking a piece goes by `parts`; the drawing is the study's as a whole.
        drawMarks(el.id, layout.groups.flatMap((g) => g.marks), T, look, layers.board, true);
        const [c0, c1] = [T({ x: layout.box.minX, y: layout.box.maxY }), T({ x: layout.box.maxX, y: layout.box.minY })];
        box.add(c0.x, c0.y, 2);
        box.add(c1.x, c1.y, 2);
        hits.study.push({ owner: el.id, type: "study", d: `M${f(c0.x)} ${f(c0.y)}H${f(c1.x)}V${f(c1.y)}H${f(c0.x)}Z`, area: true });
        const rect = (r: { minX: number; minY: number; maxX: number; maxY: number }) => {
          const [a, b] = [T({ x: r.minX, y: r.maxY }), T({ x: r.maxX, y: r.minY })];
          return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
        };
        const hitPath = (hit: StudyHit): string => {
          if (hit.kind === "rect") {
            const r = rect(hit);
            return `M${f(r.x)} ${f(r.y)}H${f(r.x + r.w)}V${f(r.y + r.h)}H${f(r.x)}Z`;
          }
          const points = hit.kind === "line" ? [hit.a, hit.b] : hit.points;
          return points.map((p, i) => `${i === 0 ? "M" : "L"}${f(T(p).x)} ${f(T(p).y)}`).join("");
        };
        for (const piece of layout.pieces) {
          parts.push({
            owner: el.id,
            path: piece.path,
            d: hitPath(piece.hit),
            area: piece.hit.kind === "rect",
            empty: piece.empty,
            ...(piece.text ? { text: rect(piece.text) } : {}),
          });
        }
        studies.push({
          owner: el.id,
          points: layout.points.map((p) => {
            const at = T({ x: p.x, y: 0 });
            return { id: p.id, x: at.x, y: at.y, bottom: p.bottom === null ? null : T({ x: p.x, y: p.bottom }).y };
          }),
          stretches: layout.stretches.map((s) => ({ index: s.index, ...T({ x: s.x, y: 0 }) })),
        });
        break;
      }
      case "component": {
        const drawing = componentDrawing(doc, el, k);
        if (!drawing) break;
        const base = P(drawing.mid);
        const T = (o: Vec): Vec => ({ x: base.x + o.x, y: base.y - o.y });
        drawMarks(el.id, drawing.marks, T, { color: el.stroke.color, width: el.stroke.width, font: el.label?.font ?? "serif", opacity: el.stroke.opacity }, layers.segment, true);
        const [pa, pb] = [T(scale(drawing.dir, -drawing.length / 2)), T(scale(drawing.dir, drawing.length / 2))];
        hits.component.push({ owner: el.id, type: "component", d: `M${f(pa.x)} ${f(pa.y)}L${f(pb.x)} ${f(pb.y)}`, area: false });
        break;
      }
      case "circuit": {
        for (const drawing of circuitDrawings(doc, el, k)) {
          const base = P(drawing.mid);
          const T = (o: Vec): Vec => ({ x: base.x + o.x, y: base.y - o.y });
          const before = layers.label.length;
          drawMarks(el.id, drawing.marks, T, { color: el.color, width: 0.6, font: el.font, opacity: 1 }, layers.label, true);
          for (const prim of layers.label.slice(before)) {
            if (prim.kind === "text") hits.circuit.push({ owner: el.id, type: "circuit", d: textHitPath(prim), area: true });
          }
        }
        break;
      }
      case "extension": {
        const ends = extensionEnds(el, pts);
        if (!ends) break;
        const [pa, pb] = ends.map(P);
        const d = `M${f(pa.x)} ${f(pa.y)}L${f(pb.x)} ${f(pb.y)}`;
        const stroke = paintStroke(el.stroke);
        layers.segment.push({ kind: "path", owner: el.id, d, stroke, fill: null });
        box.add(pb.x, pb.y, stroke.width / 2);
        hits.extension.push({ owner: el.id, type: "extension", d, area: false });
        break;
      }
      case "angle": {
        const a = pts.get(el.a);
        const v = pts.get(el.vertex);
        const b = pts.get(el.b);
        // The arc spans the angle as drawn, which axes at different scales bend.
        const geo = a && v && b ? angleArc(S(a), S(v), S(b), el.reflex) : null;
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
        // An ellipse when the axes count x and y at different scales.
        const r = el.radius * kx;
        const ry = el.radius * ky;
        const stroke = paintStroke(el.stroke);
        const start = el.arc?.start ?? 0;
        const sweep = el.arc ? ((el.arc.end - el.arc.start) % 360 + 360) % 360 || 360 : 360;
        const outline = arc(c, r, start, sweep, true, ry);
        if (el.fill) {
          const d = sweep >= 359.999 ? outline : `M${f(c.x)} ${f(c.y)}${arc(c, r, start, sweep, false, ry)}Z`;
          layers.circle.push({ kind: "path", owner: el.id, d, stroke: null, fill: paintFill(el.fill) });
        }
        layers.circle.push({ kind: "path", owner: el.id, d: outline, stroke, fill: null });
        if (el.radii && sweep < 359.999) {
          const p0 = P(add(center, polar(el.radius, start)));
          const p1 = P(add(center, polar(el.radius, start + sweep)));
          layers.circle.push({
            kind: "path",
            owner: el.id,
            d: `M${f(p0.x)} ${f(p0.y)}L${f(c.x)} ${f(c.y)}L${f(p1.x)} ${f(p1.y)}`,
            stroke,
            fill: null,
          });
          box.add(c.x, c.y);
        }
        boxArc(c, r, start, sweep, stroke.width / 2, ry);
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
        const r = endDotRadius(stroke.width);
        for (const end of functionEnds(el)) {
          const c = P(end.at);
          layers.function.push({
            kind: "path",
            owner: el.id,
            d: circlePath(c.x, c.y, r),
            // An open dot is hollow: paper inside, so the curve doesn't show through.
            fill: { color: end.open ? "#ffffff" : stroke.color, opacity: end.open ? 1 : stroke.opacity, pattern: "solid", angle: 0 },
            stroke: end.open ? { ...solid(stroke), width: Math.max(0.6, stroke.width * 0.8) } : null,
          });
          box.add(c.x, c.y, r + 0.5);
        }
        hits.function.push({ owner: el.id, type: "function", d, area: false });
        break;
      }
      case "vline": {
        const stroke = paintStroke(el.stroke);
        const a = P({ x: el.x, y: el.range[0] });
        const b = P({ x: el.x, y: el.range[1] });
        const d = `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`;
        layers.function.push({ kind: "path", owner: el.id, d, stroke, fill: null });
        box.add(a.x, a.y, stroke.width / 2);
        box.add(b.x, b.y, stroke.width / 2);
        hits.vline.push({ owner: el.id, type: "vline", d, area: false });
        break;
      }
      case "axes": {
        const stroke = paintStroke(el.stroke);
        const o = axesOrigin(el);
        const xs = axisTicks(el.x, axesStepX(el), o.x);
        const ys = axisTicks(el.y, axesStepY(el), o.y);
        const x0 = P({ x: el.x[0], y: o.y });
        const x1 = P({ x: el.x[1], y: o.y });
        const y0 = P({ x: o.x, y: el.y[0] });
        const y1 = P({ x: o.x, y: el.y[1] });
        const d = `M${f(x0.x)} ${f(x0.y)}L${f(x1.x)} ${f(x1.y)}M${f(y0.x)} ${f(y0.y)}L${f(y1.x)} ${f(y1.y)}`;
        layers.axes.push({ kind: "path", owner: el.id, d, stroke, fill: null });
        // Open arrowheads at the positive ends, as textbooks draw axes: a filled head means a vector.
        const head = (tip: Vec, dx: number, dy: number) => {
          const len = 4 + stroke.width * 2;
          return openHead(tip, { x: tip.x - dx * len, y: tip.y - dy * len }, { x: dx, y: dy }, len * OPEN_HEAD);
        };
        layers.axes.push({ kind: "path", owner: el.id, d: head(x1, 1, 0) + head(y1, 0, -1), stroke: { ...stroke, dash: "solid" }, fill: null });
        const tick = 2.5;
        const tickD =
          xs.map((x) => `M${f(x * kx)} ${f(x0.y - tick)}L${f(x * kx)} ${f(x0.y + tick)}`).join("") +
          ys.map((y) => `M${f(y0.x - tick)} ${f(-y * ky)}L${f(y0.x + tick)} ${f(-y * ky)}`).join("");
        if (tickD) layers.axes.push({ kind: "path", owner: el.id, d: tickD, stroke: { ...stroke, dash: "solid" }, fill: null });
        for (const p of [x0, x1, y0, y1]) box.add(p.x, p.y, tick);
        const text = (s: string, at: Vec) =>
          textRect(layers.label, el.id, at, s, labelRuns(s, "serif"), el.size, el.stroke.color, "serif", box);
        // Numbers wait for the curves, then each takes the first spot around its tick that no curve crosses.
        if (el.numbers) {
          const gap = tick + el.size * 0.9 * 0.7;
          axisNumbers.push({
            el,
            x: xs.map((x) => {
              const s = xTickText(el, x, doc.locale);
              const dx = xTickShift(doc, el, x, s);
              // Beside the tick: past it by half the text and a little.
              const side = estimateTextWidth(s, el.size) / 2 + 3;
              return {
                text: s,
                base: { x: x * kx, y: x0.y },
                spots: [
                  { x: dx, y: gap },
                  { x: dx, y: -gap },
                  { x: dx - side, y: gap },
                  { x: dx + side, y: gap },
                  { x: dx - side, y: -gap },
                  { x: dx + side, y: -gap },
                ],
              };
            }),
            y: ys.map((y) => {
              const s = formatNumber(y, 2, doc.locale);
              const dx = tick + 2 + estimateTextWidth(s, el.size) / 2;
              const up = el.size * 0.6 + 2;
              return {
                text: s,
                base: { x: y0.x, y: -y * ky },
                spots: [
                  { x: -dx, y: 0 },
                  { x: dx, y: 0 },
                  { x: -dx, y: -up },
                  { x: -dx, y: up },
                  { x: dx, y: -up },
                  { x: dx, y: up },
                ],
              };
            }),
          });
        }
        const [xName, yName] = el.names;
        if (xName) text(xName, { x: x1.x + 2, y: x1.y + el.size });
        if (yName) text(yName, { x: y1.x + el.size * 0.9, y: y1.y });
        hits.axes.push({ owner: el.id, type: "axes", d, area: false });
        break;
      }
      case "grid": {
        const w = gridWindow(doc, el);
        const lines = gridValues(w.x, w.stepX)
          .map((x) => `M${f(x * kx)} ${f(-w.y[0] * ky)}L${f(x * kx)} ${f(-w.y[1] * ky)}`)
          .concat(gridValues(w.y, w.stepY).map((y) => `M${f(w.x[0] * kx)} ${f(-y * ky)}L${f(w.x[1] * kx)} ${f(-y * ky)}`))
          .join("");
        if (!lines) break;
        layers.grid.push({ kind: "path", owner: el.id, d: lines, stroke: paintStroke(el.stroke), fill: null });
        const a = P({ x: w.x[0], y: w.y[0] });
        const b = P({ x: w.x[1], y: w.y[1] });
        box.add(a.x, a.y);
        box.add(b.x, b.y);
        // Picked by its edge: a click inside it is still a click on the paper.
        const edge = `M${f(a.x)} ${f(a.y)}H${f(b.x)}V${f(b.y)}H${f(a.x)}Z`;
        hits.grid.push({ owner: el.id, type: "grid", d: edge, area: false });
        break;
      }
      case "numberline": {
        const stroke = paintStroke(el.stroke);
        const a = P({ x: el.x[0], y: el.y });
        const b = P({ x: el.x[1], y: el.y });
        const d = `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`;
        layers.axes.push({ kind: "path", owner: el.id, d, stroke, fill: null });
        const len = 4 + stroke.width * 2;
        layers.axes.push({ kind: "path", owner: el.id, d: openHead(b, { x: b.x - len, y: b.y }, { x: 1, y: 0 }, len * OPEN_HEAD), stroke: solid(stroke), fill: null });
        const tick = 2.5;
        const xs = axisTicks(el.x, el.step, NaN);
        const tickD = xs.map((x) => `M${f(x * kx)} ${f(a.y - tick)}L${f(x * kx)} ${f(a.y + tick)}`).join("");
        if (tickD) layers.axes.push({ kind: "path", owner: el.id, d: tickD, stroke: solid(stroke), fill: null });
        box.add(a.x, a.y, tick);
        box.add(b.x, b.y, len * OPEN_HEAD);
        if (el.numbers) {
          for (const x of xs) {
            const s = formatNumber(x, 2, doc.locale);
            textRect(layers.label, el.id, { x: x * kx, y: a.y + tick + el.size * 0.9 }, s, labelRuns(s, "serif"), el.size, el.stroke.color, "serif", box);
          }
        }
        hits.numberline.push({ owner: el.id, type: "numberline", d, area: false });
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

  const numberSpots = new Map<Id, AxisNumberSpots>();
  if (axisNumbers.length > 0) {
    const spots = chooseNumberSpots(axisNumbers, [
      ...layers.guide,
      ...layers.polygon,
      ...layers.region,
      ...layers.circle,
      ...layers.function,
      ...layers.angle,
      ...layers.segment,
      ...layers.point,
      ...layers.label,
    ]);
    axisNumbers.forEach(({ el, x, y }, i) => {
      numberSpots.set(el.id, spots[i]);
      const write = (n: AxisNumber, spot: Vec | null) => {
        if (spot) textRect(layers.label, el.id, add(n.base, spot), n.text, labelRuns(n.text, "serif"), el.size, el.stroke.color, "serif", box);
      };
      x.forEach((n, j) => write(n, spots[i].x[j]));
      y.forEach((n, j) => write(n, spots[i].y[j]));
    });
  }

  return {
    prims: [
      ...layers.grid,
      ...layers.axes,
      ...layers.guide,
      ...layers.polygon,
      ...layers.region,
      ...layers.circle,
      ...layers.function,
      ...layers.angle,
      ...layers.segment,
      ...layers.board,
      ...layers.point,
      ...layers.label,
    ],
    hits: [
      ...hits.grid,
      ...hits.axes,
      ...hits.numberline,
      ...hits.polygon,
      ...hits.region,
      ...hits.circle,
      ...hits.function,
      ...hits.vline,
      ...hits.angle,
      ...hits.extension,
      ...hits.segment,
      ...hits.vector,
      ...hits.component,
      ...hits.board,
      ...hits.study,
      ...hits.circuit,
      ...hits.vennitems,
      ...hits.text,
      ...hits.point,
    ],
    box: box.box,
    k,
    kx,
    ky,
    numberSpots,
    boardSlots: slots,
    parts,
    studies,
  };
}

/**
 * Where each axis number went, as an offset in paper pt (y down) from its
 * tick, or null when no spot was clear enough and it was left out.
 */
export interface AxisNumberSpots {
  x: (Vec | null)[];
  y: (Vec | null)[];
}

interface AxisNumber {
  text: string;
  /** The tick, in paper pt. */
  base: Vec;
  /** Offsets to try, the usual one first: across the axis, then beside the tick on either side. */
  spots: Vec[];
}

/** Padding around a number, in pt, so a curve doesn't touch it either. */
const NUMBER_PAD = 1.5;
/** Cover, in pt of line, below which a spot counts as clear. */
const NUMBER_CLEAR = 0.5;
/** Cost of each step away from the usual spot, in pt of covered line. */
const NUMBER_MOVE = 1;
/** Cover in the best spot, in font sizes, past which the number is left out: a curve runs right through it anywhere. */
const NUMBER_HIDE = 0.8;

/**
 * Keeps axis numbers off the curves and labels, as textbooks do by hand. A
 * number that a line crosses goes across the axis, or beside its tick, where a
 * curve through the tick (a root, a crossing at π) leaves room. One crossed in
 * every spot is left out; its tick stays.
 */
function chooseNumberSpots(axes: { el: Axes; x: AxisNumber[]; y: AxisNumber[] }[], drawn: Prim[]): AxisNumberSpots[] {
  const lines = new LineIndex();
  const taken: Box[] = [];
  for (const p of drawn) {
    if (p.kind === "text") taken.push(textBox(p, p.text, p.size));
    else for (const line of pathLines(p.d)) lines.add(line);
  }
  return axes.map(({ el, x, y }) => {
    const cover = (n: AxisNumber, spot: Vec) => {
      const b = textBox(add(n.base, spot), n.text, el.size);
      const padded = grow(b, NUMBER_PAD);
      return lines.lengthIn(padded) + overlap(padded, taken) / el.size;
    };
    const pick = (n: AxisNumber): Vec | null => {
      const first = cover(n, n.spots[0]);
      if (first <= NUMBER_CLEAR) return n.spots[0];
      let best = { spot: n.spots[0], cover: first, cost: first };
      n.spots.slice(1).forEach((spot, i) => {
        const c = cover(n, spot);
        const cost = c + NUMBER_MOVE * (i + 1);
        if (cost < best.cost) best = { spot, cover: c, cost };
      });
      return best.cover > el.size * NUMBER_HIDE ? null : best.spot;
    };
    return { x: x.map(pick), y: y.map(pick) };
  });
}

/** One closed outline of a region, on paper. A positive sweep is counterclockwise on the page too. */
function loopPath(loop: RegionEdge[], kx: number, ky: number): string {
  const P = (v: Vec) => ({ x: v.x * kx, y: -v.y * ky });
  const start = P(loop[0].from);
  let d = `M${f(start.x)} ${f(start.y)}`;
  for (const e of loop) {
    if (e.kind === "line") {
      const q = P(e.to);
      d += `L${f(q.x)} ${f(q.y)}`;
      continue;
    }
    const [rx, ry] = [e.r * kx, e.r * ky];
    const flag = e.sweep > 0 ? 0 : 1;
    // A whole circle can't be one arc: its two ends would be the same point.
    if (Math.abs(e.sweep) >= 359.999) {
      const middle = P(add(e.c, polar(e.r, e.start + e.sweep / 2)));
      const back = P(e.to);
      d += `A${f(rx)} ${f(ry)} 0 0 ${flag} ${f(middle.x)} ${f(middle.y)}A${f(rx)} ${f(ry)} 0 0 ${flag} ${f(back.x)} ${f(back.y)}`;
      continue;
    }
    const q = P(e.to);
    d += `A${f(rx)} ${f(ry)} 0 ${Math.abs(e.sweep) > 180 ? 1 : 0} ${flag} ${f(q.x)} ${f(q.y)}`;
  }
  return `${d}Z`;
}

/** The arrow or hat over each name of a vector's label. */
function vectorMark(el: Element, at: Vec, text: string, size: number, color: string, out: Prim[]) {
  if (el.type !== "vector" || el.notation === "none") return;
  const paint = { color: resolveColor(color), width: Math.max(0.4, size * 0.05), dash: "solid" as const, opacity: 1 };
  const y = at.y - size * 0.68;
  for (const span of vectorNameSpans(text, size)) {
    const [x0, x1] = [at.x + span.from, at.x + span.to];
    let d: string;
    if (el.notation === "hat") {
      const c = (x0 + x1) / 2;
      const w = size * 0.22;
      d = `M${f(c - w)} ${f(y + size * 0.1)}L${f(c)} ${f(y - size * 0.08)}L${f(c + w)} ${f(y + size * 0.1)}`;
    } else {
      const tip = size * 0.16;
      d = `M${f(x0)} ${f(y)}H${f(x1)}M${f(x1 - tip)} ${f(y - tip * 0.75)}L${f(x1)} ${f(y)}L${f(x1 - tip)} ${f(y + tip * 0.75)}`;
    }
    out.push({ kind: "path", owner: el.id, d, stroke: paint, fill: null });
  }
}

function addLabel(
  doc: FigureDoc,
  el: Element,
  out: Prim[],
  box: BoxBuilder,
  O: (w: Vec, o: Vec) => Vec,
) {
  if (!canHaveLabel(el)) return;
  const placement = labelPlacement(doc, el);
  if (!placement || !el.label) return;
  const { size, color, font, measure } = el.label;
  const text = labelText(doc, el);
  const number = measure ? measureNumber(doc, el, measure) : null;
  const runs = measure && number !== null ? measureRuns(measure, number, font) : labelRuns(text, font);
  const at = O(placement.anchor, placement.offset);
  textRect(out, el.id, at, text, runs, size, color, font, box);
  if (!measure) vectorMark(el, at, text, size, color, out);
}

/** How board and circuit marks look: they take one color, width and font. */
interface MarkLook {
  color: string;
  width: number;
  font: LabelFont;
  opacity: number;
}

/** A rectangle around a drawn text, to pick it with the mouse. */
function textHitPath(t: Extract<Prim, { kind: "text" }>): string {
  const w = estimateTextWidth(t.text, t.size) / 2;
  const h = t.size * 0.6;
  return `M${f(t.x - w)} ${f(t.y - h)}H${f(t.x + w)}V${f(t.y + h)}H${f(t.x - w)}Z`;
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
