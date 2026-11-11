import { AXES_GRID, DEFAULT_AXES_STROKE, DEFAULT_LABEL, DEFAULT_PLOT_WINDOW, DEFAULT_STROKE, emptyDoc, isValidColor, LIMITS } from "./defaults";
import { MAX_EXPR_LENGTH } from "../plot";
import { boardError, MAX_BOARD_SOURCE, MAX_GAP_TEXT } from "./board";
import { MEASURES } from "./labels";
import type {
  Angle,
  Axes,
  Board,
  BoardShow,
  GapStyle,
  Circle,
  CircleConstruction,
  Circuit,
  Component,
  ComponentKind,
  CurrentSense,
  Dash,
  Element,
  EndMark,
  FigureDoc,
  Fill,
  FillPattern,
  FreeText,
  FunctionGraph,
  Grid,
  GridFollow,
  Label,
  LabelMeasure,
  MeasureKind,
  NotableFeature,
  NumberLine,
  Point,
  PointConstruction,
  Polygon,
  Region,
  Segment,
  Stroke,
  Ticks,
  Vector,
  VectorNotation,
  VennItems,
  VerticalLine,
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
const endMark = (x: unknown): EndMark => oneOf<EndMark>(x, ["none", "closed", "open"], "none");
const ticks = (x: unknown): Ticks => (x === 1 || x === 2 || x === 3 ? x : 0);

/** A [from, to] interval with from < to, or the fallback. */
function interval(x: unknown, fallback: [number, number]): [number, number] {
  if (!Array.isArray(x) || x.length !== 2) return fallback;
  const a = coord(x[0]);
  const b = coord(x[1]);
  return a !== null && b !== null && a < b ? [a, b] : fallback;
}

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
  /** Axes saved with a grid of their own, from before grids were elements. */
  let axesGrid = false;

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
          ...(isObj(r.guides) ? { guides: stroke(r.guides) } : {}),
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
      case "extension": {
        const line = Array.isArray(r.line) && r.line.length === 2 && r.line.every((p) => points.has(p as string)) ? r.line : null;
        if (ids.has(id) || !line || line[0] === line[1] || !points.has(r.point as string)) break;
        ids.add(id);
        out.push({ id, type: "extension", line: [line[0], line[1]], point: r.point as string, stroke: stroke(r.stroke) });
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
          ...(r.universe === true ? { universe: true as const } : {}),
        };
        out.push(withLabel(poly, r));
        break;
      }
      case "vector": {
        if (ids.has(id) || !points.has(r.a as string) || !points.has(r.b as string)) break;
        ids.add(id);
        const v: Vector = {
          id,
          type: "vector",
          a: r.a as string,
          b: r.b as string,
          stroke: stroke(r.stroke),
          head: num(r.head, 2, 30, 6),
          notation: oneOf<VectorNotation>(r.notation, ["arrow", "hat", "none"], "arrow"),
        };
        out.push(withLabel(v, r));
        break;
      }
      case "component": {
        if (ids.has(id) || !points.has(r.a as string) || !points.has(r.b as string) || r.a === r.b) break;
        const kind = oneOf<ComponentKind>(r.kind, ["resistor", "lamp", "source", "switch", "ammeter", "voltmeter", "capacitor"], "resistor");
        const value = num(r.value, 0, 1e9, 10);
        // A resistance of zero would be a wire: a piece keeps a little.
        if ((kind === "resistor" || kind === "lamp") && value <= 0) break;
        ids.add(id);
        const c: Component = {
          id,
          type: "component",
          kind,
          a: r.a as string,
          b: r.b as string,
          value,
          internal: num(r.internal, 0, 1e9, 0),
          closed: r.closed !== false,
          shape: r.shape === "box" ? "box" : "zigzag",
          name: (str(r.name) ?? "").slice(0, LIMITS.labelLength),
          size: num(r.size, 8, 80, 24),
          stroke: stroke(r.stroke),
        };
        out.push(withLabel(c, r));
        break;
      }
      case "circuit": {
        if (ids.has(id) || out.some((e) => e.type === "circuit")) break;
        ids.add(id);
        const v = isObj(r.values) ? r.values : {};
        out.push({
          id,
          type: "circuit",
          on: r.on === true,
          current: oneOf<CurrentSense>(r.current, ["none", "real", "conventional"], "none"),
          values: { current: v.current !== false, voltage: v.voltage !== false, power: v.power === true },
          decimals: Math.round(num(r.decimals, 0, 4, 2)),
          size: num(r.size, 4, 72, DEFAULT_LABEL.size),
          color: color(r.color, DEFAULT_LABEL.color),
          font: r.font === "sans" ? "sans" : "serif",
        } satisfies Circuit);
        break;
      }
      case "board": {
        const x = coord(r.x);
        const y = coord(r.y);
        const source = str(r.source)?.trim() ?? "";
        if (ids.has(id) || x === null || y === null || source.length > MAX_BOARD_SOURCE || boardError(source) !== null) break;
        ids.add(id);
        const b: Board = {
          id,
          type: "board",
          x,
          y,
          source,
          show: oneOf<BoardShow>(r.show, ["full", "blank", "gaps"], "full"),
          seed: Math.round(num(r.seed, 0, 1e6, 0)),
          gaps: Array.isArray(r.gaps)
            ? [...new Set(r.gaps.filter((g): g is number => Number.isInteger(g) && g >= 0 && g < 2000))].slice(0, 500)
            : null,
          gapStyle: oneOf<GapStyle>(r.gapStyle, ["box", "blank", "text"], "box"),
          gapText: (str(r.gapText) ?? "?").slice(0, MAX_GAP_TEXT),
          signSide: r.signSide === "right" ? "right" : "left",
          intervals: r.intervals === "wave" ? "wave" : "thick",
          method: r.method === "short" ? "short" : "long",
          places: Math.round(num(r.places, 0, 6, 0)),
          marks: r.marks !== false,
          size: num(r.size, 6, 40, 12),
          color: color(r.color, DEFAULT_LABEL.color),
          width: num(r.width, 0.1, 5, 0.8),
          font: r.font === "sans" ? "sans" : "serif",
        };
        out.push(b);
        break;
      }
      case "function": {
        const expr = str(r.expr)?.trim() ?? "";
        if (ids.has(id) || expr === "" || expr.length > MAX_EXPR_LENGTH) break;
        ids.add(id);
        out.push(
          withLabel<FunctionGraph>(
            {
              id,
              type: "function",
              expr,
              domain: interval(r.domain, DEFAULT_PLOT_WINDOW.x),
              range: interval(r.range, DEFAULT_PLOT_WINDOW.y),
              stroke: stroke(r.stroke),
              ...(Array.isArray(r.ends) && r.ends.length === 2
                ? { ends: [endMark(r.ends[0]), endMark(r.ends[1])] as [EndMark, EndMark] }
                : {}),
            },
            r,
          ),
        );
        break;
      }
      case "vline": {
        const x = coord(r.x);
        if (ids.has(id) || x === null) break;
        ids.add(id);
        out.push(
          withLabel<VerticalLine>(
            { id, type: "vline", x, range: interval(r.range, DEFAULT_PLOT_WINDOW.y), stroke: stroke(r.stroke) },
            r,
          ),
        );
        break;
      }
      case "axes": {
        if (ids.has(id)) break;
        ids.add(id);
        const names = Array.isArray(r.names) ? r.names : [];
        const a: Axes = {
          id,
          type: "axes",
          x: interval(r.x, DEFAULT_PLOT_WINDOW.x),
          y: interval(r.y, DEFAULT_PLOT_WINDOW.y),
          step: num(r.step, 0.01, 1000, 1),
          ...(typeof r.yStep === "number" && r.yStep > 0 ? { yStep: num(r.yStep, 0.01, 1000, 1) } : {}),
          numbers: r.numbers !== false,
          names: [str(names[0])?.slice(0, 20) ?? "x", str(names[1])?.slice(0, 20) ?? "y"],
          stroke: isObj(r.stroke) ? stroke(r.stroke) : { ...DEFAULT_AXES_STROKE },
          size: num(r.size, 4, 72, 8),
          ...(typeof r.xPi === "number" && r.xPi > 0 ? { xPi: num(r.xPi, 1 / 12, 4, 0.5) } : {}),
          ...(r.fit === true ? { fit: true } : {}),
          ...(Array.isArray(r.unit) && r.unit.length === 2
            ? { unit: [num(r.unit[0], 0.05, 20, 1), num(r.unit[1], 0.05, 20, 1)] as [number, number] }
            : {}),
          ...(r.fitUnit === true && Array.isArray(r.unit) ? { fitUnit: true } : {}),
          ...(r.scaleShapes === true ? { scaleShapes: true } : {}),
        };
        if (r.grid === true) axesGrid = true;
        out.push(a);
        break;
      }
      case "grid": {
        if (ids.has(id)) break;
        ids.add(id);
        const g: Grid = {
          id,
          type: "grid",
          x: interval(r.x, DEFAULT_PLOT_WINDOW.x),
          y: interval(r.y, DEFAULT_PLOT_WINDOW.y),
          step: num(r.step, 0.05, 1000, 1),
          follow: oneOf<GridFollow>(r.follow, ["axes", "figure", "none"], "none"),
          stroke: isObj(r.stroke) ? stroke(r.stroke) : { ...AXES_GRID },
        };
        out.push(g);
        break;
      }
      case "numberline": {
        const y = coord(r.y);
        if (ids.has(id) || y === null) break;
        ids.add(id);
        const line: NumberLine = {
          id,
          type: "numberline",
          x: interval(r.x, DEFAULT_PLOT_WINDOW.x),
          y,
          step: num(r.step, 0.01, 1000, 1),
          numbers: r.numbers !== false,
          stroke: isObj(r.stroke) ? stroke(r.stroke) : { ...DEFAULT_AXES_STROKE },
          size: num(r.size, 4, 72, 9),
        };
        out.push(line);
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
  // Regions and Venn items point to circles and polygons, so they wait for those.
  const known = new Map(out.map((e) => [e.id, e.type]));
  const isShape = (x: unknown) => typeof x === "string" && (known.get(x) === "circle" || known.get(x) === "polygon");
  for (const r of raws) {
    if (!idOk(r.id) || ids.has(r.id)) continue;
    if (r.type === "region") {
      const expr = str(r.expr)?.trim() ?? "";
      if (expr === "" || expr.length > LIMITS.labelLength || !Array.isArray(r.sets)) continue;
      const sets = r.sets.filter(isObj).filter((s) => typeof s.name === "string" && isShape(s.shape));
      if (sets.length === 0 || sets.length !== r.sets.length) continue;
      ids.add(r.id);
      const region: Region = {
        id: r.id,
        type: "region",
        expr,
        sets: sets.map((s) => ({ name: s.name as string, shape: s.shape as string })),
        universe: isShape(r.universe) ? (r.universe as string) : null,
        fill: fill(r.fill) ?? { color: "#808080", opacity: 0.3, pattern: "solid", angle: 45 },
        stroke: isObj(r.stroke) ? stroke(r.stroke) : null,
      };
      out.push(region);
    } else if (r.type === "vennitems") {
      const text = (v: unknown) => str(v)?.slice(0, 40) ?? "";
      const members = (Array.isArray(r.members) ? r.members : [])
        .filter(isObj)
        .filter((m) => isShape(m.set) && Array.isArray(m.items))
        .map((m) => ({ set: m.set as string, items: (m.items as unknown[]).map(text).filter((t) => t !== "").slice(0, 60) }));
      const counts = (Array.isArray(r.counts) ? r.counts : [])
        .filter(isObj)
        .filter((c) => Array.isArray(c.in) && c.in.every(isShape) && text(c.text) !== "")
        .map((c) => ({ in: c.in as string[], text: text(c.text) }));
      ids.add(r.id);
      const items: VennItems = {
        id: r.id,
        type: "vennitems",
        members,
        counts,
        size: num(r.size, 4, 72, DEFAULT_LABEL.size),
        color: color(r.color, DEFAULT_LABEL.color),
        font: r.font === "sans" ? "sans" : "serif",
      };
      out.push(items);
    }
  }
  // In the order they were saved: those last two kinds were read apart from the rest.
  const savedAt = new Map(raws.map((r, i) => [r.id, i]));
  out.sort((a, b) => savedAt.get(a.id)! - savedAt.get(b.id)!);
  if (axesGrid && !out.some((e) => e.type === "grid")) {
    let n = 1;
    while (ids.has(`m${n}`)) n++;
    const grid: Grid = { id: `m${n}`, type: "grid", x: [...DEFAULT_PLOT_WINDOW.x], y: [...DEFAULT_PLOT_WINDOW.y], step: 1, follow: "axes", stroke: { ...AXES_GRID } };
    out.unshift(grid);
  }
  const doc: FigureDoc = { kind: "geo", version: 1, elements: withPointConstructions(out, pointRaws) };
  if (input.locale === "en") doc.locale = "en";
  return doc;
}

/**
 * Adds back the constructions of constructed points once every element is
 * known, since they can refer to segments and circles. A construction whose
 * parents are missing is dropped and the point stays free where it is.
 */
function withPointConstructions(elements: Element[], pointRaws: Set<Raw>): Element[] {
  const types = new Map(elements.map((e) => [e.id, e.type]));
  const rawById = new Map([...pointRaws].map((r) => [r.id as string, r]));
  return elements.map((el) => {
    if (el.type !== "point") return el;
    const construction = pointConstruction(rawById.get(el.id)?.construction, el.id, types);
    return construction ? { ...el, construction } : el;
  });
}

function pointConstruction(
  x: unknown,
  self: string,
  types: Map<string, Element["type"]>,
): PointConstruction | undefined {
  if (!isObj(x)) return undefined;
  const isPoint = (id: unknown): id is string => id !== self && types.get(id as string) === "point";
  const CURVES = ["segment", "circle", "function", "vline"];
  const isCurve = (id: unknown): id is string => id !== self && CURVES.includes(types.get(id as string) ?? "");
  const pair = (v: unknown): [string, string] | null =>
    Array.isArray(v) && v.length === 2 && v.every(isPoint) ? [v[0], v[1]] : null;
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  switch (x.kind) {
    case "midpoint": {
      const points = pair(x.points);
      return points ? { kind: "midpoint", points } : undefined;
    }
    case "foot": {
      const line = pair(x.line);
      return line && isPoint(x.point) ? { kind: "foot", point: x.point, line } : undefined;
    }
    case "bisector": {
      const angle = Array.isArray(x.angle) && x.angle.length === 3 && x.angle.every(isPoint) ? x.angle : null;
      const line = x.line === null ? null : pair(x.line);
      if (!angle || (x.line !== null && !line)) return undefined;
      const length = coord(x.length);
      return {
        kind: "bisector",
        angle: [angle[0], angle[1], angle[2]],
        reflex: x.reflex === true,
        line,
        length: length !== null && length > 0 ? length : 1,
      };
    }
    case "perpendicular": {
      const points = pair(x.points);
      if (!points || !finite(x.along) || !finite(x.across)) return undefined;
      const along = num(x.along, -100, 100, 0.5);
      const across = num(x.across, -100, 100, 0);
      return x.fixed === true
        ? { kind: "perpendicular", points, along, across, fixed: true }
        : { kind: "perpendicular", points, along, across };
    }
    case "intersection": {
      const of = x.of;
      if (!Array.isArray(of) || of.length !== 2 || !of.every(isCurve) || of[0] === of[1]) return undefined;
      const index = typeof x.index === "number" && Number.isInteger(x.index) ? Math.min(Math.max(x.index, 0), 199) : 0;
      return { kind: "intersection", of: [of[0], of[1]], index };
    }
    case "arcEnd": {
      const circle = x.circle;
      if (typeof circle !== "string" || circle === self || types.get(circle) !== "circle") return undefined;
      return { kind: "arcEnd", circle, end: x.end === 1 ? 1 : 0 };
    }
    case "notable": {
      const graph = x.graph;
      const feature = oneOf<NotableFeature>(x.feature, ["root", "extremum", "yAxis"], "root");
      const index = typeof x.index === "number" && Number.isInteger(x.index) ? Math.min(Math.max(x.index, 0), 199) : 0;
      if (typeof graph !== "string" || types.get(graph) !== "function") return undefined;
      return { kind: "notable", graph, feature, index };
    }
    case "onGraph": {
      const graph = x.graph;
      const at = coord(x.x);
      if (typeof graph !== "string" || types.get(graph) !== "function" || at === null) return undefined;
      return { kind: "onGraph", graph, x: at };
    }
    case "tangent": {
      const graph = x.graph;
      const along = coord(x.along);
      if (typeof graph !== "string" || types.get(graph) !== "function" || !isPoint(x.point) || along === null) return undefined;
      const at = num(along, -1000, 1000, 2);
      return x.fill === true
        ? { kind: "tangent", graph, point: x.point, along: at, fill: true }
        : { kind: "tangent", graph, point: x.point, along: at };
    }
    case "translate": {
      const by = pair(x.by);
      if (!by || !isPoint(x.point) || !finite(x.factor)) return undefined;
      return { kind: "translate", point: x.point, by, factor: num(x.factor, -1000, 1000, 1) };
    }
    case "unit": {
      const of = pair(x.of);
      return of && isPoint(x.from) ? { kind: "unit", of, from: x.from } : undefined;
    }
    case "corner":
      return isPoint(x.x) && isPoint(x.y) ? { kind: "corner", x: x.x, y: x.y } : undefined;
  }
  return undefined;
}

/** Upgrades older documents. Version 1 is the first, so this only normalizes. */
export function migrate(input: unknown): FigureDoc {
  return normalizeDoc(input);
}
