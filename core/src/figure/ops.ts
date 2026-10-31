import { AXES_GRID, DEFAULT_AXES_STROKE, DEFAULT_GUIDE_STROKE, DEFAULT_PLOT_WINDOW, DEFAULT_STYLES, LIMITS, type StyleDefaults } from "./defaults";
import { parseExpr } from "../plot";
import {
  angleArc,
  circumcircle,
  constructionParents,
  distanceToLine,
  keepGraphMarks,
  loopFromSegments,
  pointMap,
  resolveConstructions,
  signedArea2,
} from "./geometry";
import { formatNumber, labelFor, type LabelScheme, newMeasure, nextPointNames, withText } from "./labels";
import { functionValue, nearestOnGraph } from "./plot";
import type { ParsedInput, ParsedPoint } from "./parse";
import type {
  Axes,
  FunctionGraph,
  Angle,
  Circle,
  CircleConstruction,
  Element,
  ElementType,
  FigureDoc,
  FreeText,
  Grid,
  Id,
  Point,
  NumberLine,
  Polygon,
  Segment,
  VerticalLine,
} from "./types";
import { dist, heading, lerp, normDeg, sub, type Vec } from "./vec";

/** Result of an editing operation. On error the doc is returned unchanged. */
export interface OpResult {
  doc: FigureDoc;
  created: Id[];
  error?: string;
  /** Non-blocking notes, such as items that were skipped. */
  notice?: string;
  /** What the editor selects afterwards, when not just `created`. */
  selected?: Id[];
}

const ok = (doc: FigureDoc, created: Id[] = [], notice?: string): OpResult => ({
  doc,
  created,
  notice,
});
const fail = (doc: FigureDoc, error: string): OpResult => ({ doc, created: [], error });

/** Settings shared by the operations that create elements. */
export interface OpOptions {
  /** Look of new elements. Default: DEFAULT_STYLES. */
  styles?: StyleDefaults;
  /** Name new unnamed points A, B, C… */
  autoName?: boolean;
}

const stylesOf = (opts: OpOptions) => opts.styles ?? DEFAULT_STYLES;

/** Builds new points, naming the unnamed ones when autoName is on. */
function buildPoints(doc: FigureDoc, specs: ParsedPoint[], opts: OpOptions, nextId: (t: ElementType) => Id): Point[] {
  const styles = stylesOf(opts);
  const given = specs.flatMap((p) => (p.label ? [p.label] : []));
  const names = opts.autoName ? nextPointNames(doc, specs.length - given.length, given) : [];
  let n = 0;
  return specs.map((p) => {
    const name = p.label ?? (opts.autoName ? names[n++] : undefined);
    return {
      id: nextId("point"),
      type: "point",
      x: p.x,
      y: p.y,
      ...styles.point,
      ...(name ? { label: withText(undefined, name.slice(0, LIMITS.labelLength), styles.label) } : {}),
    };
  });
}

const PREFIX: Record<ElementType, string> = {
  point: "p",
  segment: "s",
  extension: "x",
  angle: "a",
  circle: "c",
  polygon: "g",
  text: "t",
  function: "f",
  vline: "r",
  axes: "e",
  grid: "m",
  numberline: "n",
};

/** Next free id like p1, p2. Ids double as TikZ coordinate names. */
export function idMaker(doc: FigureDoc) {
  const used = new Set(doc.elements.map((e) => e.id));
  const counters: Partial<Record<ElementType, number>> = {};
  return (type: ElementType): Id => {
    let n = counters[type] ?? 1;
    while (used.has(`${PREFIX[type]}${n}`)) n++;
    counters[type] = n + 1;
    const id = `${PREFIX[type]}${n}`;
    used.add(id);
    return id;
  };
}

export function withElements(doc: FigureDoc, elements: Element[]): FigureDoc {
  return { ...doc, elements };
}

export function roomFor(doc: FigureDoc, count: number): boolean {
  return doc.elements.length + count <= LIMITS.elements;
}

export const LIMIT_ERROR = `A figura chegou ao limite de ${LIMITS.elements} elementos.`;

export function selectedOfType<T extends ElementType>(
  doc: FigureDoc,
  ids: Id[],
  type: T,
): Extract<Element, { type: T }>[] {
  const byId = new Map(doc.elements.map((e) => [e.id, e]));
  return ids
    .map((id) => byId.get(id))
    .filter((e): e is Extract<Element, { type: T }> => e?.type === type);
}

export function addPoints(doc: FigureDoc, parsed: ParsedPoint[], opts: OpOptions = {}): OpResult {
  if (parsed.length === 0) return ok(doc);
  if (!roomFor(doc, parsed.length)) return fail(doc, LIMIT_ERROR);
  const points = buildPoints(doc, parsed, opts, idMaker(doc));
  return ok(withElements(doc, [...doc.elements, ...points]), points.map((p) => p.id));
}

/**
 * Applies the point input: creates the new points and the segments of its
 * chains in one step. `created` lists the points the input used, in order,
 * so they can be selected for the next action.
 */
export function applyInput(doc: FigureDoc, parsed: ParsedInput, opts: OpOptions = {}): OpResult {
  if (parsed.errors.length > 0) return fail(doc, parsed.errors[0].message);
  if (parsed.functions.length > 0) {
    const [f] = parsed.functions;
    return addFunction(doc, f.expr, f.name, opts);
  }
  if (parsed.lines.length > 0) return addVerticalLine(doc, parsed.lines[0].x, opts);
  if (parsed.intervals.length > 0) {
    const [i] = parsed.intervals;
    return addInterval(doc, i.from, i.to, i.closed, opts);
  }
  if (parsed.graphPoints.length > 0) {
    const [p] = parsed.graphPoints;
    return addPointOnGraph(doc, p.graph, p.x, p.label, opts);
  }
  if (parsed.nodes.length === 0 && parsed.texts.length === 0) return ok(doc);
  const fresh = parsed.nodes.filter((n) => n.kind === "new");
  if (!roomFor(doc, fresh.length + parsed.segments.length + parsed.texts.length)) return fail(doc, LIMIT_ERROR);

  const nextId = idMaker(doc);
  const points = buildPoints(doc, fresh, opts, nextId);
  let k = 0;
  const ids: Id[] = parsed.nodes.map((n) => (n.kind === "existing" ? n.id : points[k++].id));

  let working = withElements(doc, [...doc.elements, ...points]);
  for (const [p, q] of parsed.segments) {
    const a = ids[p];
    const b = ids[q];
    if (a === b || segmentExists(working, a, b)) continue;
    working = withElements(working, [...working.elements, newSegment(nextId("segment"), a, b, opts)]);
  }
  const texts: Id[] = [];
  for (const t of parsed.texts) {
    const added = addText(working, t, t.text, opts);
    working = added.doc;
    texts.push(...added.created);
  }
  return ok(working, [...new Set(ids), ...texts]);
}

export function segmentExists(doc: FigureDoc, a: Id, b: Id): boolean {
  return doc.elements.some(
    (e) => e.type === "segment" && ((e.a === a && e.b === b) || (e.a === b && e.b === a)),
  );
}

export function newSegment(id: Id, a: Id, b: Id, opts: OpOptions): Segment {
  return { id, type: "segment", a, b, stroke: { ...stylesOf(opts).stroke }, ticks: 0 };
}

/** Joins the selected points in order. `closed` also joins the last to the first. */
export function connectPoints(doc: FigureDoc, pointIds: Id[], closed: boolean, opts: OpOptions = {}): OpResult {
  const pts = pointMap(doc);
  const ids = pointIds.filter((id) => pts.has(id));
  if (ids.length < 2) return fail(doc, "Selecione ao menos dois pontos para ligar.");
  if (closed && ids.length < 3) return fail(doc, "Selecione ao menos três pontos para fechar um contorno.");
  const pairs: [Id, Id][] = [];
  for (let i = 0; i < ids.length - 1; i++) pairs.push([ids[i], ids[i + 1]]);
  if (closed) pairs.push([ids[ids.length - 1], ids[0]]);

  const nextId = idMaker(doc);
  const created: Segment[] = [];
  let working = doc;
  for (const [a, b] of pairs) {
    if (a === b || segmentExists(working, a, b)) continue;
    if (dist(pts.get(a)!, pts.get(b)!) === 0) continue;
    const s = newSegment(nextId("segment"), a, b, opts);
    created.push(s);
    working = withElements(working, [...working.elements, s]);
  }
  if (created.length === 0) return fail(doc, "Esses pontos já estão ligados.");
  if (!roomFor(doc, created.length)) return fail(doc, LIMIT_ERROR);
  return ok(working, created.map((s) => s.id));
}

function findAngle(doc: FigureDoc, a: Id, vertex: Id, b: Id): Angle | undefined {
  return doc.elements.find(
    (e): e is Angle =>
      e.type === "angle" &&
      e.vertex === vertex &&
      ((e.a === a && e.b === b) || (e.a === b && e.b === a)),
  );
}

export function angleExists(doc: FigureDoc, a: Id, vertex: Id, b: Id): boolean {
  return findAngle(doc, a, vertex, b) !== undefined;
}

export function newAngle(id: Id, a: Id, vertex: Id, b: Id, reflex: boolean, opts: OpOptions): Angle {
  const styles = stylesOf(opts);
  return {
    id,
    type: "angle",
    a,
    vertex,
    b,
    reflex,
    radius: styles.angle.radius,
    arcs: styles.angle.arcs,
    ticks: 0,
    rightMark: styles.angle.rightMark,
    stroke: { ...styles.stroke },
    fill: styles.angle.fill ? { ...styles.angle.fill } : null,
  };
}

/**
 * Marks the angle at every middle point of the selection: with A, B, C
 * selected it marks ∠ABC. A selected polygon gets all its interior angles.
 */
export function makeAngles(doc: FigureDoc, selection: Id[], opts: OpOptions = {}): OpResult {
  const pts = pointMap(doc);
  const triples: [Id, Id, Id, boolean][] = [];

  for (const poly of selectedOfType(doc, selection, "polygon")) {
    const vs = poly.vertices.map((id) => pts.get(id)).filter((p): p is Point => !!p);
    if (vs.length !== poly.vertices.length || vs.length < 3) continue;
    const ccw = signedArea2(vs) > 0;
    const n = vs.length;
    for (let i = 0; i < n; i++) {
      const prev = vs[(i + n - 1) % n];
      const v = vs[i];
      const next = vs[(i + 1) % n];
      // Interior side: from next to prev counterclockwise when the polygon runs counterclockwise.
      const from = ccw ? next : prev;
      const to = ccw ? prev : next;
      const sweep = normDeg(heading(sub(to, v)) - heading(sub(from, v)));
      triples.push([prev.id, v.id, next.id, sweep > 180 + 1e-9]);
    }
  }

  const points = selectedOfType(doc, selection, "point");
  for (let i = 0; i + 2 < points.length; i++) {
    triples.push([points[i].id, points[i + 1].id, points[i + 2].id, false]);
  }

  if (triples.length === 0) {
    return fail(doc, "Selecione três pontos (A, B, C marca o ângulo em B) ou um polígono.");
  }

  const nextId = idMaker(doc);
  const created: Angle[] = [];
  // Angles asked for that were already marked, like a right angle marked on its own.
  const marked: Id[] = [];
  let working = doc;
  let degenerate = 0;
  for (const [a, v, b, reflex] of triples) {
    const existing = findAngle(working, a, v, b);
    if (existing) {
      marked.push(existing.id);
      continue;
    }
    const arc = angleArc(pts.get(a)!, pts.get(v)!, pts.get(b)!, false);
    if (!arc || arc.measure < 1e-6 || Math.abs(arc.measure - 180) < 1e-6) {
      degenerate++;
      continue;
    }
    const angle = newAngle(nextId("angle"), a, v, b, reflex, opts);
    created.push(angle);
    marked.push(angle.id);
    working = withElements(working, [...working.elements, angle]);
  }
  if (created.length === 0) {
    return fail(
      doc,
      degenerate > 0 ? "Os pontos estão alinhados, não há ângulo para marcar." : "Esses ângulos já existem.",
    );
  }
  if (!roomFor(doc, created.length)) return fail(doc, LIMIT_ERROR);
  return { ...ok(working, created.map((a) => a.id)), selected: [...new Set(marked)] };
}

/**
 * Creates a polygon from the selected points (joining them in order, closing
 * the contour) or from selected segments that form a closed loop.
 */
export function makePolygon(doc: FigureDoc, selection: Id[], opts: OpOptions = {}): OpResult {
  const pts = pointMap(doc);
  const points = selectedOfType(doc, selection, "point");
  const segments = selectedOfType(doc, selection, "segment");

  let vertices: Id[];
  let working = doc;
  const created: Id[] = [];

  if (points.length >= 3) {
    vertices = points.map((p) => p.id);
    const joined = connectPoints(doc, vertices, true, opts);
    if (!joined.error) {
      working = joined.doc;
      created.push(...joined.created);
    }
  } else if (segments.length >= 3) {
    const loop = loopFromSegments(segments, pts);
    if ("error" in loop) return fail(doc, loop.error);
    vertices = loop.vertices;
  } else {
    return fail(doc, "Selecione ao menos três pontos, ou os segmentos de um contorno fechado.");
  }

  const vs = vertices.map((id) => pts.get(id)!);
  if (Math.abs(signedArea2(vs)) < 1e-12) return fail(doc, "Os pontos estão alinhados e não formam um polígono.");
  const key = [...vertices].sort().join(",");
  const exists = doc.elements.some(
    (e) => e.type === "polygon" && [...e.vertices].sort().join(",") === key,
  );
  if (exists) return fail(doc, "Esse polígono já existe.");

  const nextId = idMaker(working);
  const polygon: Polygon = {
    id: nextId("polygon"),
    type: "polygon",
    vertices,
    stroke: null,
    fill: stylesOf(opts).polygonFilled ? { ...stylesOf(opts).fill } : null,
  };
  if (!roomFor(working, 1)) return fail(doc, LIMIT_ERROR);
  // The polygon goes first so its fill sits under the segments.
  return ok(withElements(working, [polygon, ...working.elements]), [polygon.id, ...created]);
}

export type CircleMode = "radius" | "through" | "tangent" | "circumcircle";

export function makeCircle(doc: FigureDoc, selection: Id[], mode: CircleMode, opts: OpOptions = {}): OpResult {
  const styles = stylesOf(opts);
  const pts = pointMap(doc);
  const points = selectedOfType(doc, selection, "point");
  const segments = selectedOfType(doc, selection, "segment");
  const nextId = idMaker(doc);

  let center: Point;
  let radius: number;
  let construction: CircleConstruction;
  const extra: Element[] = [];

  switch (mode) {
    case "radius":
      if (points.length < 1) return fail(doc, "Selecione o ponto que será o centro.");
      center = points[0];
      radius = styles.circleRadius;
      construction = { kind: "free" };
      break;
    case "through":
      if (points.length < 2) return fail(doc, "Selecione o centro e depois um ponto da circunferência.");
      center = points[0];
      radius = dist(points[0], points[1]);
      construction = { kind: "through", point: points[1].id };
      break;
    case "tangent": {
      if (points.length < 1 || segments.length < 1) {
        return fail(doc, "Selecione o centro e um segmento para a circunferência tangenciar.");
      }
      center = points[0];
      const s = segments[0];
      radius = distanceToLine(center, pts.get(s.a)!, pts.get(s.b)!);
      construction = { kind: "tangent", segment: s.id };
      break;
    }
    case "circumcircle": {
      if (points.length < 3) return fail(doc, "Selecione três pontos por onde a circunferência passa.");
      const [p, q, r] = points;
      const solved = circumcircle(p, q, r);
      if (!solved) return fail(doc, "Os três pontos estão alinhados, não há circunferência que passe por eles.");
      center = buildPoints(doc, [{ x: solved.center.x, y: solved.center.y }], opts, nextId)[0];
      extra.push(center);
      radius = solved.radius;
      construction = { kind: "circumcircle", points: [p.id, q.id, r.id] };
      break;
    }
  }

  if (!(radius > 1e-9)) return fail(doc, "O raio ficou zero. Escolha outros pontos.");
  if (!roomFor(doc, 1 + extra.length)) return fail(doc, LIMIT_ERROR);
  const circle: Circle = {
    id: nextId("circle"),
    type: "circle",
    center: center.id,
    radius,
    construction,
    arc: null,
    radii: false,
    stroke: { ...styles.stroke },
    fill: null,
  };
  return ok(withElements(doc, [circle, ...doc.elements, ...extra]), [circle.id, ...extra.map((e) => e.id)]);
}

/** Ids that also go away when `ids` are deleted. */
export function cascadeIds(doc: FigureDoc, ids: Id[]): Set<Id> {
  const gone = new Set(ids);
  // Until nothing more goes: an extension can come before the segment it continues.
  for (let size = -1; size !== gone.size; ) {
    size = gone.size;
    for (const el of doc.elements) {
      if (!gone.has(el.id) && referencedPoints(el).some((r) => gone.has(r))) gone.add(el.id);
      // A tangent's ends mean nothing without its point or graph: they go, and the tangent with them.
      const c = el.type === "point" ? el.construction : undefined;
      if (!gone.has(el.id) && c?.kind === "tangent" && (gone.has(c.point) || gone.has(c.graph))) gone.add(el.id);
    }
  }
  return gone;
}

function referencedPoints(el: Element): Id[] {
  switch (el.type) {
    case "point":
    case "text":
    case "function":
    case "vline":
    case "axes":
    case "grid":
    case "numberline":
      return [];
    case "segment":
      return [el.a, el.b];
    case "extension":
      return [...el.line, el.point];
    case "angle":
      return [el.a, el.vertex, el.b];
    case "circle":
      return [el.center];
    case "polygon":
      return el.vertices;
  }
}

/**
 * Deletes elements and everything built on them. Circles and constructed
 * points that lose what they were built from stay where they are and become free.
 */
export function deleteElements(doc: FigureDoc, ids: Id[]): OpResult {
  if (ids.length === 0) return ok(doc);
  const gone = withOrphanHelpers(doc, cascadeIds(doc, withLostHelpers(doc, ids)));
  const elements = doc.elements
    .filter((el) => !gone.has(el.id))
    .map((el): Element => {
      if (el.type === "point") return freedPoint(el, gone);
      if (el.type !== "circle") return el;
      const c = el.construction;
      const lost =
        (c.kind === "through" && gone.has(c.point)) ||
        (c.kind === "tangent" && gone.has(c.segment)) ||
        (c.kind === "circumcircle" && c.points.some((p) => gone.has(p)));
      return lost ? { ...el, construction: { kind: "free" } } : el;
    });
  return ok(withElements(doc, elements));
}

/**
 * Adds the hidden, unnamed points built on deleted circles, the outer ends of
 * a sector's radii, so the radii go with the circle instead of staying as
 * stray segments.
 */
function withLostHelpers(doc: FigureDoc, ids: Id[]): Id[] {
  const gone = new Set(ids);
  const helpers = doc.elements.filter(
    (el) =>
      el.type === "point" &&
      el.construction?.kind === "arcEnd" &&
      el.shape === "none" &&
      !el.label &&
      gone.has(el.construction.circle),
  );
  return [...ids, ...helpers.map((el) => el.id)];
}

function freedPoint(p: Point, gone: Set<Id>): Point {
  if (!p.construction || !constructionParents(p.construction).some((id) => gone.has(id))) return p;
  const next = { ...p };
  delete next.construction;
  return next;
}

/**
 * Adds the hidden, unnamed constructed points that only the deleted elements
 * used, such as the ends of a perpendicular bisector, so they don't linger.
 */
function withOrphanHelpers(doc: FigureDoc, gone: Set<Id>): Set<Id> {
  const usedByGone = new Set<Id>();
  const usedByKept = new Set<Id>();
  for (const el of doc.elements) {
    const refs = [
      ...referencedPoints(el),
      ...(el.type === "point" && el.construction ? constructionParents(el.construction) : []),
    ];
    for (const r of refs) (gone.has(el.id) ? usedByGone : usedByKept).add(r);
  }
  const out = new Set(gone);
  for (const el of doc.elements) {
    const helper = el.type === "point" && el.construction && el.shape === "none" && !el.label;
    if (helper && usedByGone.has(el.id) && !usedByKept.has(el.id)) out.add(el.id);
  }
  return out;
}

/**
 * Moves points and free texts. A point on a graph slides along it, to the
 * curve's point nearest where it was taken, measured on paper.
 */
export function movePoints(doc: FigureDoc, moves: { id: Id; x: number; y: number }[]): FigureDoc {
  const byId = new Map(moves.map((m) => [m.id, m]));
  const elements = doc.elements.map((el) => {
    const m = byId.get(el.id);
    if (!m || (el.type !== "point" && el.type !== "text")) return el;
    const c = el.type === "point" ? el.construction : undefined;
    if (c?.kind === "onGraph") {
      const graph = doc.elements.find((g) => g.id === c.graph);
      // Past where f is defined, like √x left of 0, the point waits at its last x.
      if (graph?.type !== "function") return el;
      const axes = doc.elements.find((e) => e.type === "axes");
      const unit = axes?.type === "axes" ? axes.unit : undefined;
      const near = nearestOnGraph(graph, m, graph.domain, unit);
      if (near === null) return el;
      const x = Math.round(near * 1e4) / 1e4 || 0;
      if (functionValue(graph.expr, x) === null) return el;
      return { ...el, construction: { ...c, x } };
    }
    return { ...el, x: m.x, y: m.y };
  });
  return resolveConstructions(withElements(doc, elements));
}

/** Applies a change to elements, then rebuilds circles that depend on them. */
export function updateElements(
  doc: FigureDoc,
  ids: Id[],
  change: (el: Element) => Element,
): FigureDoc {
  const set = new Set(ids);
  let changed = false;
  const elements = doc.elements.map((el) => {
    if (!set.has(el.id)) return el;
    const next = change(el);
    if (next !== el) changed = true;
    return next;
  });
  return changed ? resolveConstructions(keepGraphMarks(doc, withElements(doc, elements))) : doc;
}

/** Inserts a point on a segment, at a fraction of its length or a distance from its first end. */
export function pointOnSegment(
  doc: FigureDoc,
  segmentId: Id,
  at: { ratio: number } | { distance: number },
  fromEnd: "a" | "b" = "a",
  opts: OpOptions = {},
): OpResult {
  const seg = doc.elements.find((e): e is Segment => e.id === segmentId && e.type === "segment");
  const pts = pointMap(doc);
  const a = seg && pts.get(fromEnd === "a" ? seg.a : seg.b);
  const b = seg && pts.get(fromEnd === "a" ? seg.b : seg.a);
  if (!a || !b) return fail(doc, "Selecione um segmento.");
  const length = dist(a, b);
  const t = "ratio" in at ? at.ratio : length === 0 ? 0 : at.distance / length;
  if (!(t >= 0 && t <= 1)) return fail(doc, "O ponto ficaria fora do segmento.");
  const p = lerp(a, b, t);
  return addPoints(doc, [{ x: p.x, y: p.y }], opts);
}

export type LabelTarget = "point" | "segment" | "angle" | "circle" | "polygon";

/** Schemes that become live measure labels, which follow the points. */
const LIVE_SCHEMES: LabelScheme[] = ["length", "measure", "radius", "area", "perimeter"];

/** Applies an automatic naming scheme to all elements of a type, or only the given ones. */
export function autoLabel(
  doc: FigureDoc,
  type: LabelTarget,
  scheme: LabelScheme,
  onlyIds: Id[] | null,
  decimals = 2,
  opts: OpOptions = {},
): OpResult {
  const only = onlyIds ? new Set(onlyIds) : null;
  const targets = doc.elements.filter((e) => e.type === type && (!only || only.has(e.id)));
  if (targets.length === 0) return fail(doc, "Não há elementos para etiquetar.");
  if (type === "circle" && scheme === "radius") return labelRadii(doc, targets as Circle[], decimals, opts);
  const texts = new Map<Id, string>();
  targets.forEach((el, i) => {
    const text = labelFor(scheme, i, el, doc, decimals);
    if (text !== null) texts.set(el.id, text);
  });
  // Measures become live labels that follow the points. Angles keep at most one decimal.
  const live = LIVE_SCHEMES.includes(scheme);
  const kind = scheme === "area" || scheme === "perimeter" ? scheme : undefined;
  const elements = doc.elements.map((el) => {
    const text = texts.get(el.id);
    if (text === undefined || el.type === "text") return el;
    const label = withText(el.label, text, stylesOf(opts).label);
    const measure = live ? newMeasure(el, el.type === "angle" ? Math.min(decimals, 1) : decimals, kind) : null;
    return { ...el, label: measure ? { ...label, measure } : label } as Element;
  });
  return ok(withElements(doc, elements));
}

/**
 * Segments that draw a radius of the circle: from its center to a point on
 * it, like the sides of a sector.
 */
export function radiusSegments(doc: FigureDoc, circle: Circle): Segment[] {
  const pts = pointMap(doc);
  const center = pts.get(circle.center);
  if (!center) return [];
  const onCircle = (id: Id) => {
    const p = pts.get(id);
    return !!p && Math.abs(dist(center, p) - circle.radius) < 1e-6 * Math.max(1, circle.radius);
  };
  return doc.elements.filter(
    (e): e is Segment =>
      e.type === "segment" && ((e.a === circle.center && onCircle(e.b)) || (e.b === circle.center && onCircle(e.a))),
  );
}

/**
 * Labels each circle's radius with its live measure. A radius already drawn,
 * like a side of a sector, gets the label on that segment, where it reads
 * clearly; circles without one get it beside the circle.
 */
function labelRadii(doc: FigureDoc, circles: Circle[], decimals: number, opts: OpOptions): OpResult {
  const base = stylesOf(opts).label;
  const onSegment = new Set<Id>();
  const onCircle = new Set<Id>();
  const moved = new Set<Id>();
  for (const c of circles) {
    const drawn = radiusSegments(doc, c)[0];
    if (drawn) {
      onSegment.add(drawn.id);
      moved.add(c.id);
    } else onCircle.add(c.id);
  }
  const elements = doc.elements.map((el): Element => {
    if (el.type === "segment" && onSegment.has(el.id)) {
      const text = labelFor("length", 0, el, doc, decimals) ?? "";
      return { ...el, label: { ...withText(el.label, text, base), measure: newMeasure(el, decimals)! } };
    }
    if (el.type === "circle" && onCircle.has(el.id)) {
      const text = labelFor("radius", 0, el, doc, decimals) ?? "";
      return { ...el, label: { ...withText(el.label, text, base), measure: newMeasure(el, decimals, "radius")! } };
    }
    // A radius measure labeled before the radius was drawn would show twice.
    if (el.type === "circle" && moved.has(el.id) && el.label?.measure?.kind === "radius") {
      const bare = { ...el };
      delete bare.label;
      return bare;
    }
    return el;
  });
  return ok(withElements(doc, elements));
}

/**
 * Removes the labels auto-label jobs would write, on all elements of their
 * types or only the given ones. Radii also clear the segments that draw them.
 */
export function clearLabels(doc: FigureDoc, jobs: AutoLabelJob[], onlyIds: Id[] | null): OpResult {
  const only = onlyIds ? new Set(onlyIds) : null;
  const types = new Set<ElementType>(jobs.map((j) => j.type));
  const ids = new Set<Id>();
  for (const el of doc.elements) {
    if (!types.has(el.type) || (only && !only.has(el.id))) continue;
    ids.add(el.id);
    if (el.type === "circle") for (const s of radiusSegments(doc, el)) ids.add(s.id);
  }
  return removeLabels(doc, [...ids]);
}

/** Removes the labels of the given elements. */
export function removeLabels(doc: FigureDoc, ids: Id[]): OpResult {
  const set = new Set(ids);
  let removed = 0;
  const elements = doc.elements.map((el) => {
    if (!set.has(el.id) || el.type === "text" || !el.label) return el;
    removed++;
    const bare = { ...el };
    delete bare.label;
    return bare;
  });
  if (removed === 0) return fail(doc, "Não há rótulos para apagar.");
  return ok(withElements(doc, elements));
}

export interface AutoLabelJob {
  type: LabelTarget;
  scheme: LabelScheme;
}

/**
 * Runs several automatic labelings as one change, like points A, B, C plus
 * live side lengths. Jobs with nothing to label are skipped.
 */
export function autoLabelMany(
  doc: FigureDoc,
  jobs: AutoLabelJob[],
  onlyIds: Id[] | null,
  decimals = 2,
  opts: OpOptions = {},
): OpResult {
  if (jobs.length === 0) return fail(doc, "Marque o que rotular.");
  let working = doc;
  let labeled = false;
  for (const job of jobs) {
    const r = autoLabel(working, job.type, job.scheme, onlyIds, decimals, opts);
    if (r.error) continue;
    working = r.doc;
    labeled = true;
  }
  return labeled ? ok(working) : fail(doc, "Não há elementos para etiquetar.");
}

/** Adds a free text centered at (x, y), in the label style of the options. */
export function addText(doc: FigureDoc, at: { x: number; y: number }, text: string, opts: OpOptions = {}): OpResult {
  const trimmed = text.trim().slice(0, LIMITS.labelLength);
  if (trimmed === "") return fail(doc, "Escreva o texto.");
  if (!roomFor(doc, 1)) return fail(doc, LIMIT_ERROR);
  const { size, color, font } = stylesOf(opts).label;
  const el: FreeText = { id: idMaker(doc)("text"), type: "text", x: at.x, y: at.y, text: trimmed, size, color, font };
  return ok(withElements(doc, [...doc.elements, el]), [el.id]);
}

export function setLabelText(doc: FigureDoc, id: Id, text: string, opts: OpOptions = {}): FigureDoc {
  return updateElements(doc, [id], (el) => {
    if (el.type === "text" || el.type === "axes" || el.type === "grid" || el.type === "numberline" || el.type === "extension") return el;
    const trimmed = text.slice(0, LIMITS.labelLength);
    if (trimmed === "") {
      const next = { ...el };
      delete next.label;
      return next;
    }
    return { ...el, label: withText(el.label, trimmed, stylesOf(opts).label) } as Element;
  });
}

/**
 * The Polígono action: fills the selected circles and polygons that have no
 * fill, and makes a polygon from selected points or a closed loop of segments.
 */
export function fillShapes(doc: FigureDoc, selection: Id[], opts: OpOptions = {}): OpResult {
  const styles = stylesOf(opts);
  const shapes = [...selectedOfType(doc, selection, "circle"), ...selectedOfType(doc, selection, "polygon")];
  const unfilled = shapes.filter((e) => e.fill === null).map((e) => e.id);
  const wantsPolygon =
    selectedOfType(doc, selection, "point").length >= 3 || selectedOfType(doc, selection, "segment").length >= 3;

  let working = updateElements(doc, unfilled, (el) =>
    el.type === "circle" || el.type === "polygon" ? { ...el, fill: { ...styles.fill } } : el,
  );
  const created: Id[] = [];
  if (wantsPolygon || shapes.length === 0) {
    const poly = makePolygon(working, selection, { ...opts, styles: { ...styles, polygonFilled: true } });
    if (poly.error && unfilled.length === 0) return fail(doc, poly.error);
    if (!poly.error) {
      working = poly.doc;
      created.push(...poly.created);
    }
  }
  if (working === doc) return fail(doc, "As formas selecionadas já estão preenchidas.");
  return ok(working, created);
}

/**
 * A figure being drawn with Figura rápida: its vertices in click order, and
 * what closes it now (the last side, the polygon and its angles), which the
 * next vertex rebuilds.
 */
export interface QuickFigure {
  points: Id[];
  closing: Id[];
}

export const NO_QUICK_FIGURE: QuickFigure = { points: [], closing: [] };

/**
 * One click of Figura rápida: a new point at `next` (or an existing point,
 * by id), joined to the previous vertex. From three vertices not all on a
 * line, the figure closes into a filled polygon with its angles marked.
 * Picking the first vertex again finishes the figure. `figure` is null when
 * it is done, and the next click starts another.
 */
export function quickFigureStep(
  doc: FigureDoc,
  figure: QuickFigure,
  next: Vec | Id,
  opts: OpOptions = {},
): OpResult & { figure: QuickFigure | null } {
  const pts = pointMap(doc);
  // An undo can take vertices away: then the figure is over, and this click starts a new one.
  const current = figure.points.every((id) => pts.has(id)) ? figure : NO_QUICK_FIGURE;
  const done = (r: OpResult, f: QuickFigure | null) => ({ ...r, figure: f });

  if (typeof next === "string") {
    if (!pts.has(next)) return done(fail(doc, "Esse ponto não existe mais."), current);
    if (next === current.points[0] && current.points.length >= 3) return done(ok(doc), null);
    if (current.points.includes(next)) return done(ok(doc), current);
  }

  let working = deleteElements(doc, current.closing.filter((id) => doc.elements.some((e) => e.id === id))).doc;
  let vertex: Id;
  const created: Id[] = [];
  if (typeof next === "string") {
    vertex = next;
  } else {
    const added = addPoints(working, [{ x: next.x, y: next.y }], opts);
    if (added.error) return done(fail(doc, added.error), current);
    working = added.doc;
    vertex = added.created[0];
    created.push(vertex);
  }

  const points = [...current.points, vertex];
  const last = current.points[current.points.length - 1];
  if (last !== undefined) {
    const side = connectPoints(working, [last, vertex], false, opts);
    if (!side.error) working = side.doc;
  }

  const closing: Id[] = [];
  const at = pointMap(working);
  if (points.length >= 3 && !onOneLine(points.map((id) => at.get(id)!))) {
    const filled: OpOptions = { ...opts, styles: { ...stylesOf(opts), polygonFilled: true } };
    const polygon = makePolygon(working, points, filled);
    if (!polygon.error) {
      working = polygon.doc;
      closing.push(...polygon.created);
      const angles = makeAngles(working, [polygon.created[0]], opts);
      if (!angles.error) {
        working = angles.doc;
        closing.push(...angles.created);
      }
    }
  }
  return done(ok(working, created), { points, closing });
}

function onOneLine(vs: Vec[]): boolean {
  const [a, b] = vs;
  return vs.every((p) => Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) < 1e-9);
}

/** Names given to graphs typed as y = …: f, g, h, then f₁, f₂… */
const FUNCTION_NAMES = ["f", "g", "h", "p", "q", "r"];

function nextFunctionName(doc: FigureDoc): string {
  const used = new Set(doc.elements.flatMap((e) => (e.type === "function" && e.label ? [e.label.text] : [])));
  return FUNCTION_NAMES.find((n) => !used.has(n)) ?? `f${used.size + 1}`;
}

/**
 * Adds the graph of y = expr, named `name` (or the next free of f, g, h…).
 * It spans the figure's axes, which are added first when there are none.
 */
export function addFunction(doc: FigureDoc, expr: string, name = "", opts: OpOptions = {}): OpResult {
  const parsed = parseExpr(expr);
  if (!parsed.ok) return fail(doc, parsed.error);
  const existing = doc.elements.find((e): e is Axes => e.type === "axes");
  if (!roomFor(doc, existing ? 1 : 2)) return fail(doc, LIMIT_ERROR);
  const nextId = idMaker(doc);
  const axes = existing ?? newAxes(nextId("axes"));
  const graph: FunctionGraph = {
    id: nextId("function"),
    type: "function",
    expr: expr.trim(),
    domain: [...axes.x],
    range: [...axes.y],
    stroke: { ...stylesOf(opts).stroke },
    label: withText(undefined, name || nextFunctionName(doc), stylesOf(opts).label),
  };
  return withAxes(doc, graph, axes, !existing);
}

/** The vertical line x = a, dashed like an asymptote, over the figure's axes (added when there are none). */
export function addVerticalLine(doc: FigureDoc, x: number, opts: OpOptions = {}): OpResult {
  if (!Number.isFinite(x) || Math.abs(x) > LIMITS.coordinate) return fail(doc, "Valor de x fora do limite.");
  const existing = doc.elements.find((e): e is Axes => e.type === "axes");
  if (!roomFor(doc, existing ? 1 : 2)) return fail(doc, LIMIT_ERROR);
  const nextId = idMaker(doc);
  const axes = existing ?? newAxes(nextId("axes"));
  const line: VerticalLine = {
    id: nextId("vline"),
    type: "vline",
    x,
    range: [...axes.y],
    stroke: { ...stylesOf(opts).stroke, dash: "dashed" },
  };
  return withAxes(doc, line, axes, !existing);
}

/** Lowest y the figure reaches, roughly: where a new number line goes under it. */
function figureBottom(doc: FigureDoc): number | null {
  const pts = pointMap(doc);
  let low = Infinity;
  for (const el of doc.elements) {
    if (el.type === "point" || el.type === "text") low = Math.min(low, el.y);
    else if (el.type === "axes") low = Math.min(low, el.y[0]);
    else if (el.type === "function" || el.type === "vline") low = Math.min(low, el.range[0]);
    else if (el.type === "numberline") low = Math.min(low, el.y);
    else if (el.type === "circle") low = Math.min(low, (pts.get(el.center)?.y ?? Infinity) - el.radius);
  }
  return Number.isFinite(low) ? low : null;
}

/** A number line from -5 to 5, at y = 0 in an empty figure or under everything else. */
export function addNumberLine(doc: FigureDoc): OpResult {
  if (!roomFor(doc, 1)) return fail(doc, LIMIT_ERROR);
  const bottom = figureBottom(doc);
  const line: NumberLine = {
    id: idMaker(doc)("numberline"),
    type: "numberline",
    x: [-5, 5],
    y: bottom === null ? 0 : Math.floor(bottom) - 2,
    step: 1,
    numbers: true,
    stroke: { ...DEFAULT_AXES_STROKE },
    size: 9,
  };
  return ok(withElements(doc, [...doc.elements, line]), [line.id]);
}

/** Moves a number line up or down, with the interval marks that sit on it. */
export function moveNumberLine(doc: FigureDoc, id: Id, y: number): FigureDoc {
  const line = doc.elements.find((e): e is NumberLine => e.id === id && e.type === "numberline");
  if (!line || !Number.isFinite(y)) return doc;
  const on = (p: Point) => !p.construction && Math.abs(p.y - line.y) < 1e-9 && p.x >= line.x[0] - 1e-9 && p.x <= line.x[1] + 1e-9;
  const elements = doc.elements.map((el): Element => {
    if (el.id === id) return { ...line, y };
    return el.type === "point" && on(el) ? { ...el, y } : el;
  });
  return resolveConstructions(withElements(doc, elements));
}

/** Width in pt of the stroke that marks an interval over a number line. */
const INTERVAL_WIDTH = 2.4;

/**
 * An interval on the figure's number line: a thick stroke from `from` to `to`
 * (null for -∞ and +∞, which run to the line's ends), with a closed dot where
 * an end belongs to it and an open one where it doesn't.
 */
export function addInterval(
  doc: FigureDoc,
  from: number | null,
  to: number | null,
  closed: [boolean, boolean],
  opts: OpOptions = {},
): OpResult {
  const found = doc.elements.find((e): e is NumberLine => e.type === "numberline");
  if (!found) return fail(doc, "Crie uma reta numérica antes: Gráficos › Reta numérica.");
  // Ends past the line stretch it, a whole unit beyond, so they get ticks and the arrow stays ahead.
  const finite = [from, to].filter((v): v is number => v !== null);
  const line: NumberLine = {
    ...found,
    x: [Math.min(found.x[0], ...finite.map((v) => Math.floor(v) - 1)), Math.max(found.x[1], ...finite.map((v) => Math.ceil(v) + 1))],
  };
  if (Math.abs(line.x[0]) > LIMITS.coordinate || Math.abs(line.x[1]) > LIMITS.coordinate) return fail(doc, "Valor fora do limite da figura.");
  const a = from ?? line.x[0];
  const b = to ?? line.x[1];
  if (!(a < b)) return fail(doc, "O início do intervalo precisa ser menor que o fim.");
  if (!roomFor(doc, 3)) return fail(doc, LIMIT_ERROR);
  const styles = stylesOf(opts);
  const nextId = idMaker(doc);
  const end = (x: number, infinite: boolean, isClosed: boolean): Point => ({
    id: nextId("point"),
    type: "point",
    x,
    y: line.y,
    // An infinite end has no mark: the stroke just runs to the arrow.
    shape: infinite ? "none" : isClosed ? "dot" : "ring",
    size: Math.max(styles.point.size, 2.4),
    color: styles.point.color,
  });
  const p = end(a, from === null, closed[0]);
  const q = end(b, to === null, closed[1]);
  const s = newSegment(nextId("segment"), p.id, q.id, opts);
  const mark: Segment = { ...s, stroke: { ...s.stroke, width: INTERVAL_WIDTH, dash: "solid" } };
  const stretched = doc.elements.map((e) => (e.id === line.id ? line : e));
  return ok(withElements(doc, [...stretched, mark, p, q]), [mark.id, p.id, q.id]);
}

/** Adds `el` and, when `fresh`, the axes it was given, first so everything else draws over them. */
function withAxes(doc: FigureDoc, el: Element, axes: Axes, fresh: boolean): OpResult {
  const elements = fresh ? [axes, ...doc.elements, el] : [...doc.elements, el];
  return ok(withElements(doc, elements), fresh ? [el.id, axes.id] : [el.id]);
}

export function newAxes(id: Id): Axes {
  return {
    id,
    type: "axes",
    x: [...DEFAULT_PLOT_WINDOW.x],
    y: [...DEFAULT_PLOT_WINDOW.y],
    step: 1,
    numbers: true,
    names: ["x", "y"],
    stroke: { ...DEFAULT_AXES_STROKE },
    size: 8,
    fit: true,
  };
}

/** Axes on their own, before any graph: they fit the figure until their window is set by hand. */
export function addAxes(doc: FigureDoc): OpResult {
  if (doc.elements.some((e) => e.type === "axes")) return fail(doc, "A figura já tem eixos.");
  if (!roomFor(doc, 1)) return fail(doc, LIMIT_ERROR);
  const axes = newAxes(idMaker(doc)("axes"));
  // First, so everything else draws over them.
  return ok(withElements(doc, [axes, ...doc.elements]), [axes.id]);
}

/**
 * A printed square grid behind the figure: over the axes when there are
 * some, or around everything else.
 */
export function addGrid(doc: FigureDoc): OpResult {
  if (doc.elements.some((e) => e.type === "grid")) return fail(doc, "A figura já tem uma malha.");
  if (!roomFor(doc, 1)) return fail(doc, LIMIT_ERROR);
  const grid: Grid = {
    id: idMaker(doc)("grid"),
    type: "grid",
    x: [...DEFAULT_PLOT_WINDOW.x],
    y: [...DEFAULT_PLOT_WINDOW.y],
    step: 1,
    follow: doc.elements.some((e) => e.type === "axes") ? "axes" : "figure",
    stroke: { ...AXES_GRID },
  };
  return ok(withElements(doc, [grid, ...doc.elements]), [grid.id]);
}

/**
 * Where to put a point on a graph when the teacher gave no x: a whole
 * number just right of the middle of its domain, where the curve shows.
 */
function niceX(graph: FunctionGraph): number | null {
  const [a, b] = graph.domain;
  const start = Math.round((a + b) / 2) + 1;
  for (let i = 0; i <= Math.ceil(b - a); i++) {
    for (const x of i === 0 ? [start] : [start + i, start - i]) {
      if (x <= a || x >= b) continue;
      const y = functionValue(graph.expr, x);
      if (y !== null && y >= graph.range[0] && y <= graph.range[1]) return x;
    }
  }
  return null;
}

/**
 * A point on the graph `graphId` at x (or a whole x near the middle when
 * null), named `name` or the next free name. It follows the graph when the
 * expression changes, and slides along it when dragged.
 */
export function addPointOnGraph(
  doc: FigureDoc,
  graphId: Id,
  x: number | null,
  name = "",
  opts: OpOptions = {},
): OpResult {
  const graph = doc.elements.find((e): e is FunctionGraph => e.id === graphId && e.type === "function");
  if (!graph) return fail(doc, "Selecione um gráfico.");
  const at = x ?? niceX(graph);
  const y = at === null ? null : functionValue(graph.expr, at);
  if (at === null || y === null) {
    const where = at === null ? " na janela" : ` em x = ${formatNumber(at)}`;
    return fail(doc, `${graph.label?.text || "A função"} não está definida${where}.`);
  }
  if (Math.abs(at) > LIMITS.coordinate || Math.abs(y) > LIMITS.coordinate) {
    return fail(doc, "O ponto fica fora do limite da figura.");
  }
  if (!roomFor(doc, 1)) return fail(doc, LIMIT_ERROR);
  const spec = name ? { x: at, y, label: name } : { x: at, y };
  const [point] = buildPoints(doc, [spec], { ...opts, autoName: true }, idMaker(doc));
  const placed: Point = { ...point, construction: { kind: "onGraph", graph: graph.id, x: at } };
  return ok(withElements(doc, [...doc.elements, placed]), [placed.id]);
}

/** A point on the first selected graph, at a whole x where its curve shows. */
export function pointOnSelectedGraph(doc: FigureDoc, selection: Id[], opts: OpOptions = {}): OpResult {
  const [graph] = selectedOfType(doc, selection, "function");
  if (!graph) return fail(doc, "Selecione um gráfico.");
  return addPointOnGraph(doc, graph.id, null, "", opts);
}

/** Turns the dashed lines to the axes on for the selected points, or off when they all have them. */
export function toggleGuides(doc: FigureDoc, selection: Id[]): OpResult {
  const points = selectedOfType(doc, selection, "point");
  if (points.length === 0) return fail(doc, "Selecione pontos.");
  if (!doc.elements.some((e) => e.type === "axes")) return fail(doc, "A figura não tem eixos. Insira eixos antes: Gráficos › Eixos.");
  const on = points.some((p) => !p.guides);
  const next = updateElements(
    doc,
    points.map((p) => p.id),
    (el) => {
      if (el.type !== "point") return el;
      // In the point's color, so a red point's lines are red too.
      if (on) return el.guides ? el : { ...el, guides: { ...DEFAULT_GUIDE_STROKE, color: el.color } };
      const rest = { ...el };
      delete rest.guides;
      return rest;
    },
  );
  return ok(next);
}

const sameInterval = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];

/**
 * Changes the window of axes. Graphs drawn over the old window follow it, so
 * widening the axes widens the curves too; graphs given their own domain or
 * y cut keep it.
 */
export function setAxesWindow(doc: FigureDoc, id: Id, x: [number, number], y: [number, number]): OpResult {
  const axes = doc.elements.find((e): e is Axes => e.id === id && e.type === "axes");
  if (!axes) return fail(doc, "Selecione os eixos.");
  if (!(x[0] < x[1]) || !(y[0] < y[1])) return fail(doc, "O início precisa ser menor que o fim.");
  const elements = doc.elements.map((el): Element => {
    if (el.id === id) return { ...axes, x, y };
    if (el.type === "vline") return { ...el, range: sameInterval(el.range, axes.y) ? y : el.range };
    if (el.type !== "function") return el;
    return {
      ...el,
      domain: sameInterval(el.domain, axes.x) ? x : el.domain,
      range: sameInterval(el.range, axes.y) ? y : el.range,
    };
  });
  return ok(resolveConstructions(keepGraphMarks(doc, withElements(doc, elements))));
}
