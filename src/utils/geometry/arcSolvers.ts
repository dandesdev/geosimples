/**
 * Arc Solvers - Math utilities for creating angle arcs between intersecting line segments
 */

import type { Line, Point, GeometryElement } from "@/geometry/types";
import { distance, lineIntersection, type Point2D } from "./math";

// ============================================================================
// Types
// ============================================================================

export type IntersectionType = "endpoint" | "midpoint" | "none";

export interface IntersectionInfo {
  type: IntersectionType;
  point: Point2D | null;
  /** If endpoint intersection, which point ID is shared */
  sharedPointId?: string;
}

export interface ArcProposal {
  quadrant: 1 | 2 | 3 | 4;
  center: Point2D; // Intersection point
  arcStart: Point2D; // Point on line1 at radius
  arcEnd: Point2D; // Point on line2 at radius
  startAngle: number; // Radians
  endAngle: number; // Radians
  sweepFlag: 0 | 1; // SVG arc sweep direction
  largeArcFlag: 0 | 1; // SVG large arc flag
  radius: number;
  /** Direction vectors for each arm of the angle */
  dir1: Point2D;
  dir2: Point2D;
  labelPosition: Point2D;
}

export interface GetArcProposalsResult {
  proposals: ArcProposal[];
  intersection: IntersectionInfo;
  error?: string;
}

// ============================================================================
// Intersection Detection
// ============================================================================

/**
 * Gets the endpoints of a line from a points map
 */
export function getLineEndpoints(
  line: Line,
  pointsMap: Map<string, Point>,
): { p1: Point2D; p2: Point2D } | null {
  const start = pointsMap.get(line.startPoint);
  const end = pointsMap.get(line.endPoint);
  if (!start || !end) return null;
  return { p1: { x: start.x, y: start.y }, p2: { x: end.x, y: end.y } };
}

/**
 * Classify how two line segments intersect
 */
export function classifyIntersection(
  line1: Line,
  line2: Line,
  pointsMap: Map<string, Point>,
): IntersectionInfo {
  const pts1 = getLineEndpoints(line1, pointsMap);
  const pts2 = getLineEndpoints(line2, pointsMap);

  if (!pts1 || !pts2) {
    return { type: "none", point: null };
  }

  // Check for shared endpoints
  const threshold = 0.001;

  // Check all endpoint combinations
  const endpointChecks = [
    { p1: pts1.p1, p2: pts2.p1, id1: line1.startPoint, id2: line2.startPoint },
    { p1: pts1.p1, p2: pts2.p2, id1: line1.startPoint, id2: line2.endPoint },
    { p1: pts1.p2, p2: pts2.p1, id1: line1.endPoint, id2: line2.startPoint },
    { p1: pts1.p2, p2: pts2.p2, id1: line1.endPoint, id2: line2.endPoint },
  ];

  for (const check of endpointChecks) {
    if (distance(check.p1, check.p2) < threshold) {
      return {
        type: "endpoint",
        point: check.p1,
        sharedPointId: check.id1, // They share the same point
      };
    }
  }

  // Check for mid-segment intersection
  const intersection = getSegmentIntersection(
    pts1.p1,
    pts1.p2,
    pts2.p1,
    pts2.p2,
  );

  if (intersection) {
    return { type: "midpoint", point: intersection };
  }

  return { type: "none", point: null };
}

/**
 * Get intersection point of two line segments (not infinite lines)
 */
export function getSegmentIntersection(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D,
): Point2D | null {
  // First get line intersection
  const intersection = lineIntersection(p1, p2, p3, p4);
  if (!intersection) return null;

  // Check if intersection is within both segments
  const epsilon = 0.001;

  // Check if on segment 1
  const minX1 = Math.min(p1.x, p2.x) - epsilon;
  const maxX1 = Math.max(p1.x, p2.x) + epsilon;
  const minY1 = Math.min(p1.y, p2.y) - epsilon;
  const maxY1 = Math.max(p1.y, p2.y) + epsilon;

  // Check if on segment 2
  const minX2 = Math.min(p3.x, p4.x) - epsilon;
  const maxX2 = Math.max(p3.x, p4.x) + epsilon;
  const minY2 = Math.min(p3.y, p4.y) - epsilon;
  const maxY2 = Math.max(p3.y, p4.y) + epsilon;

  if (
    intersection.x >= minX1 &&
    intersection.x <= maxX1 &&
    intersection.y >= minY1 &&
    intersection.y <= maxY1 &&
    intersection.x >= minX2 &&
    intersection.x <= maxX2 &&
    intersection.y >= minY2 &&
    intersection.y <= maxY2
  ) {
    return intersection;
  }

  return null;
}

// ============================================================================
// Arc Proposal Generation
// ============================================================================

/**
 * Calculate a point at a given distance along a direction from origin
 */
function pointAtDistance(
  origin: Point2D,
  direction: Point2D,
  dist: number,
): Point2D {
  const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  if (len === 0) return origin;
  return {
    x: origin.x + (direction.x / len) * dist,
    y: origin.y + (direction.y / len) * dist,
  };
}

/**
 * Normalize angle to [0, 2π)
 */
function normalizeAngle(angle: number): number {
  while (angle < 0) angle += 2 * Math.PI;
  while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
  return angle;
}

/**
 * Get the 4 direction vectors from intersection point along both lines
 * For endpoint intersection: 2 directions (away from shared point)
 * For midpoint intersection: 4 directions (both ways on each line)
 */
function getDirectionVectors(
  intersection: Point2D,
  line1: Line,
  line2: Line,
  pointsMap: Map<string, Point>,
  intersectionType: IntersectionType,
): Point2D[][] {
  const pts1 = getLineEndpoints(line1, pointsMap)!;
  const pts2 = getLineEndpoints(line2, pointsMap)!;

  // Directions from intersection to each endpoint
  const dir1a = {
    x: pts1.p1.x - intersection.x,
    y: pts1.p1.y - intersection.y,
  };
  const dir1b = {
    x: pts1.p2.x - intersection.x,
    y: pts1.p2.y - intersection.y,
  };
  const dir2a = {
    x: pts2.p1.x - intersection.x,
    y: pts2.p1.y - intersection.y,
  };
  const dir2b = {
    x: pts2.p2.x - intersection.x,
    y: pts2.p2.y - intersection.y,
  };

  if (intersectionType === "endpoint") {
    // Only 2 directions: the "away" directions from the shared endpoint
    // Filter out near-zero vectors (pointing at shared point)
    const threshold = 0.001;
    const dirs1 = [dir1a, dir1b].filter(
      (d) => Math.sqrt(d.x * d.x + d.y * d.y) > threshold,
    );
    const dirs2 = [dir2a, dir2b].filter(
      (d) => Math.sqrt(d.x * d.x + d.y * d.y) > threshold,
    );

    return [dirs1, dirs2];
  } else {
    // Midpoint: 4 directions (2 per line)
    return [
      [dir1a, dir1b],
      [dir2a, dir2b],
    ];
  }
}

/**
 * Generate all possible arc proposals for two intersecting lines
 */
export function getProposedArcs(
  line1: Line,
  line2: Line,
  radius: number,
  pointsMap: Map<string, Point>,
): GetArcProposalsResult {
  const intersectionInfo = classifyIntersection(line1, line2, pointsMap);

  if (intersectionInfo.type === "none" || !intersectionInfo.point) {
    return {
      proposals: [],
      intersection: intersectionInfo,
      error: "Lines must intersect to create an arc",
    };
  }

  const center = intersectionInfo.point;
  const [dirs1, dirs2] = getDirectionVectors(
    center,
    line1,
    line2,
    pointsMap,
    intersectionInfo.type,
  );

  const proposals: ArcProposal[] = [];
  let quadrantCounter = 1;

  // Generate all combinations of direction pairs
  for (const d1 of dirs1) {
    for (const d2 of dirs2) {
      // Calculate arc endpoints at radius distance
      const arcStart = pointAtDistance(center, d1, radius);
      const arcEnd = pointAtDistance(center, d2, radius);

      // Calculate angles
      const startAngle = Math.atan2(d1.y, d1.x);
      const endAngle = Math.atan2(d2.y, d2.x);

      // Determine sweep direction - we want the arc to curve OUTWARD (convex)
      // The sweep flag determines clockwise (1) vs counter-clockwise (0) direction
      // For a convex arc between two points, we need the opposite of the "short way"
      let angleDiff = normalizeAngle(endAngle - startAngle);
      const sweepFlag: 0 | 1 = angleDiff > Math.PI ? 0 : 1;
      const largeArcFlag: 0 | 1 = 0; // Always small arc for angle notation

      // Calculate label position (1, 2, 3, 4)
      // Vector from center to chord midpoint
      const chordMidX = (arcStart.x + arcEnd.x) / 2;
      const chordMidY = (arcStart.y + arcEnd.y) / 2;
      let labelDirX = chordMidX - center.x;
      let labelDirY = chordMidY - center.y;

      // Normalize
      const labelDirLen = Math.sqrt(
        labelDirX * labelDirX + labelDirY * labelDirY,
      );
      if (labelDirLen > 1e-6) {
        labelDirX /= labelDirLen;
        labelDirY /= labelDirLen;
      }
      const labelDist = radius * 1.5; // 50% larger radius for label placement
      const labelPosition = {
        x: center.x + labelDirX * labelDist,
        y: center.y + labelDirY * labelDist,
      };

      proposals.push({
        quadrant: quadrantCounter as 1 | 2 | 3 | 4,
        center,
        arcStart,
        arcEnd,
        startAngle,
        endAngle,
        sweepFlag,
        largeArcFlag,
        radius,
        dir1: d1,
        dir2: d2,
        labelPosition,
      });

      quadrantCounter++;
      if (quadrantCounter > 4) break;
    }
    if (quadrantCounter > 4) break;
  }

  return {
    proposals,
    intersection: intersectionInfo,
  };
}

// ============================================================================
// Helpers for Arc Creation
// ============================================================================

/**
 * Generate SVG arc path d attribute
 */
export function generateArcPath(proposal: ArcProposal): string {
  const { arcStart, arcEnd, radius, sweepFlag, largeArcFlag } = proposal;
  return `M ${arcStart.x} ${arcStart.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${arcEnd.x} ${arcEnd.y}`;
}

/**
 * Generate paths for multiple concentric arcs (arcCount = 1, 2, or 3)
 */
export function generateConcentricArcPaths(
  proposal: ArcProposal,
  arcCount: 1 | 2 | 3,
  baseRadius: number,
  spacing: number = 4,
): string[] {
  const paths: string[] = [];

  for (let i = 0; i < arcCount; i++) {
    const r = baseRadius + i * spacing;
    const arcStart = pointAtDistance(proposal.center, proposal.dir1, r);
    const arcEnd = pointAtDistance(proposal.center, proposal.dir2, r);

    paths.push(
      `M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${proposal.largeArcFlag} ${proposal.sweepFlag} ${arcEnd.x} ${arcEnd.y}`,
    );
  }

  return paths;
}

/**
 * Calculate tick mark points at the midpoint of an arc
 */
export function calculateTickMarks(
  proposal: ArcProposal,
  tickCount: 0 | 1 | 2 | 3,
  tickLength: number = 6,
): Array<{ start: Point2D; end: Point2D }> {
  if (tickCount === 0) return [];

  const { center, startAngle, endAngle, radius } = proposal;

  // Find the middle angle
  let midAngle = (startAngle + endAngle) / 2;

  // Adjust if we crossed 0/2π boundary
  let angleDiff = endAngle - startAngle;
  if (Math.abs(angleDiff) > Math.PI) {
    midAngle += Math.PI;
  }

  const ticks: Array<{ start: Point2D; end: Point2D }> = [];
  const tickSpacing = 3;

  for (let i = 0; i < tickCount; i++) {
    const offset = (i - (tickCount - 1) / 2) * tickSpacing;
    const angle = midAngle; // Could add angular offset here

    // Tick extends radially from center

    // Tick extends radially
    const innerPoint = {
      x: center.x + Math.cos(angle) * (radius + offset - tickLength / 2),
      y: center.y + Math.sin(angle) * (radius + offset - tickLength / 2),
    };
    const outerPoint = {
      x: center.x + Math.cos(angle) * (radius + offset + tickLength / 2),
      y: center.y + Math.sin(angle) * (radius + offset + tickLength / 2),
    };

    ticks.push({ start: innerPoint, end: outerPoint });
  }

  return ticks;
}

/**
 * Get selected lines from elements based on selection IDs
 */
export function getSelectedLines(
  selectionIds: string[],
  elements: GeometryElement[],
): Line[] {
  return elements.filter(
    (el): el is Line => el.type === "line" && selectionIds.includes(el.id),
  );
}
