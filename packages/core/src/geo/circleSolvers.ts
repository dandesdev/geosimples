import {
  findCircleFromThreePoints,
  findIncircleFromThreeLines,
  distancePointToLine,
  distancePointToCircle,
  solveApollonius,
  distance,
} from "./math";
import type { Point, Line, Circle, GeometryElement } from "./types";

export interface CircleProposal {
  center: { x: number; y: number };
  radius: number;
  mode:
    | "3-points"
    | "3-lines"
    | "point-line"
    | "point-circle"
    | "3-circles"
    | "2-points-interactive"
    | "center-radius";
  error?: string;
  errorPosition?: { x: number; y: number };
  /** ID of the radius point (for center-radius mode when user clicked an existing point) */
  radiusPointId?: string;
}

/**
 * Helper to resolve line endpoints from IDs
 */
const resolveLine = (
  line: Line,
  allPoints: Point[],
): { p1: Point; p2: Point } | null => {
  const p1 = allPoints.find((p) => p.id === line.startPoint);
  const p2 = allPoints.find((p) => p.id === line.endPoint);
  if (p1 && p2) return { p1, p2 };
  return null;
};

/**
 * Helper to resolve circle center and radius
 */
const resolveCircle = (
  c: Circle,
  allPoints: Point[],
): { center: { x: number; y: number }; r: number } | null => {
  const center = allPoints.find((p) => p.id === c.centerPoint);
  if (!center) return null;
  // Use schema source of truth. If specific override logic is needed (like radiusPoint vs radius value), handle it here.
  // Assuming radiusPoint takes precedence if the logic demands it, but standardizing on c.radius is safer for now
  // unless we specifically need dynamic radius calculation logic from the old hook.
  // The old hook recalculated `r` if `radiusPoint` existed:
  let r = c.radius;
  if (c.radiusPoint) {
    const rp = allPoints.find((p) => p.id === c.radiusPoint);
    if (rp) {
      r = distance({ x: center.x, y: center.y }, { x: rp.x, y: rp.y });
    }
  }
  return { center: { x: center.x, y: center.y }, r };
};

/**
 * Main Strategy Function:
 * Analyzes the selection and returns a proposed circle result if one can be formed.
 */
export function getProposedCircle(
  selectionIds: string[],
  allElements: GeometryElement[],
  interactiveState?: {
    hoveredPointId: string | null;
    hoveredElement?: GeometryElement | null;
    mousePosition: { x: number; y: number } | null;
  },
): CircleProposal | null {
  // 1. Categorize Selection
  const points = allElements.filter((el): el is Point => el.type === "point");
  const lines = allElements.filter((el): el is Line => el.type === "line");
  const circles = allElements.filter(
    (el): el is Circle => el.type === "circle",
  );

  const selectedPoints = points.filter((p) => selectionIds.includes(p.id));
  const selectedLines = lines.filter((l) => selectionIds.includes(l.id));
  const selectedCircles = circles.filter((c) => selectionIds.includes(c.id));

  // Helper to check solution for a given set of elements
  const checkSolution = (
    p: Point[],
    l: Line[],
    c: Circle[],
  ): CircleProposal | null => {
    const pc = p.length;
    const lc = l.length;
    const cc = c.length;

    // Option C: 3 Points
    if (pc === 3 && lc === 0 && cc === 0) {
      const result = findCircleFromThreePoints(p[0], p[1], p[2]);
      if (result) return { ...result, mode: "3-points" };
      return {
        center: { x: 0, y: 0 },
        radius: 0,
        mode: "3-points",
        error: "Points are collinear",
        errorPosition: {
          x: (p[0].x + p[1].x + p[2].x) / 3,
          y: (p[0].y + p[1].y + p[2].y) / 3,
        },
      };
    }

    // Option D: 3 Lines (Incircle)
    if (lc === 3 && pc === 0 && cc === 0) {
      const l1 = resolveLine(l[0], points);
      const l2 = resolveLine(l[1], points);
      const l3 = resolveLine(l[2], points);
      if (l1 && l2 && l3) {
        const result = findIncircleFromThreeLines(l1, l2, l3);
        if (result) return { ...result, mode: "3-lines" };
        return {
          center: { x: 0, y: 0 },
          radius: 0,
          mode: "3-lines",
          error: "Lines do not form a triangle / are parallel",
          errorPosition: {
            x: (l1.p1.x + l2.p1.x + l3.p1.x) / 3,
            y: (l1.p1.y + l2.p1.y + l3.p1.y) / 3,
          },
        };
      }
    }

    // Option E: 1 Point + 1 Line
    if (pc === 1 && lc === 1 && cc === 0) {
      const center = p[0];
      const line = resolveLine(l[0], points);
      if (center && line) {
        const r = distancePointToLine(center, line.p1, line.p2);
        return {
          center: { x: center.x, y: center.y },
          radius: r,
          mode: "point-line",
        };
      }
    }

    // Option G: 1 Point + 1 Circle
    if (pc === 1 && cc === 1 && lc === 0) {
      const point = p[0];
      const circle = resolveCircle(c[0], points);
      if (point && circle) {
        const r = distancePointToCircle(point, {
          center: circle.center,
          radius: circle.r,
        });
        return {
          center: { x: point.x, y: point.y },
          radius: r,
          mode: "point-circle",
        };
      }
    }

    // Option F: 3 Circles (Apollonius)
    if (cc === 3 && pc === 0 && lc === 0) {
      const c1 = resolveCircle(c[0], points);
      const c2 = resolveCircle(c[1], points);
      const c3 = resolveCircle(c[2], points);
      if (c1 && c2 && c3) {
        const result = solveApollonius(c1, c2, c3);
        if (result) return { ...result, mode: "3-circles" };
        return {
          center: { x: 0, y: 0 },
          radius: 0,
          mode: "3-circles",
          error: "No external tangent circle found",
          errorPosition: {
            x: (c1.center.x + c2.center.x + c3.center.x) / 3,
            y: (c1.center.y + c2.center.y + c3.center.y) / 3,
          },
        };
      }
    }

    return null;
  };

  // 1. Try static selection (Flow X)
  const staticResult = checkSolution(
    selectedPoints,
    selectedLines,
    selectedCircles,
  );
  if (staticResult) return staticResult;

  // 2. Try candidate combination (Flow Y)
  if (interactiveState?.hoveredElement || interactiveState?.hoveredPointId) {
    // Determine candidate
    let candidate: GeometryElement | undefined;
    if (interactiveState.hoveredPointId) {
      candidate = points.find((p) => p.id === interactiveState.hoveredPointId);
    } else {
      candidate = interactiveState.hoveredElement || undefined;
    }

    if (candidate && !selectionIds.includes(candidate.id)) {
      // Create hypothetical sets
      const nextPoints = [...selectedPoints];
      const nextLines = [...selectedLines];
      const nextCircles = [...selectedCircles];

      if (candidate.type === "point") nextPoints.push(candidate as Point);
      else if (candidate.type === "line") nextLines.push(candidate as Line);
      else if (candidate.type === "circle")
        nextCircles.push(candidate as Circle);

      const candidateResult = checkSolution(nextPoints, nextLines, nextCircles);
      if (candidateResult) return candidateResult;
    }
  }

  // 3. Interactive Mouse Modes (Fallback)
  if (interactiveState) {
    const pCount = selectedPoints.length;
    const lCount = selectedLines.length;
    const cCount = selectedCircles.length;

    // Mode A: 2 Points + Mouse (Interactive 3rd Point)
    if (pCount === 2 && lCount === 0 && cCount === 0) {
      const [p1, p2] = selectedPoints;
      let p3: { x: number; y: number } | null = null;
      if (interactiveState.mousePosition) {
        p3 = interactiveState.mousePosition;
        // Note: hoveredPointId case handled by candidate logic above now?
        // Actually, if we are hovering a 3rd point, the candidate logic returns '3-points'.
        // This block is only for "Mouse in empty space".
        const result = findCircleFromThreePoints(p1, p2, p3);
        if (result) return { ...result, mode: "2-points-interactive" };
      }
    }

    // Mode B: 1 Point (Center) + Mouse (Radius)
    if (pCount === 1 && lCount === 0 && cCount === 0) {
      const center = selectedPoints[0];
      // Note: If hovering a point, candidate logic -> 'center-radius' (distance)?
      // No, because '2 points' isn't a valid "Static Solution" for checkSolution.
      // checkSolution handles 3-points, 3-lines, etc.
      // It DOES NOT handle 2-points (Center+Radius Point).
      // So checking candidate for Mode B must happen here or adding 2-points to checkSolution.

      // Let's add 2-points (Center + Radius Point) to checkSolution?
      // No, because 2 points usually means "Line" or just 2 points.
      // It is ambiguous without context. The context here is "Circle Tool".
      // But we defined Mode B (Center+Radius) as a valid construction.
      // If we hover a point while 1 point selected, it IS a candidate for Mode B.

      // Check for Hovered Point (Candidate logic failed to match 3-points, so we try Mode B here)
      let targetX = interactiveState.mousePosition?.x || center.x;
      let targetY = interactiveState.mousePosition?.y || center.y;
      let radiusPointId: string | undefined;

      if (interactiveState.hoveredPointId) {
        const hp = points.find((p) => p.id === interactiveState.hoveredPointId);
        if (hp) {
          targetX = hp.x;
          targetY = hp.y;
          radiusPointId = hp.id;
        }
      }

      const r = distance(
        { x: center.x, y: center.y },
        { x: targetX, y: targetY },
      );
      return {
        center: { x: center.x, y: center.y },
        radius: r,
        mode: "center-radius",
        radiusPointId,
      };
    }
  }

  return null;
}
