import { DEFAULT_LABEL, DEFAULT_STROKE, emptyDoc, isValidColor, LIMITS } from "./defaults";
import { MEASURES } from "./labels";
import type {
  Angle,
  Circle,
  CircleConstruction,
  Dash,
  Element,
  FigureDoc,
  Fill,
  FillPattern,
  FreeText,
  Label,
  LabelMeasure,
  MeasureKind,
  Point,
  Polygon,
  Segment,
  Stroke,
  Ticks,
} from "./types";

type Raw = Record<string, unknown>;

const isObj = (x: unknown): x is Raw => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, min: number, max: number, fallback: number): number =>
  typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fallback;
const coord = (x: unknown): number | null =>
  typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= LIMITS.coordinate ? x : null;
const str = (x: unknown): string | null => (typeof x === "string" ? x : null);
const idOk = (x: unknown): x is string => typeof x === "string" && /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(x);
const color = (x: unknown, fallback: string) => (typeof x === "string" && isValidColor(x) ? x : fallback);
const oneOf = <T extends string>(x: unknown, options: readonly T[], fallback: T): T =>
  options.includes(x as T) ? (x as T) : fallback;
const ticks = (x: unknown): Ticks => (x === 1 || x === 2 || x === 3 ? x : 0);

function stroke(x: unknown): Stroke {
  const r = isObj(x) ? x : {};
  return {
    color: color(r.color, DEFAULT_STROKE.color),
    width: num(r.width, 0.1, 10, DEFAULT_STROKE.width),
    dash: oneOf<Dash>(r.dash, ["solid", "dashed", "dotted"], "solid"),
    opacity: num(r.opacity, 0, 1, 1),
  };
}

function fill(x: unknown): Fill | null {
  if (!isObj(x)) return null;
  return {
    color: color(x.color, "#808080"),
    opacity: num(x.opacity, 0, 1, 1),
    pattern: oneOf<FillPattern>(x.pattern, ["solid", "hatch", "crosshatch", "dots"], "solid"),
    angle: num(x.angle, -360, 360, 45),
  };
}

/** Longest prefix or suffix of a live measure. */
const AFFIX_LENGTH = 40;

function measure(x: unknown, kinds: readonly MeasureKind[]): LabelMeasure | undefined {
  if (!isObj(x) || !kinds.includes(x.kind as MeasureKind)) return undefined;
  return {
    kind: x.kind as MeasureKind,
    decimals: Math.round(num(x.decimals, 0, 4, 2)),
    prefix: str(x.prefix)?.slice(0, AFFIX_LENGTH) ?? "",
    suffix: str(x.suffix)?.slice(0, AFFIX_LENGTH) ?? "",
  };
}

function label(x: unknown, kinds: readonly MeasureKind[]): Label | undefined {
  if (!isObj(x)) return undefined;
  const text = str(x.text)?.slice(0, LIMITS.labelLength) ?? "";
  // A measure the element can't have is dropped; its last text still shows.
  const m = measure(x.measure, kinds);
  if (text === "" && !m) return undefined;
  return {
    text,
    angle: x.angle === null ? null : typeof x.angle === "number" && Number.isFinite(x.angle) ? x.angle : null,
    distance: num(x.distance, 0, 100, DEFAULT_LABEL.distance),
    size: num(x.size, 4, 72, DEFAULT_LABEL.size),
    color: color(x.color, DEFAULT_LABEL.color),
    font: x.font === "sans" ? "sans" : "serif",
    ...(m ? { measure: m } : {}),
  };
}

function withLabel<T extends Element>(el: T, raw: Raw): T {
  const l = label(raw.label, MEASURES[el.type]);
  return l ? { ...el, label: l } : el;
}

/**
 * Turns stored or received data into a valid FigureDoc. Bad elements are
 * dropped, as are shapes that point to missing points, so an old or damaged
 * figure still opens.
 */
export function normalizeDoc(input: unknown): FigureDoc {
  if (!isObj(input) || !Array.isArray(input.elements)) return emptyDoc();
  const raws = input.elements.slice(0, LIMITS.elements).filter(isObj);
  const ids = new Set<string>();
  const points = new Set<string>();
  const pointRaws = new Set<Raw>();
  const out: Element[] = [];

  for (const r of raws) {
    if (r.type !== "point" || !idOk(r.id) || ids.has(r.id)) continue;
    if (coord(r.x) === null || coord(r.y) === null) continue;
    ids.add(r.id);
    points.add(r.id);
    pointRaws.add(r);
  }
  const segments = new Set<string>();
  for (const r of raws) {
    if (r.type === "segment" && idOk(r.id) && points.has(r.a as string) && points.has(r.b as string)) {
      segments.add(r.id);
    }
  }

  for (const r of raws) {
    if (!idOk(r.id)) continue;
    const id = r.id;
    switch (r.type) {
      case "point": {
        if (!pointRaws.has(r)) break;
        const p: Point = {
          id,
          type: "point",
          x: r.x as number,
          y: r.y as number,
          shape: oneOf(r.shape, ["dot", "ring", "none"] as const, "dot"),
          size: num(r.size, 0.3, 20, 1.8),
          color: color(r.color, "ink"),
        };
        out.push(withLabel(p, r));
        break;
      }
      case "segment": {
        if (!segments.has(id) || ids.has(id)) break;
        ids.add(id);
        const s: Segment = {
          id,
          type: "segment",
          a: r.a as string,
          b: r.b as string,
          stroke: stroke(r.stroke),
          ticks: ticks(r.ticks),
        };
        out.push(withLabel(s, r));
        break;
      }
      case "angle": {
        if (ids.has(id) || ![r.a, r.vertex, r.b].every((p) => points.has(p as string))) break;
        ids.add(id);
        const arcs = r.arcs === 2 || r.arcs === 3 ? r.arcs : 1;
        const a: Angle = {
          id,
          type: "angle",
          a: r.a as string,
          vertex: r.vertex as string,
          b: r.b as string,
          reflex: r.reflex === true,
          radius: num(r.radius, 2, 200, 14),
          arcs,
          ticks: ticks(r.ticks),
          rightMark: r.rightMark !== false,
          stroke: stroke(r.stroke),
          fill: fill(r.fill),
        };
        out.push(withLabel(a, r));
        break;
      }
      case "circle": {
        if (ids.has(id) || !points.has(r.center as string)) break;
        const radius = coord(r.radius);
        if (radius === null || radius <= 0) break;
        ids.add(id);
        const c = isObj(r.construction) ? r.construction : {};
        let construction: CircleConstruction = { kind: "free" };
        if (c.kind === "through" && points.has(c.point as string)) {
          construction = { kind: "through", point: c.point as string };
        } else if (c.kind === "tangent" && segments.has(c.segment as string)) {
          construction = { kind: "tangent", segment: c.segment as string };
        } else if (
          c.kind === "circumcircle" &&
          Array.isArray(c.points) &&
          c.points.length === 3 &&
          c.points.every((p) => points.has(p as string))
        ) {
          construction = { kind: "circumcircle", points: c.points as [string, string, string] };
        }
        const arc =
          isObj(r.arc) && coord(r.arc.start) !== null && coord(r.arc.end) !== null
            ? { start: r.arc.start as number, end: r.arc.end as number }
            : null;
        const circle: Circle = {
          id,
          type: "circle",
          center: r.center as string,
          radius,
          construction,
          arc,
          radii: r.radii === true,
          stroke: stroke(r.stroke),
          fill: fill(r.fill),
        };
        out.push(withLabel(circle, r));
        break;
      }
      case "polygon": {
        if (ids.has(id) || !Array.isArray(r.vertices)) break;
        const vertices = r.vertices.filter((v): v is string => points.has(v as string));
        if (vertices.length < 3 || vertices.length !== r.vertices.length) break;
        ids.add(id);
        const poly: Polygon = {
          id,
          type: "polygon",
          vertices,
          stroke: isObj(r.stroke) ? stroke(r.stroke) : null,
          fill: fill(r.fill),
        };
        out.push(withLabel(poly, r));
        break;
      }
      case "text": {
        const x = coord(r.x);
        const y = coord(r.y);
        const text = str(r.text)?.slice(0, LIMITS.labelLength) ?? "";
        if (ids.has(id) || x === null || y === null || text.trim() === "") break;
        ids.add(id);
        const t: FreeText = {
          id,
          type: "text",
          x,
          y,
          text,
          size: num(r.size, 4, 72, DEFAULT_LABEL.size),
          color: color(r.color, DEFAULT_LABEL.color),
          font: r.font === "sans" ? "sans" : "serif",
        };
        out.push(t);
        break;
      }
    }
  }
  return { kind: "geo", version: 1, elements: out };
}

/** Upgrades older documents. Version 1 is the first, so this only normalizes. */
export function migrate(input: unknown): FigureDoc {
  return normalizeDoc(input);
}
