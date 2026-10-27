import { DEFAULT_STYLES, LIMITS } from "./defaults";
import {
  angleArc,
  bisectorDirection,
  constructionParents,
  crossings,
  distanceToLine,
  lineIntersection,
  pointMap,
  projectOntoLine,
} from "./geometry";
import { nextPointNames, withText } from "./labels";
import {
  angleExists,
  idMaker,
  LIMIT_ERROR,
  newAngle,
  newSegment,
  segmentExists,
  selectedOfType,
  type OpOptions,
  type OpResult,
} from "./ops";
import type { Circle, Element, FigureDoc, Id, Point, PointConstruction, Segment, Stroke } from "./types";
import { add, dist, dot, mid, perp, scale, sub, type Vec } from "./vec";

/** The classic constructions, as offered by the editor's Construções menu. */
export type ConstructionKind =
  | "midpoint"
  | "altitude"
  | "median"
  | "bisector"
  | "perpendicularBisector"
  | "intersection";

export function construct(doc: FigureDoc, selection: Id[], kind: ConstructionKind, opts: OpOptions = {}): OpResult {
  switch (kind) {
    case "midpoint":
      return makeMidpoint(doc, selection, opts);
    case "altitude":
      return makeAltitude(doc, selection, opts);
    case "median":
      return makeMedian(doc, selection, opts);
    case "bisector":
      return makeBisector(doc, selection, opts);
    case "perpendicularBisector":
      return makePerpendicularBisector(doc, selection, true, opts);
    case "intersection":
      return makeIntersection(doc, selection, opts);
  }
}

const fail = (doc: FigureDoc, error: string): OpResult => ({ doc, created: [], error });

/** Two points closer than this are the same point. */
const SAME = 1e-9;

/**
 * Collects what a construction adds. Constructed points that already exist
 * with the same parents and position, and existing segments and angles, are
 * reused instead of doubled.
 */
function draft(doc: FigureDoc, opts: OpOptions) {
  const styles = opts.styles ?? DEFAULT_STYLES;
  const nextId = idMaker(doc);
  const created: Id[] = [];
  let working = doc;
  const push = (el: Element) => {
    working = { ...working, elements: [...working.elements, el] };
    created.push(el.id);
  };

  return {
    /** Adds a point that follows its construction, or finds the one already there. */
    point(at: Vec, construction: PointConstruction, hidden = false): Id {
      const existing = findConstructed(working, construction, at);
      if (existing) return existing.id;
      const name = !hidden && opts.autoName ? nextPointNames(working, 1)[0] : undefined;
      const p: Point = {
        id: nextId("point"),
        type: "point",
        x: at.x,
        y: at.y,
        ...styles.point,
        ...(hidden ? { shape: "none" as const } : {}),
        ...(name ? { label: withText(undefined, name, styles.label) } : {}),
        construction,
      };
      push(p);
      return p.id;
    },
    segment(a: Id, b: Id, stroke: Partial<Stroke> = {}) {
      if (a === b || segmentExists(working, a, b)) return;
      const s = newSegment(nextId("segment"), a, b, opts);
      push({ ...s, stroke: { ...s.stroke, ...stroke } });
    },
    /** Marks the angle a → vertex → b, which the construction makes right, with a square. */
    rightAngle(a: Id, vertex: Id, b: Id) {
      if (angleExists(working, a, vertex, b)) return;
      push({ ...newAngle(nextId("angle"), a, vertex, b, false, opts), rightMark: true });
    },
    get doc() {
      return working;
    },
    result(exists: string): OpResult {
      if (created.length === 0) return fail(doc, exists);
      if (working.elements.length > LIMITS.elements) return fail(doc, LIMIT_ERROR);
      return { doc: working, created };
    },
  };
}

function sameParents(a: PointConstruction, b: PointConstruction): boolean {
  if (a.kind !== b.kind) return false;
  const key = (c: PointConstruction) => [...constructionParents(c)].sort().join(",");
  return key(a) === key(b);
}

function findConstructed(doc: FigureDoc, c: PointConstruction, at: Vec): Point | undefined {
  return doc.elements.find(
    (e): e is Point =>
      e.type === "point" && !!e.construction && sameParents(e.construction, c) && dist(e, at) < SAME,
  );
}

/** Point pairs from the selected segments, plus the two selected points. */
function selectedPairs(doc: FigureDoc, selection: Id[]): [Id, Id][] {
  const pairs: [Id, Id][] = selectedOfType(doc, selection, "segment").map((s) => [s.a, s.b]);
  const points = selectedOfType(doc, selection, "point");
  if (points.length === 2) pairs.push([points[0].id, points[1].id]);
  return pairs;
}

/** Sides opposite to `vertex` in the triangles it belongs to, from polygons or segments. */
function trianglesAt(doc: FigureDoc, vertex: Id): [Id, Id][] {
  const sides = new Map<string, [Id, Id]>();
  const put = (a: Id, b: Id) => sides.set([a, b].sort().join(","), [a, b]);
  for (const el of doc.elements) {
    if (el.type === "polygon" && el.vertices.length === 3 && el.vertices.includes(vertex)) {
      const [a, b] = el.vertices.filter((v) => v !== vertex);
      if (a && b) put(a, b);
    }
  }
  const neighbors = doc.elements.flatMap((e) =>
    e.type !== "segment" ? [] : e.a === vertex ? [e.b] : e.b === vertex ? [e.a] : [],
  );
  for (let i = 0; i < neighbors.length; i++) {
    for (let j = i + 1; j < neighbors.length; j++) {
      if (segmentExists(doc, neighbors[i], neighbors[j])) put(neighbors[i], neighbors[j]);
    }
  }
  return [...sides.values()];
}

interface VertexSide {
  vertex: Id;
  side: [Id, Id];
}

const VERTEX_SIDE_HINT =
  "Selecione um vértice e o lado oposto (um segmento ou dois pontos), ou um triângulo para traçar as três.";

/**
 * Reads "a vertex and the opposite side" from the selection: a point and a
 * segment, three points (vertex first), a triangle (all three vertices), or
 * a vertex of a single triangle.
 */
function vertexAndSide(doc: FigureDoc, selection: Id[]): VertexSide[] | { error: string } {
  const pts = pointMap(doc);
  const points = selectedOfType(doc, selection, "point");
  const segments = selectedOfType(doc, selection, "segment");
  const triangles = selectedOfType(doc, selection, "polygon").filter((g) => g.vertices.length === 3);

  let found: VertexSide[] = [];
  if (triangles.length > 0) {
    for (const g of triangles) {
      const [a, b, c] = g.vertices;
      found.push({ vertex: a, side: [b, c] }, { vertex: b, side: [c, a] }, { vertex: c, side: [a, b] });
    }
  } else if (points.length >= 1 && segments.length >= 1) {
    // A box around a triangle also selects the sides at the vertex: skip them.
    const vertex = points[0].id;
    const side = segments.find((g) => g.a !== vertex && g.b !== vertex) ?? segments[0];
    found = [{ vertex, side: [side.a, side.b] }];
  } else if (points.length === 3) {
    found = [{ vertex: points[0].id, side: [points[1].id, points[2].id] }];
  } else if (points.length === 1) {
    const sides = trianglesAt(doc, points[0].id);
    if (sides.length !== 1) {
      return {
        error:
          sides.length === 0
            ? "Selecione também o lado oposto: um segmento ou dois pontos."
            : "O ponto é vértice de mais de um triângulo. Selecione também o lado oposto.",
      };
    }
    found = [{ vertex: points[0].id, side: sides[0] }];
  } else {
    return { error: VERTEX_SIDE_HINT };
  }

  for (const { vertex, side } of found) {
    const [v, a, b] = [vertex, ...side].map((id) => pts.get(id));
    if (!v || !a || !b) return { error: VERTEX_SIDE_HINT };
    if (side.includes(vertex)) return { error: "O vértice não pode ser uma ponta do lado oposto." };
    if (dist(a, b) < SAME) return { error: "As pontas do lado coincidem." };
    if (distanceToLine(v, a, b) < SAME) return { error: "O vértice está sobre a reta do lado oposto." };
  }
  return found;
}

/** Midpoints of the selected segments, or of two selected points. */
export function makeMidpoint(doc: FigureDoc, selection: Id[], opts: OpOptions = {}): OpResult {
  const pairs = selectedPairs(doc, selection);
  if (pairs.length === 0) return fail(doc, "Selecione um segmento ou dois pontos.");
  const pts = pointMap(doc);
  const d = draft(doc, opts);
  let coincident = 0;
  for (const [a, b] of pairs) {
    const p = pts.get(a)!;
    const q = pts.get(b)!;
    if (dist(p, q) < SAME) {
      coincident++;
      continue;
    }
    d.point(mid(p, q), { kind: "midpoint", points: [a, b] });
  }
  return d.result(coincident === pairs.length ? "Os dois pontos coincidem." : "Esse ponto médio já existe.");
}

/**
 * Heights from a vertex to the line of the opposite side: the foot, the
 * height and its right-angle mark. When the foot falls outside the side, a
 * dashed extension of the side reaches it.
 */
export function makeAltitude(doc: FigureDoc, selection: Id[], opts: OpOptions = {}): OpResult {
  const found = vertexAndSide(doc, selection);
  if ("error" in found) return fail(doc, found.error);
  const pts = pointMap(doc);
  const d = draft(doc, opts);
  for (const { vertex, side } of found) {
    const [a, b] = side;
    const v = pts.get(vertex)!;
    const pa = pts.get(a)!;
    const pb = pts.get(b)!;
    const foot = projectOntoLine(v, pa, pb);
    // In a right triangle the foot is a vertex already there.
    const footId =
      dist(foot, pa) < SAME
        ? a
        : dist(foot, pb) < SAME
          ? b
          : d.point(foot, { kind: "foot", point: vertex, line: [a, b] });
    d.segment(vertex, footId);
    const ab = sub(pb, pa);
    const t = dot(sub(foot, pa), ab) / dot(ab, ab);
    if (t < 0 && footId !== a) d.segment(a, footId, { dash: "dashed" });
    if (t > 1 && footId !== b) d.segment(b, footId, { dash: "dashed" });
    const arm = footId === a ? b : footId === b ? a : dist(foot, pa) > dist(foot, pb) ? a : b;
    d.rightAngle(vertex, footId, arm);
  }
  return d.result(found.length > 1 ? "Essas alturas já existem." : "Essa altura já existe.");
}

/** Medians: the segment from a vertex to the midpoint of the opposite side. */
export function makeMedian(doc: FigureDoc, selection: Id[], opts: OpOptions = {}): OpResult {
  const found = vertexAndSide(doc, selection);
  if ("error" in found) return fail(doc, found.error);
  const pts = pointMap(doc);
  const d = draft(doc, opts);
  for (const { vertex, side } of found) {
    const m = d.point(mid(pts.get(side[0])!, pts.get(side[1])!), { kind: "midpoint", points: side });
    d.segment(vertex, m);
  }
  return d.result(found.length > 1 ? "Essas medianas já existem." : "Essa mediana já existe.");
}

interface AngleChoice {
  a: Id;
  vertex: Id;
  b: Id;
  reflex: boolean;
}

/**
 * Angle bisectors of the selected angles, of A, B, C (the angle at B), of a
 * triangle's three angles, or of the angle at a selected triangle vertex. In a
 * triangle or polygon the bisector ends on the opposite side, elsewhere it
 * is as long as the shorter arm.
 */
export function makeBisector(doc: FigureDoc, selection: Id[], opts: OpOptions = {}): OpResult {
  const pts = pointMap(doc);
  const choices: AngleChoice[] = selectedOfType(doc, selection, "angle").map((g) => ({
    a: g.a,
    vertex: g.vertex,
    b: g.b,
    reflex: g.reflex,
  }));
  for (const g of selectedOfType(doc, selection, "polygon")) {
    if (g.vertices.length !== 3) continue;
    const [a, b, c] = g.vertices;
    choices.push(
      { a: c, vertex: a, b, reflex: false },
      { a, vertex: b, b: c, reflex: false },
      { a: b, vertex: c, b: a, reflex: false },
    );
  }
  const points = selectedOfType(doc, selection, "point");
  if (choices.length === 0 && points.length === 3) {
    choices.push({ a: points[0].id, vertex: points[1].id, b: points[2].id, reflex: false });
  } else if (choices.length === 0 && points.length === 1) {
    const sides = trianglesAt(doc, points[0].id);
    if (sides.length === 1) choices.push({ a: sides[0][0], vertex: points[0].id, b: sides[0][1], reflex: false });
  }
  if (choices.length === 0) {
    return fail(doc, "Selecione um ângulo, três pontos (A, B, C traça a bissetriz em B) ou um triângulo.");
  }

  const d = draft(doc, opts);
  let degenerate = 0;
  for (const { a, vertex, b, reflex } of choices) {
    const [pa, v, pb] = [a, vertex, b].map((id) => pts.get(id)!);
    const arc = angleArc(pa, v, pb, reflex);
    const dir = bisectorDirection(pa, v, pb, reflex);
    if (!arc || !dir || arc.measure < 1e-6 || arc.measure > 360 - 1e-6) {
      degenerate++;
      continue;
    }
    const angle: [Id, Id, Id] = [a, vertex, b];
    const line = oppositeSide(doc, pts, angle, dir);
    if (line) {
      const length = dist(v, line.at);
      const end = d.point(line.at, { kind: "bisector", angle, reflex, line: line.ends, length });
      d.segment(vertex, end);
    } else {
      const length = Math.min(dist(pa, v), dist(pb, v));
      const end = d.point(add(v, scale(dir, length)), { kind: "bisector", angle, reflex, line: null, length }, true);
      d.segment(vertex, end);
    }
  }
  if (degenerate === choices.length) return fail(doc, "Os pontos estão alinhados, não há ângulo para dividir.");
  return d.result(choices.length > 1 ? "Essas bissetrizes já existem." : "Essa bissetriz já existe.");
}

/**
 * The side a bisector from the vertex ends on: segment ab when the angle
 * closes a triangle, else the nearest side of a polygon with that angle.
 */
function oppositeSide(
  doc: FigureDoc,
  pts: Map<Id, Point>,
  [a, vertex, b]: [Id, Id, Id],
  dir: Vec,
): { ends: [Id, Id]; at: Vec } | null {
  const v = pts.get(vertex)!;
  const hitOn = (p: Id, q: Id) => {
    const hit = lineIntersection(v, add(v, dir), pts.get(p)!, pts.get(q)!);
    return hit && hit.t > SAME && hit.u >= -SAME && hit.u <= 1 + SAME ? hit : null;
  };
  const closesTriangle =
    segmentExists(doc, a, b) ||
    doc.elements.some((e) => e.type === "polygon" && e.vertices.length === 3 && [a, vertex, b].every((id) => e.vertices.includes(id)));
  if (closesTriangle) {
    const hit = hitOn(a, b);
    if (hit) return { ends: [a, b], at: hit.point };
  }
  let best: { ends: [Id, Id]; at: Vec; t: number } | null = null;
  for (const el of doc.elements) {
    if (el.type !== "polygon") continue;
    const vs = el.vertices;
    const i = vs.indexOf(vertex);
    if (i < 0) continue;
    const n = vs.length;
    const around = [vs[(i + n - 1) % n], vs[(i + 1) % n]];
    if (!(around.includes(a) && around.includes(b))) continue;
    for (let k = 0; k < n; k++) {
      const p = vs[k];
      const q = vs[(k + 1) % n];
      if (p === vertex || q === vertex) continue;
      const hit = hitOn(p, q);
      if (hit && (!best || hit.t < best.t)) best = { ends: [p, q], at: hit.point, t: hit.t };
    }
  }
  return best && { ends: best.ends, at: best.at };
}

/**
 * Perpendicular bisectors of the selected segments, or of two selected points:
 * a segment as long as the original through its midpoint, with an optional
 * right-angle mark. Its ends are hidden points that follow the segment.
 */
export function makePerpendicularBisector(
  doc: FigureDoc,
  selection: Id[],
  withMark: boolean,
  opts: OpOptions = {},
): OpResult {
  const pairs = selectedPairs(doc, selection);
  if (pairs.length === 0) return fail(doc, "Selecione um segmento ou dois pontos.");
  const pts = pointMap(doc);
  const d = draft(doc, opts);
  let coincident = 0;
  for (const points of pairs) {
    const [p, q] = points.map((id) => pts.get(id)!);
    if (dist(p, q) < SAME) {
      coincident++;
      continue;
    }
    const m = d.point(mid(p, q), { kind: "midpoint", points });
    const end = (across: number) =>
      d.point(add(mid(p, q), scale(perp(sub(q, p)), across)), { kind: "perpendicular", points, along: 0.5, across }, true);
    const top = end(0.5);
    d.segment(top, end(-0.5));
    if (withMark) d.rightAngle(top, m, points[1]);
  }
  return d.result(coincident === pairs.length ? "Os dois pontos coincidem." : "Essa mediatriz já existe.");
}

/** Most segments and circles the intersection action compares pairwise. */
const MAX_INTERSECTED = 12;

/**
 * Points where the selected segments and circles cross each other. Crossings
 * at points already in the figure are skipped.
 */
export function makeIntersection(doc: FigureDoc, selection: Id[], opts: OpOptions = {}): OpResult {
  const byId = new Map(doc.elements.map((e) => [e.id, e]));
  const curves = selection
    .map((id) => byId.get(id))
    .filter((e): e is Segment | Circle => e?.type === "segment" || e?.type === "circle");
  if (curves.length < 2) return fail(doc, "Selecione dois segmentos ou circunferências que se cruzem.");
  if (curves.length > MAX_INTERSECTED) {
    return fail(doc, `Selecione no máximo ${MAX_INTERSECTED} segmentos ou circunferências.`);
  }
  const pts = pointMap(doc);
  const d = draft(doc, opts);
  let crossed = 0;
  for (let i = 0; i < curves.length; i++) {
    for (let j = i + 1; j < curves.length; j++) {
      for (const x of crossings(curves[i], curves[j], pts)) {
        if (!x.inside) continue;
        crossed++;
        const taken = d.doc.elements.some((e) => e.type === "point" && dist(e, x.point) < SAME);
        if (taken) continue;
        d.point(x.point, { kind: "intersection", of: [curves[i].id, curves[j].id], index: x.index });
      }
    }
  }
  if (crossed === 0) return fail(doc, "Os objetos selecionados não se cruzam.");
  return d.result("Os objetos já se cruzam em pontos da figura.");
}

/** Makes constructed points free: they stay where they are and stop following their parents. */
export function freePoints(doc: FigureDoc, ids: Id[]): OpResult {
  const set = new Set(ids);
  let freed = 0;
  const elements = doc.elements.map((el) => {
    if (el.type !== "point" || !el.construction || !set.has(el.id)) return el;
    freed++;
    const next = { ...el };
    delete next.construction;
    return next;
  });
  if (freed === 0) return fail(doc, "Os pontos selecionados já são livres.");
  return { doc: { ...doc, elements }, created: [] };
}
