import { DEFAULT_STYLES, LIMITS, type StyleDefaults } from "./defaults";
import {
  angleArc,
  circumcircle,
  constructionParents,
  distanceToLine,
  loopFromSegments,
  pointMap,
  projectOntoLine,
  resolveConstructions,
  signedArea2,
} from "./geometry";
import { labelFor, type LabelScheme, newMeasure, nextPointNames, withText } from "./labels";
import type { ParsedInput, ParsedPoint } from "./parse";
import type {
  Angle,
  Circle,
  CircleConstruction,
  Element,
  ElementType,
  FigureDoc,
  FreeText,
  Id,
  Point,
  PointConstruction,
  Polygon,
  Segment,
} from "./types";
import { dist, heading, lerp, normDeg, sub } from "./vec";

/** Result of an editing operation. On error the doc is returned unchanged. */
export interface OpResult {
  doc: FigureDoc;
  created: Id[];
  error?: string;
  /** Non-blocking notes, such as items that were skipped. */
  notice?: string;
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
  angle: "a",
  circle: "c",
  polygon: "g",
  text: "t",
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

function withElements(doc: FigureDoc, elements: Element[]): FigureDoc {
  return { ...doc, elements };
}

function roomFor(doc: FigureDoc, count: number): boolean {
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

export function angleExists(doc: FigureDoc, a: Id, vertex: Id, b: Id): boolean {
  return doc.elements.some(
    (e) =>
      e.type === "angle" &&
      e.vertex === vertex &&
      ((e.a === a && e.b === b) || (e.a === b && e.b === a)),
  );
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
  let working = doc;
  let degenerate = 0;
  for (const [a, v, b, reflex] of triples) {
    if (angleExists(working, a, v, b)) continue;
    const arc = angleArc(pts.get(a)!, pts.get(v)!, pts.get(b)!, false);
    if (!arc || arc.measure < 1e-6 || Math.abs(arc.measure - 180) < 1e-6) {
      degenerate++;
      continue;
    }
    const angle = newAngle(nextId("angle"), a, v, b, reflex, opts);
    created.push(angle);
    working = withElements(working, [...working.elements, angle]);
  }
  if (created.length === 0) {
    return fail(
      doc,
      degenerate > 0 ? "Os pontos estão alinhados, não há ângulo para marcar." : "Esses ângulos já existem.",
    );
  }
  if (!roomFor(doc, created.length)) return fail(doc, LIMIT_ERROR);
  return ok(working, created.map((a) => a.id));
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
  for (const el of doc.elements) {
    const refs = referencedPoints(el);
    if (refs.some((r) => gone.has(r))) gone.add(el.id);
  }
  return gone;
}

function referencedPoints(el: Element): Id[] {
  switch (el.type) {
    case "point":
    case "text":
      return [];
    case "segment":
      return [el.a, el.b];
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
  const gone = withOrphanHelpers(doc, cascadeIds(doc, ids));
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

/** Moves points and free texts. */
export function movePoints(doc: FigureDoc, moves: { id: Id; x: number; y: number }[]): FigureDoc {
  const byId = new Map(moves.map((m) => [m.id, m]));
  const elements = doc.elements.map((el) => {
    const m = byId.get(el.id);
    return m && (el.type === "point" || el.type === "text") ? { ...el, x: m.x, y: m.y } : el;
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
  return changed ? resolveConstructions(withElements(doc, elements)) : doc;
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

/**
 * Projects the first point onto the line through the other two. With
 * `withHeight`, also draws the perpendicular and marks the right angle.
 */
export function projectPoint(doc: FigureDoc, pointIds: Id[], withHeight: boolean, opts: OpOptions = {}): OpResult {
  const pts = pointMap(doc);
  const [p, a, b] = pointIds.map((id) => pts.get(id));
  if (!p || !a || !b) return fail(doc, "Selecione o ponto a projetar e depois dois pontos da reta.");
  if (dist(a, b) === 0) return fail(doc, "Os dois pontos da reta coincidem.");
  const foot = projectOntoLine(p, a, b);
  if (dist(foot, p) < 1e-9) return fail(doc, "O ponto já está sobre a reta.");

  const added = addPoints(doc, [{ x: foot.x, y: foot.y }], opts);
  if (added.error) return added;
  const footId = added.created[0];
  // The foot follows the point and the line when they move.
  const construction: PointConstruction = { kind: "foot", point: p.id, line: [a.id, b.id] };
  const placed = withElements(
    added.doc,
    added.doc.elements.map((e) => (e.id === footId && e.type === "point" ? { ...e, construction } : e)),
  );
  if (!withHeight) return ok(placed, [footId]);
  const joined = connectPoints(placed, [p.id, footId], false, opts);
  let working = joined.error ? placed : joined.doc;
  // The right angle needs an arm that isn't the foot itself.
  const arm = dist(foot, b) > 1e-9 ? b : a;
  const nextId = idMaker(working);
  const angle = newAngle(nextId("angle"), p.id, footId, arm.id, false, opts);
  working = withElements(working, [...working.elements, angle]);
  return ok(working, [footId, ...joined.created, angle.id]);
}

export type LabelTarget = "point" | "segment" | "angle";

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
  const texts = new Map<Id, string>();
  targets.forEach((el, i) => {
    const text = labelFor(scheme, i, el, doc, decimals);
    if (text !== null) texts.set(el.id, text);
  });
  // Measures become live labels that follow the points. Angles keep at most one decimal.
  const live = scheme === "length" || scheme === "measure";
  const elements = doc.elements.map((el) => {
    const text = texts.get(el.id);
    if (text === undefined || el.type === "text") return el;
    const label = withText(el.label, text, stylesOf(opts).label);
    const measure = live ? newMeasure(el, el.type === "angle" ? Math.min(decimals, 1) : decimals) : null;
    return { ...el, label: measure ? { ...label, measure } : label } as Element;
  });
  return ok(withElements(doc, elements));
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
    if (el.type === "text") return el;
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
