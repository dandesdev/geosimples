import { findRoots } from "../plot";
import { functionValue, graphFn, notablePoints } from "./plot";
import type {
  Angle,
  Circle,
  Element,
  Extension,
  FigureDoc,
  FunctionGraph,
  Id,
  Point,
  PointConstruction,
  Segment,
  VerticalLine,
} from "./types";
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

/**
 * Where an extension is drawn now: from the nearer end of its segment to its
 * point, or null while the point is on the segment (or no longer on its line).
 */
export function extensionEnds(ext: Extension, pts: Map<Id, Point>): [Point, Point] | null {
  const a = pts.get(ext.line[0]);
  const b = pts.get(ext.line[1]);
  const p = pts.get(ext.point);
  if (!a || !b || !p) return null;
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < 1e-18 || distanceToLine(p, a, b) > 1e-6 * Math.max(1, Math.sqrt(l2))) return null;
  const t = dot(sub(p, a), ab) / l2;
  if (t < -1e-6) return [a, p];
  if (t > 1 + 1e-6) return [b, p];
  return null;
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
  const graphs = new Map<Id, FunctionGraph | VerticalLine>();
  for (const el of doc.elements) {
    if (el.type === "circle") circles.set(el.id, el);
    else if (el.type === "segment") segments.set(el.id, el);
    else if (el.type === "function" || el.type === "vline") graphs.set(el.id, el);
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
  index: number;
  inside: boolean;
}

/** What intersections are taken between. */
export type Curve = Segment | Circle | FunctionGraph | VerticalLine;

const CURVE_TYPES: Element["type"][] = ["segment", "circle", "function", "vline"];

export const isCurve = (el: Element | undefined): el is Curve => !!el && CURVE_TYPES.includes(el.type);

const isPlain = (c: Curve): c is Segment | Circle => c.type === "segment" || c.type === "circle";

const within = (v: number, [a, b]: [number, number]) => v >= a - 1e-9 && v <= b + 1e-9;

/** Whether p, already on the curve's line or circle, is on the part that's drawn. */
function onDrawn(c: Curve, p: Vec, pts: Map<Id, Point>): boolean {
  switch (c.type) {
    case "segment": {
      const a = pts.get(c.a);
      const b = pts.get(c.b);
      if (!a || !b) return false;
      const ab = sub(b, a);
      const t = dot(sub(p, a), ab) / dot(ab, ab);
      return t >= -1e-9 && t <= 1 + 1e-9;
    }
    case "circle": {
      const center = pts.get(c.center);
      return !!center && onCircleArc(c, center, p);
    }
    case "function":
      return within(p.x, c.domain) && within(p.y, c.range);
    case "vline":
      return within(p.y, c.range);
  }
}

/** Points where graph f meets the other curve, found along f's domain. */
function graphMeets(f: FunctionGraph, other: Curve, pts: Map<Id, Point>): Vec[] {
  const fn = graphFn(f.expr);
  if (!fn) return [];
  const on = (x: number): Vec[] => {
    const y = fn(x);
    return Number.isFinite(y) ? [{ x, y }] : [];
  };
  switch (other.type) {
    case "vline":
      return within(other.x, f.domain) ? on(other.x) : [];
    case "function": {
      const g = graphFn(other.expr);
      const from = Math.max(f.domain[0], other.domain[0]);
      const to = Math.min(f.domain[1], other.domain[1]);
      return g ? findRoots((x) => fn(x) - g(x), [from, to]).flatMap(on) : [];
    }
    case "segment": {
      const a = pts.get(other.a);
      const b = pts.get(other.b);
      if (!a || !b) return [];
      if (Math.abs(b.x - a.x) < 1e-12) return within(a.x, f.domain) ? on(a.x) : [];
      const m = (b.y - a.y) / (b.x - a.x);
      return findRoots((x) => fn(x) - (a.y + m * (x - a.x)), f.domain).flatMap(on);
    }
    case "circle": {
      const c = pts.get(other.center);
      if (!c) return [];
      const r = other.radius;
      const from = Math.max(f.domain[0], c.x - r);
      const to = Math.min(f.domain[1], c.x + r);
      return findRoots((x) => (x - c.x) ** 2 + (fn(x) - c.y) ** 2 - r * r, [from, to]).flatMap(on);
    }
  }
}

/** Points where the vertical line x = v.x meets a segment or circle. */
function verticalMeets(v: VerticalLine, other: Segment | Circle, pts: Map<Id, Point>): Vec[] {
  if (other.type === "segment") {
    const a = pts.get(other.a);
    const b = pts.get(other.b);
    if (!a || !b || Math.abs(b.x - a.x) < 1e-12) return [];
    return [lerp(a, b, (v.x - a.x) / (b.x - a.x))];
  }
  const c = pts.get(other.center);
  if (!c) return [];
  const dx = v.x - c.x;
  const h2 = other.radius * other.radius - dx * dx;
  if (h2 < -1e-12) return [];
  const h = Math.sqrt(Math.max(0, h2));
  return h < 1e-9 ? [{ x: v.x, y: c.y }] : [{ x: v.x, y: c.y - h }, { x: v.x, y: c.y + h }];
}

/**
 * Crossings of two curves when a graph or vertical line is one of them, left
 * to right (bottom to top at the same x). A segment counts as its whole line,
 * like in `crossings`; `inside` says the crossing is on both drawn curves.
 */
export function graphCrossings(first: Curve, second: Curve, pts: Map<Id, Point>): Crossing[] {
  let found: Vec[];
  if (first.type === "function") found = graphMeets(first, second, pts);
  else if (second.type === "function") found = graphMeets(second, first, pts);
  else if (first.type === "vline" && second.type === "vline") found = [];
  else if (first.type === "vline") found = verticalMeets(first, second as Segment | Circle, pts);
  else if (second.type === "vline") found = verticalMeets(second, first, pts);
  else return crossings(first, second, pts);
  const sorted = found
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((p, q) => p.x - q.x || p.y - q.y)
    .filter((p, i, all) => i === 0 || dist(p, all[i - 1]) > 1e-7);
  return sorted.map((point, index) => ({
    point,
    index,
    inside: onDrawn(first, point, pts) && onDrawn(second, point, pts),
  }));
}

/** Crossings of any two curves, numbered as PointConstruction "intersection" numbers them. */
export function curveCrossings(first: Curve, second: Curve, pts: Map<Id, Point>): Crossing[] {
  return isPlain(first) && isPlain(second) ? crossings(first, second, pts) : graphCrossings(first, second, pts);
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
  graphs: Map<Id, FunctionGraph | VerticalLine> = new Map(),
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
      const [first, second] = c.of.map((id) => segments.get(id) ?? circles.get(id) ?? graphs.get(id));
      if (!first || !second) return null;
      if (isPlain(first) && isPlain(second)) {
        const all = crossings(first, second, pts);
        return (all.find((x) => x.index === c.index) ?? all[0])?.point ?? null;
      }
      // Graph crossings come and go with the formula: each keeps its own place in the count.
      return graphCrossings(first, second, pts)[c.index]?.point ?? null;
    }
    case "arcEnd": {
      const circle = circles.get(c.circle);
      const center = circle && pts.get(circle.center);
      if (!circle?.arc || !center) return null;
      return add(center, polar(circle.radius, c.end === 0 ? circle.arc.start : circle.arc.end));
    }
    case "onGraph": {
      const graph = graphs.get(c.graph);
      const y = graph?.type === "function" ? functionValue(graph.expr, c.x) : null;
      return y === null ? null : { x: c.x, y };
    }
    case "notable": {
      const graph = graphs.get(c.graph);
      return graph?.type === "function" ? (notablePoints(graph, c.feature)[c.index] ?? null) : null;
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
    case "notable":
      return [c.graph];
  }
}

/** Constructions whose point goes away when what it marks is gone, instead of staying where it was. */
const VANISHING = new Set<PointConstruction["kind"]>(["intersection", "onGraph", "notable"]);

/**
 * Constructed points whose crossing, root or turning point no longer exists,
 * like the roots of x² - 1 after it becomes x² + 1. Points that lost a parent
 * aren't listed: deleting a parent frees them instead.
 */
export function vanishedPoints(doc: FigureDoc): Point[] {
  const byId = elementMap(doc);
  const pts = pointMap(doc);
  const segments = new Map<Id, Segment>();
  const circles = new Map<Id, Circle>();
  const graphs = new Map<Id, FunctionGraph | VerticalLine>();
  for (const el of doc.elements) {
    if (el.type === "segment") segments.set(el.id, el);
    else if (el.type === "circle") circles.set(el.id, el);
    else if (el.type === "function" || el.type === "vline") graphs.set(el.id, el);
  }
  return doc.elements.filter((el): el is Point => {
    if (el.type !== "point" || !el.construction || !VANISHING.has(el.construction.kind)) return false;
    if (!constructionParents(el.construction).every((id) => byId.has(id))) return false;
    return constructedPosition(el.construction, pts, segments, circles, graphs) === null;
  });
}

/**
 * Marks on graphs whose domain or y cut changed, as when the axes' window
 * does, stay where they are (a new expression still carries them by place):
 * each root, turning point and graph crossing
 * takes the entry of the new list at its spot, instead of the same place in
 * a list that now starts elsewhere. One whose spot left the window gets an
 * index past the list, so it goes like any mark whose feature is gone.
 */
export function keepGraphMarks(before: FigureDoc, after: FigureDoc): FigureDoc {
  const old = new Map(before.elements.map((e) => [e.id, e]));
  const changed = new Set(
    after.elements
      .filter((e) => {
        const prev = old.get(e.id);
        if (!prev || prev === e) return false;
        return e.type === "vline" || (e.type === "function" && prev.type === "function" && prev.expr === e.expr);
      })
      .map((e) => e.id),
  );
  if (changed.size === 0) return after;
  const pts = pointMap(after);
  const curves = new Map<Id, Curve>();
  for (const el of after.elements) if (isCurve(el)) curves.set(el.id, el);
  let moved = false;
  const elements = after.elements.map((el) => {
    if (el.type !== "point" || !el.construction) return el;
    const c = el.construction;
    let spots: Vec[] | null = null;
    if (c.kind === "notable" && changed.has(c.graph)) {
      const g = curves.get(c.graph);
      if (g?.type === "function") spots = notablePoints(g, c.feature);
    } else if (c.kind === "intersection" && c.of.some((id) => changed.has(id))) {
      const [a, b] = c.of.map((id) => curves.get(id));
      if (a && b && !(isPlain(a) && isPlain(b))) spots = graphCrossings(a, b, pts).map((x) => x.point);
    }
    if (!spots || (c.kind !== "notable" && c.kind !== "intersection")) return el;
    const found = spots.findIndex((p) => dist(p, el) < 1e-6);
    const index = found >= 0 ? found : spots.length;
    if (index === c.index) return el;
    moved = true;
    return { ...el, construction: { ...c, index } };
  });
  return moved ? { ...after, elements } : after;
}
