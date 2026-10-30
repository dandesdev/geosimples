import type { Point, GeometryElement } from "./types";

export interface LineProposal {
  start?: { x: number; y: number; id?: string };
  end?: { x: number; y: number; id?: string };
  multiPoints?: Point[]; // For batch creation
  mode: "2-points" | "multi-points" | "1-point-interactive" | "invalid";
  error?: string;
}

export interface LineInteractiveState {
  hoveredPointId: string | null;
  mousePosition: { x: number; y: number } | null;
}

/**
 * Calculates a proposed line based on selection and interactive state.
 *
 * Strategies:
 * 1. 2 Points Selected (Static) -> Create Line.
 * 2. >2 Points Selected (Static) -> Batch Create Lines (Polyline).
 * 3. 1 Point Selected + Hover Point (Interactive) -> Create Line to hovered.
 * 4. 1 Point Selected + Mouse (Interactive) -> Preview Line to cursor.
 */
export function getProposedLine(
  selectionIds: string[],
  elements: GeometryElement[],
  interactiveState?: LineInteractiveState,
): LineProposal | null {
  // Filter selected elements to only Points
  const selectedPoints = selectionIds
    .map((id) => elements.find((el) => el.id === id && el.type === "point"))
    .filter((el): el is Point => !!el);

  // --- Static Solvers (Selection Only) ---

  // Mode: multi-points (Batch/Polyline)
  if (selectedPoints.length > 2) {
    // We rely on selection order? selectionIds is usually ordered by selection time.
    return {
      mode: "multi-points",
      multiPoints: selectedPoints,
    };
  }

  // Mode: 2-points (Static)
  if (selectedPoints.length === 2) {
    const [p1, p2] = selectedPoints;
    return {
      mode: "2-points",
      start: { x: p1.x, y: p1.y, id: p1.id },
      end: { x: p2.x, y: p2.y, id: p2.id },
    };
  }

  // --- Interactive Solvers (Selection + Mouse) ---
  if (!interactiveState) return null;

  const { hoveredPointId, mousePosition } = interactiveState;

  // Mode: 1-point-interactive (Point to Point/Mouse)
  if (selectedPoints.length === 1) {
    const p1 = selectedPoints[0];

    // Priority 1: Hovering a second point
    if (hoveredPointId && hoveredPointId !== p1.id) {
      const p2 = elements.find(
        (el) => el.id === hoveredPointId && el.type === "point",
      ) as Point;
      if (p2) {
        return {
          mode: "2-points", // It effectively becomes a 2-point line
          start: { x: p1.x, y: p1.y, id: p1.id },
          end: { x: p2.x, y: p2.y, id: p2.id },
        };
      }
    }

    // Priority 2: Hovering empty space (Preview only)
    if (mousePosition) {
      return {
        mode: "1-point-interactive",
        start: { x: p1.x, y: p1.y, id: p1.id },
        end: { x: mousePosition.x, y: mousePosition.y },
      };
    }
  }

  // No valid proposal
  return null;
}
