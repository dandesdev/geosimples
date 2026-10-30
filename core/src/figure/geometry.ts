import { functionValue } from "./plot";
import type { Angle, Circle, Element, FigureDoc, FunctionGraph, Id, Point, PointConstruction, Segment } from "./types";
import {
  add,
  cross,
  dist,
  dot,
  heading,
  len,
  lerp,
  mid,
  normDeg,
  perp,
  polar,
  scale,
  sub,
  unit,
  type Vec,
} from "./vec";

/** Right angles are detected within this tolerance, in degrees. */
export const RIGHT_ANGLE_TOLERANCE = 0.05;

export function pointMap(doc: FigureDoc): Map<Id, Point> {
  const map = new Map<Id, Point>();
  for (const el of doc.elements) if (el.type === "point") map.set(el.id, el);
  return map;
}

export function elementMap(doc: FigureDoc): Map<Id, Element> {
  return new Map(doc.elements.map((el) => [el.id, el]));
}

/** Arc of an angle mark: starts at `start` degrees and sweeps counterclockwise. */
export interface AngleArc {
  start: number;
  sweep: number;
  /** Measure in degrees of the marked side. */
  measure: number;
  isRight: boolean;
}

export function angleArc(a: Vec, vertex: Vec, b: Vec, reflex: boolean): AngleArc | null {
  const da = sub(a, vertex);
  const db = sub(b, vertex);
  if (len(da) === 0 || len(db) === 0) return null;
  const ha = heading(da);
  const hb = heading(db);
  const ccw = normDeg(hb - ha);
  // The smaller side starts at whichever arm reaches the other within 180°.
  let start = ccw <= 180 ? ha : hb;
  let sweep = ccw <= 180 ? ccw : 360 - ccw;
  if (reflex) {
    start = normDeg(start + sweep);
    sweep = 360 - sweep;
  }
  return {
    start,
    sweep,
    measure: sweep,
    isRight: Math.abs(sweep - 90) < RIGHT_ANGLE_TOLERANCE,
  };
}

/** Measure of an angle element in degrees, or null if its points are missing or coincide. */
export function angleMeasure(doc: FigureDoc, angle: Angle): number | null {
  const pts = pointMap(doc);
  const a = pts.get(angle.a);
  const v = pts.get(angle.vertex);
  const b = pts.get(angle.b);
  if (!a || !v || !b) return null;
  return angleArc(a, v, b, angle.reflex)?.measure ?? null;
}

/**
 * A mark drawn near a world point, defined by offsets in pt. Renderers place it
 * with their own unit scale, so marks keep their printed size.
 */
export interface OffsetLine {
  at: Vec;
  from: Vec;
  to: Vec;
}

export const TICK_HALF_LENGTH = 3.5;
export const TICK_GAP = 2.5;

/** Tick marks across the middle of a segment. */
export function segmentTicks(a: Vec, b: Vec, count: number): OffsetLine[] {
  if (count <= 0) return [];
  const along = unit(sub(b, a));
  if (len(along) === 0) return [];
  const normal = perp(along);
  const center = mid(a, b);
  const lines: OffsetLine[] = [];
  for (let i = 0; i < count; i++) {
    const shift = scale(along, (i - (count - 1) / 2) * TICK_GAP);
    lines.push({
      at: center,
      from: add(shift, scale(normal, TICK_HALF_LENGTH)),
      to: add(shift, scale(normal, -TICK_HALF_LENGTH)),
    });
  }
  return lines;
}

export const ANGLE_ARC_GAP = 2.5;

/** Radii in pt of the concentric arcs of an angle mark. */
export function angleArcRadii(angle: Pick<Angle, "radius" | "arcs">): number[] {
  return Array.from({ length: angle.arcs }, (_, i) => angle.radius + i * ANGLE_ARC_GAP);
}

/** Tick marks across an angle arc, evenly spread over the sweep. */
export function angleTicks(arc: AngleArc, radius: number, count: number): OffsetLine[] {
  const lines: OffsetLine[] = [];
  for (let i = 0; i < count; i++) {
    const deg = arc.start + (arc.sweep * (i + 1)) / (count + 1);
    lines.push({
      at: { x: 0, y: 0 },
      from: polar(radius - TICK_HALF_LENGTH, deg),
      to: polar(radius + TICK_HALF_LENGTH, deg),
    });
  }
  return lines;
}

/** Corners of the right-angle square, as pt offsets from the vertex. */
export function rightAngleSquare(arc: AngleArc, radius: number): [Vec, Vec, Vec] {
  const side = radius * 0.7;
  const u1 = polar(side, arc.start);
  const u2 = polar(side, arc.start + 90);
  return [u1, add(u1, u2), u2];
}

/** Center and radius of the circle through three points, or null if they are collinear. */
export function circumcircle(a: Vec, b: Vec, c: Vec): { center: Vec; radius: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const center = {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
  return { center, radius: dist(center, a) };
}

/** Distance from p to the infinite line through a and b. */
export function distanceToLine(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const l = len(ab);
  if (l === 0) return dist(p, a);
  return Math.abs(cross(ab, sub(p, a))) / l;
}

/** Foot of the perpendicular from p to the line through a and b. */
export function projectOntoLine(p: Vec, a: Vec, b: Vec): Vec {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 === 0) return a;
  return add(a, scale(ab, dot(sub(p, a), ab) / l2));
}

/** Twice the signed area. Positive when the vertices run counterclockwise. */
export function signedArea2(vertices: Vec[]): number {
  let s = 0;
  for (let i = 0; i < vertices.length; i++) {
    s += cross(vertices[i], vertices[(i + 1) % vertices.length]);
  }
  return s;
}

export function centroid(points: Vec[]): Vec {
  if (points.length === 0) return { x: 0, y: 0 };
  const s = points.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
  return scale(s, 1 / points.length);
}

/** True when segments ab and cd cross, not counting shared endpoints. */
export function segmentsCross(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const eps = 1e-9;
  const same = (p: Vec, q: Vec) => dist(p, q) < eps;
  if (same(a, c) || same(a, d) || same(b, c) || same(b, d)) return false;
  const o1 = cross(sub(b, a), sub(c, a));
  const o2 = cross(sub(b, a), sub(d, a));
  const o3 = cross(sub(d, c), sub(a, c));
  const o4 = cross(sub(d, c), sub(b, c));
  return o1 * o2 < -eps && o3 * o4 < -eps;
}

/**
 * Orders the vertices of a closed loop of segments (the "close figure" action
 * from v1). Returns null with a reason when the segments don't form a single
 * simple loop.
 */
export function loopFromSegments(
  segments: Segment[],
  points: Map<Id, Point>,
): { vertices: Id[] } | { error: string } {
  if (segments.length < 3) {
    return { error: "Selecione ao menos três segmentos que formem um contorno fechado." };
  }
  const adjacency = new Map<Id, Id[]>();
  for (const s of segments) {
    adjacency.set(s.a, [...(adjacency.get(s.a) ?? []), s.b]);
    adjacency.set(s.b, [...(adjacency.get(s.b) ?? []), s.a]);
  }
  for (const neighbors of adjacency.values()) {
    if (neighbors.length !== 2) {
      return { error: "Os segmentos devem se ligar um a um, sem bifurcações nem pontas soltas." };
    }
  }
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const [a, b, c, d] = [segments[i].a, segments[i].b, segments[j].a, segments[j].b].map(
        (id) => points.get(id),
      );
      if (a && b && c && d && segmentsCross(a, b, c, d)) {
        return { error: "Os segmentos selecionados se cruzam." };
      }
    }
  }
  const start = segments[0].a;
  const vertices: Id[] = [start];
  let prev: Id | null = null;
  let current = start;
  for (;;) {
    const next: Id | undefined = adjacency.get(current)!.find((n) => n !== prev);
    if (next === undefined || next === start) break;
    vertices.push(next);
    prev = current;
    current = next;
    if (vertices.length > segments.length) break;
  }
  if (vertices.length !== segments.length) {
    return { error: "Os segmentos devem formar um único contorno fechado." };
  }
  return { vertices };
}

/** Passes over the figure before giving up on settling chained constructions. */
const MAX_RESOLVE_PASSES = 16;

/**
 * Rebuilds constructed circles and points after points move. Constructions
 * can build on each other in any order, so this repeats until nothing moves.
 */
export function resolveConstructions(doc: FigureDoc): FigureDoc {
  let changed = false;
  const elements = doc.elements.slice();
  const pts = pointMap(doc);
  const circles = new Map<Id, Circle>();
  const segments = new Map<Id, Segment>();
  const graphs = new Map<Id, FunctionGraph>();
  for (const el of doc.elements) {
    if (el.type === "circle") circles.set(el.id, el);
    else if (el.type === "segment") segments.set(el.id, el);
    else if (el.type === "function") graphs.set(el.id, el);
  }
  const replacePoint = (p: Point) => {
    const i = elements.findIndex((e) => e.id === p.id);
    if (i >= 0) elements[i] = p;
    pts.set(p.id, p);
  };

  for (let pass = 0; pass < MAX_RESOLVE_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el.type === "circle") {
        const next = resolveCircle(el, pts, segments);
        if (!next) continue;
        if (next.circle !== el) {
          elements[i] = next.circle;
          circles.set(el.id, next.circle);
          moved = true;
        }
        if (next.center) {
          replacePoint(next.center);
          moved = true;
        }
      } else if (el.type === "point" && el.construction) {
        const at = constructedPosition(el.construction, pts, segments, circles, graphs);
        if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) continue;
        if (Math.abs(at.x - el.x) < 1e-12 && Math.abs(at.y - el.y) < 1e-12) continue;
        const next = { ...el, x: at.x, y: at.y };
        elements[i] = next;
        pts.set(el.id, next);
        moved = true;
      }
    }
    if (!moved) break;
    changed = true;
  }
  return changed ? { ...doc, elements } : doc;
}

function resolveCircle(
  circle: Circle,
  pts: Map<Id, Point>,
  segments: Map<Id, Segment>,
): { circle: Circle; center?: Point } | null {
  const center = pts.get(circle.center);
  if (!center) return null;
  const c = circle.construction;
  let radius = circle.radius;
  let movedCenter: Point | undefined;
  if (c.kind === "through") {
    const p = pts.get(c.point);
    if (p) radius = dist(center, p);
  } else if (c.kind === "tangent") {
    const s = segments.get(c.segment);
    const a = s && pts.get(s.a);
    const b = s && pts.get(s.b);
    if (a && b) radius = distanceToLine(center, a, b);
  } else if (c.kind === "circumcircle") {
    const [p, q, r] = c.points.map((id) => pts.get(id));
    const solved = p && q && r ? circumcircle(p, q, r) : null;
    if (solved) {
      radius = solved.radius;
      if (dist(solved.center, center) > 1e-12) {
        movedCenter = { ...center, x: solved.center.x, y: solved.center.y };
      }
    }
  }
  if (!(radius > 1e-9)) return null;
  const sameRadius = Math.abs(radius - circle.radius) < 1e-12;
  return {
    circle: sameRadius ? circle : { ...circle, radius },
    center: movedCenter,
  };
}

/** Where the lines through ab and cd meet, with the parameters along each, or null if they are parallel. */
export function lineIntersection(a: Vec, b: Vec, c: Vec, d: Vec): { point: Vec; t: number; u: number } | null {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = cross(r, s);
  if (den === 0 || Math.abs(den) <= 1e-12 * len(r) * len(s)) return null;
  const ac = sub(c, a);
  const t = cross(ac, s) / den;
  return { point: add(a, scale(r, t)), t, u: cross(ac, r) / den };
}

/** Parameters along ab, in increasing order, where the line through a and b meets a circle. */
export function lineCircleParams(a: Vec, b: Vec, center: Vec, radius: number): number[] {
  const d = sub(b, a);
  const f = sub(a, center);
  const qa = dot(d, d);
  if (qa === 0) return [];
  const qb = 2 * dot(f, d);
  const qc = dot(f, f) - radius * radius;
  const disc = qb * qb - 4 * qa * qc;
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  return [(-qb - root) / (2 * qa), (-qb + root) / (2 * qa)];
}

/** Crossings of two circles: left of the c1 → c2 direction first. Null if they don't meet. */
export function circleCircle(c1: Vec, r1: number, c2: Vec, r2: number): [Vec, Vec] | null {
  const d = dist(c1, c2);
  if (d === 0 || d > r1 + r2 + 1e-12 || d < Math.abs(r1 - r2) - 1e-12) return null;
  const along = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - along * along));
  const u = unit(sub(c2, c1));
  const base = add(c1, scale(u, along));
  const n = perp(u);
  return [add(base, scale(n, h)), add(base, scale(n, -h))];
}

/** True when p, a point of the circle, lies on its drawn arc. */
export function onCircleArc(circle: Pick<Circle, "arc">, center: Vec, p: Vec): boolean {
  if (!circle.arc) return true;
  const sweep = normDeg(circle.arc.end - circle.arc.start) || 360;
  return normDeg(heading(sub(p, center)) - circle.arc.start) <= sweep + 1e-9;
}

/** Unit direction of the bisector of the marked angle a → vertex → b, or null if an arm has no length. */
export function bisectorDirection(a: Vec, vertex: Vec, b: Vec, reflex: boolean): Vec | null {
  const arc = angleArc(a, vertex, b, reflex);
  return arc ? polar(1, arc.start + arc.sweep / 2) : null;
}

/** A crossing of two segments or circles. `inside` is false when it falls on an extension or off an arc. */
export interface Crossing {
  point: Vec;
  index: 0 | 1;
  inside: boolean;
}

/** Crossings of two segments or circles, numbered as PointConstruction "intersection" numbers them. */
export function crossings(first: Segment | Circle, second: Segment | Circle, pts: Map<Id, Point>): Crossing[] {
  const eps = 1e-9;
  const within = (t: number) => t >= -eps && t <= 1 + eps;
  if (first.type === "segment" && second.type === "segment") {
    const [a, b, c, d] = [first.a, first.b, second.a, second.b].map((id) => pts.get(id));
    const hit = a && b && c && d ? lineIntersection(a, b, c, d) : null;
    return hit ? [{ point: hit.point, index: 0, inside: within(hit.t) && within(hit.u) }] : [];
  }
  if (first.type === "circle" && second.type === "circle") {
    const c1 = pts.get(first.center);
    const c2 = pts.get(second.center);
    const both = c1 && c2 ? circleCircle(c1, first.radius, c2, second.radius) : null;
    if (!c1 || !c2 || !both) return [];
    const hits = dist(both[0], both[1]) < eps ? [both[0]] : both;
    return hits.map((point, i) => ({
      point,
      index: i as 0 | 1,
      inside: onCircleArc(first, c1, point) && onCircleArc(second, c2, point),
    }));
  }
  const seg = first.type === "segment" ? first : (second as Segment);
  const circle = first.type === "circle" ? first : (second as Circle);
  const a = pts.get(seg.a);
  const b = pts.get(seg.b);
  const center = pts.get(circle.center);
  if (!a || !b || !center) return [];
  const ts = lineCircleParams(a, b, center, circle.radius);
  const unique = ts.length === 2 && Math.abs(ts[0] - ts[1]) < eps ? [ts[0]] : ts;
  return unique.map((t, i) => {
    const point = lerp(a, b, t);
    return { point, index: i as 0 | 1, inside: within(t) && onCircleArc(circle, center, point) };
  });
}

/** Where a constructed point goes now, or null to leave it where it is. */
export function constructedPosition(
  c: PointConstruction,
  pts: Map<Id, Point>,
  segments: Map<Id, Segment>,
  circles: Map<Id, Circle>,
  graphs: Map<Id, FunctionGraph> = new Map(),
): Vec | null {
  switch (c.kind) {
    case "midpoint": {
      const [p, q] = c.points.map((id) => pts.get(id));
      return p && q ? mid(p, q) : null;
    }
    case "foot": {
      const p = pts.get(c.point);
      const [a, b] = c.line.map((id) => pts.get(id));
      if (!p || !a || !b || dist(a, b) === 0) return null;
      return projectOntoLine(p, a, b);
    }
    case "bisector": {
      const [a, v, b] = c.angle.map((id) => pts.get(id));
      const dir = a && v && b ? bisectorDirection(a, v, b, c.reflex) : null;
      if (!v || !dir) return null;
      if (!c.line) return add(v, scale(dir, c.length));
      const [p, q] = c.line.map((id) => pts.get(id));
      const hit = p && q ? lineIntersection(v, add(v, dir), p, q) : null;
      return hit && hit.t > 1e-9 ? hit.point : null;
    }
    case "perpendicular": {
      const [p, q] = c.points.map((id) => pts.get(id));
      if (!p || !q) return null;
      const normal = perp(sub(q, p));
      return add(lerp(p, q, c.along), scale(c.fixed ? unit(normal) : normal, c.across));
    }
    case "intersection": {
      const [first, second] = c.of.map((id) => segments.get(id) ?? circles.get(id));
      if (!first || !second) return null;
      const all = crossings(first, second, pts);
      return (all.find((x) => x.index === c.index) ?? all[0])?.point ?? null;
    }
    case "arcEnd": {
      const circle = circles.get(c.circle);
      const center = circle && pts.get(circle.center);
      if (!circle?.arc || !center) return null;
      return add(center, polar(circle.radius, c.end === 0 ? circle.arc.start : circle.arc.end));
    }
    case "onGraph": {
      // Where f is undefined at x now, the point stays where it was, like a lost intersection.
      const graph = graphs.get(c.graph);
      const y = graph ? functionValue(graph.expr, c.x) : null;
      return y === null ? null : { x: c.x, y };
    }
  }
}

/** Ids a point construction is built from. */
export function constructionParents(c: PointConstruction): Id[] {
  switch (c.kind) {
    case "midpoint":
    case "perpendicular":
      return c.points;
    case "foot":
      return [c.point, ...c.line];
    case "bisector":
      return [...c.angle, ...(c.line ?? [])];
    case "intersection":
      return c.of;
    case "arcEnd":
      return [c.circle];
    case "onGraph":
      return [c.graph];
  }
}
