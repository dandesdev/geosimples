import type { Circle, GeometryElement, Line, Point, PointID } from "./types";

export interface Point2D {
  x: number;
  y: number;
}

export function distance(p1: Point2D, p2: Point2D): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

export function midpoint(p1: Point2D, p2: Point2D): Point2D {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

export function angle(p1: Point2D, p2: Point2D, p3: Point2D): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  const cosAngle = dot / (mag1 * mag2);
  return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
}

export function angleDegrees(p1: Point2D, p2: Point2D, p3: Point2D): number {
  return (angle(p1, p2, p3) * 180) / Math.PI;
}

export function normalizeAngle(angle: number): number {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

export function rotatePoint(
  point: Point2D,
  center: Point2D,
  degrees: number,
): Point2D {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function lineIntersection(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D,
): Point2D | null {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (d === 0) return null;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  };
}

export function circleLineIntersection(
  center: Point2D,
  radius: number,
  p1: Point2D,
  p2: Point2D,
): Point2D[] {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const fx = p1.x - center.x;
  const fy = p1.y - center.y;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);
  const points: Point2D[] = [];
  if (t1 >= 0 && t1 <= 1) points.push({ x: p1.x + t1 * dx, y: p1.y + t1 * dy });
  if (t2 >= 0 && t2 <= 1) points.push({ x: p1.x + t2 * dx, y: p1.y + t2 * dy });
  return points;
}

export function circleCircleIntersection(
  c1: Point2D,
  r1: number,
  c2: Point2D,
  r2: number,
): Point2D[] {
  const d = distance(c1, c2);
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const p2 = {
    x: c1.x + (a * (c2.x - c1.x)) / d,
    y: c1.y + (a * (c2.y - c1.y)) / d,
  };
  const offsetX = (h * (c2.y - c1.y)) / d;
  const offsetY = (h * (c2.x - c1.x)) / d;
  return [
    { x: p2.x - offsetX, y: p2.y - offsetY },
    { x: p2.x + offsetX, y: p2.y + offsetY },
  ];
}

export function perpendicularPoint(
  point: Point2D,
  lineP1: Point2D,
  lineP2: Point2D,
): Point2D {
  const dx = lineP2.x - lineP1.x;
  const dy = lineP2.y - lineP1.y;
  const len = dx * dx + dy * dy;
  const t = ((point.x - lineP1.x) * dx + (point.y - lineP1.y) * dy) / len;
  return {
    x: lineP1.x + t * dx,
    y: lineP1.y + t * dy,
  };
}

export function pointOnSegment(
  point: Point2D,
  p1: Point2D,
  p2: Point2D,
  threshold: number = 5,
): boolean {
  const d1 = distance(point, p1);
  const d2 = distance(point, p2);
  const d = distance(p1, p2);
  return Math.abs(d1 + d2 - d) < threshold;
}

export function snapToGrid(point: Point2D, gridSpacing: number): Point2D {
  return {
    x: Math.round(point.x / gridSpacing) * gridSpacing,
    y: Math.round(point.y / gridSpacing) * gridSpacing,
  };
}

export function findNearestPoint(
  point: Point2D,
  points: Point[],
  threshold: number = 10,
): Point | null {
  let nearest: Point | null = null;
  let minDist = threshold;
  for (const p of points) {
    const d = distance(point, { x: p.x, y: p.y });
    if (d < minDist) {
      minDist = d;
      nearest = p;
    }
  }
  return nearest;
}

export function findNearestLinePoint(
  point: Point2D,
  points: PointID[],
  getPoint: (id: PointID) => Point | undefined,
  threshold: number = 10,
): PointID | null {
  let nearestId: PointID | null = null;
  let minDist = threshold;
  for (const id of points) {
    const p = getPoint(id);
    if (!p) continue;
    const d = distance(point, { x: p.x, y: p.y });
    if (d < minDist) {
      minDist = d;
      nearestId = id;
    }
  }
  return nearestId;
}

export function getPointByIdMap(
  elements: GeometryElement[],
): Map<PointID, Point> {
  const map = new Map<PointID, Point>();
  for (const el of elements) {
    if (el.type === "point") {
      map.set(el.id, el);
    }
  }
  return map;
}

export function polygonArea(vertices: Point2D[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

export function isPointInPolygon(point: Point2D, vertices: Point2D[]): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x,
      yi = vertices[i].y;
    const xj = vertices[j].x,
      yj = vertices[j].y;
    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function findCircleFromThreePoints(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
): { center: Point2D; radius: number } | null {
  const x1 = p1.x,
    y1 = p1.y;
  const x2 = p2.x,
    y2 = p2.y;
  const x3 = p3.x,
    y3 = p3.y;

  const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

  // Collinear check (area ~ 0)
  if (Math.abs(D) < 1e-10) return null;

  const centerX =
    ((x1 * x1 + y1 * y1) * (y2 - y3) +
      (x2 * x2 + y2 * y2) * (y3 - y1) +
      (x3 * x3 + y3 * y3) * (y1 - y2)) /
    D;

  const centerY =
    ((x1 * x1 + y1 * y1) * (x3 - x2) +
      (x2 * x2 + y2 * y2) * (x1 - x3) +
      (x3 * x3 + y3 * y3) * (x2 - x1)) /
    D;

  const radius = Math.sqrt(
    Math.pow(centerX - x1, 2) + Math.pow(centerY - y1, 2),
  );

  return {
    center: { x: centerX, y: centerY },
    radius: radius,
  };
}

export function findIncircleFromThreeLines(
  l1: { p1: Point2D; p2: Point2D },
  l2: { p1: Point2D; p2: Point2D },
  l3: { p1: Point2D; p2: Point2D },
): { center: Point2D; radius: number } | null {
  // Find vertices of the triangle formed by the three lines
  const v1 = lineIntersection(l2.p1, l2.p2, l3.p1, l3.p2); // Intersection of L2 and L3
  const v2 = lineIntersection(l1.p1, l1.p2, l3.p1, l3.p2); // Intersection of L1 and L3
  const v3 = lineIntersection(l1.p1, l1.p2, l2.p1, l2.p2); // Intersection of L1 and L2

  if (!v1 || !v2 || !v3) return null; // Lines are parallel or do not form a triangle

  // Remove duplicate vertices (if lines intersect at same point)
  if (
    distance(v1, v2) < 1e-10 ||
    distance(v2, v3) < 1e-10 ||
    distance(v1, v3) < 1e-10
  ) {
    return null;
  }

  // Calculate side lengths
  const a = distance(v2, v3); // Side opposite to v1
  const b = distance(v1, v3); // Side opposite to v2
  const c = distance(v1, v2); // Side opposite to v3

  const perimeter = a + b + c;
  if (perimeter === 0) return null;

  // Calculate Incenter
  const centerX = (a * v1.x + b * v2.x + c * v3.x) / perimeter;
  const centerY = (a * v1.y + b * v2.y + c * v3.y) / perimeter;
  const center = { x: centerX, y: centerY };

  // Calculate Area using Heron's formula
  const s = perimeter / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));

  // Inradius
  const radius = area / s;

  return { center, radius };
}

export function distancePointToLine(
  point: Point2D,
  lineP1: Point2D,
  lineP2: Point2D,
): number {
  const p = perpendicularPoint(point, lineP1, lineP2);
  return distance(point, p);
}

export function distancePointToCircle(
  point: Point2D,
  circle: { center: Point2D; radius: number },
): number {
  const d = distance(point, circle.center);
  return Math.abs(d - circle.radius);
}

export function solveApollonius(
  c1: { center: Point2D; r: number },
  c2: { center: Point2D; r: number },
  c3: { center: Point2D; r: number },
): { center: Point2D; radius: number } | null {
  // Algebraic solution for external tangency: (x-xi)^2 + (y-yi)^2 = (R + ri)^2
  const x1 = c1.center.x,
    y1 = c1.center.y,
    r1 = c1.r;
  const x2 = c2.center.x,
    y2 = c2.center.y,
    r2 = c2.r;
  const x3 = c3.center.x,
    y3 = c3.center.y,
    r3 = c3.r;

  // Coefficients for a1*x + b1*y = c1*R + d1 (from 1&2)
  const a1 = 2 * (x2 - x1);
  const b1 = 2 * (y2 - y1);
  const c1_coeff = 2 * (r1 - r2);
  const d1 = x2 * x2 + y2 * y2 - r2 * r2 - (x1 * x1 + y1 * y1 - r1 * r1);

  // Coefficients for a2*x + b2*y = c2*R + d2 (from 2&3)
  const a2 = 2 * (x3 - x2);
  const b2 = 2 * (y3 - y2);
  const c2_coeff = 2 * (r2 - r3);
  const d2 = x3 * x3 + y3 * y3 - r3 * r3 - (x2 * x2 + y2 * y2 - r2 * r2);

  // Solve linear system for x, y in terms of R
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-10) return null; // Centers are collinear

  // x = M*R + N
  const M = (c1_coeff * b2 - c2_coeff * b1) / det;
  const N = (d1 * b2 - d2 * b1) / det;

  // y = K*R + L
  const K = (a1 * c2_coeff - a2 * c1_coeff) / det;
  const L = (a1 * d2 - a2 * d1) / det;

  // Substitute into Eq 1: (MR + N - x1)^2 + (KR + L - y1)^2 = (R + r1)^2
  const X0 = N - x1;
  const Y0 = L - y1;

  // Coefficients for A*R^2 + B*R + C = 0
  const A = M * M + K * K - 1;
  const B = 2 * M * X0 + 2 * K * Y0 - 2 * r1;
  const C = X0 * X0 + Y0 * Y0 - r1 * r1;

  // Quadratic formula
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;

  const sqrtDisc = Math.sqrt(disc);
  const R1 = (-B + sqrtDisc) / (2 * A);
  const R2 = (-B - sqrtDisc) / (2 * A);

  // Use simplest positive radius
  let R = -1;
  if (R1 > 0 && R2 > 0) R = Math.min(R1, R2);
  else if (R1 > 0) R = R1;
  else if (R2 > 0) R = R2;

  if (R <= 0) return null;

  const x = M * R + N;
  const y = K * R + L;

  return { center: { x, y }, radius: R };
}

export function distancePointToSegment(
  point: Point2D,
  p1: Point2D,
  p2: Point2D,
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return distance(point, p1);

  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;

  return distance(point, { x: projX, y: projY });
}

export function findNearestLine(
  point: Point2D,
  lines: Line[],
  pointsMap: Map<
    PointID,
    Point
  >,
  threshold: number = 10,
): Line | null {
  let nearest: Line | null = null;
  let minDist = threshold;

  for (const line of lines) {
    const p1 = pointsMap.get(line.startPoint);
    const p2 = pointsMap.get(line.endPoint);
    if (!p1 || !p2) continue;

    const d = distancePointToSegment(
      point,
      { x: p1.x, y: p1.y },
      { x: p2.x, y: p2.y },
    );
    if (d < minDist) {
      minDist = d;
      nearest = line;
    }
  }
  return nearest;
}

export function findNearestCircle(
  point: Point2D,
  circles: Circle[],
  pointsMap: Map<
    PointID,
    Point
  >,
  threshold: number = 10,
): Circle | null {
  let nearest: Circle | null = null;
  let minDist = threshold;

  for (const circle of circles) {
    const center = pointsMap.get(circle.centerPoint);
    if (!center) continue;

    let radius = circle.radius;
    if (circle.radiusPoint) {
      const rp = pointsMap.get(circle.radiusPoint);
      if (rp) {
        radius = distance({ x: center.x, y: center.y }, { x: rp.x, y: rp.y });
      }
    }

    const d = Math.abs(distance(point, { x: center.x, y: center.y }) - radius);
    if (d < minDist) {
      minDist = d;
      nearest = circle;
    }
  }
  return nearest;
}
