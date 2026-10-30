/**
 * Element Validation Utilities
 *
 * Validates whether element constructions remain valid after position changes.
 * Used during drag operations to detect invalid states.
 */

import type {
  GeometryElement,
  Point,
  Line,
  Circle,
  Arc,
} from "./types";

export interface ValidationResult {
  isValid: boolean;
  elementId: string;
  elementType: string;
  errorMessage?: string;
}

/**
 * Check if three points are collinear (within tolerance).
 * Used to validate circumcircle construction.
 */
export function arePointsCollinear(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  tolerance: number = 1e-6,
): boolean {
  // Cross product of vectors (p2-p1) and (p3-p1)
  const cross = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
  return Math.abs(cross) < tolerance;
}

/**
 * Check if two lines are parallel (within tolerance).
 * Parallel lines don't intersect, so arcs can't be created.
 */
export function areLinesParallel(
  line1Start: { x: number; y: number },
  line1End: { x: number; y: number },
  line2Start: { x: number; y: number },
  line2End: { x: number; y: number },
  tolerance: number = 1e-6,
): boolean {
  const dir1 = { x: line1End.x - line1Start.x, y: line1End.y - line1Start.y };
  const dir2 = { x: line2End.x - line2Start.x, y: line2End.y - line2Start.y };

  // Cross product of direction vectors
  const cross = dir1.x * dir2.y - dir1.y * dir2.x;
  return Math.abs(cross) < tolerance;
}

/**
 * Get a point's effective position (accounting for drag delta if it's being dragged).
 */
function getEffectivePosition(
  pointId: string,
  elements: GeometryElement[],
  draggedIds: string[],
  delta: { x: number; y: number },
): { x: number; y: number } | null {
  const point = elements.find(
    (el) => el.id === pointId && el.type === "point",
  ) as Point | undefined;
  if (!point) return null;

  if (draggedIds.includes(pointId)) {
    return { x: point.x + delta.x, y: point.y + delta.y };
  }
  return { x: point.x, y: point.y };
}

/**
 * Get line endpoints' effective positions.
 */
function getLineEndpoints(
  line: Line,
  elements: GeometryElement[],
  draggedIds: string[],
  delta: { x: number; y: number },
): {
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
} {
  return {
    start: getEffectivePosition(line.startPoint, elements, draggedIds, delta),
    end: getEffectivePosition(line.endPoint, elements, draggedIds, delta),
  };
}

/**
 * Validate that a line's endpoints don't collapse to the same point.
 */
export function validateLine(
  line: Line,
  elements: GeometryElement[],
  draggedIds: string[],
  delta: { x: number; y: number },
): ValidationResult {
  const { start, end } = getLineEndpoints(line, elements, draggedIds, delta);

  if (!start || !end) {
    return {
      isValid: false,
      elementId: line.id,
      elementType: "line",
      errorMessage: "Pontos do segmento não encontrados",
    };
  }

  const distance = Math.sqrt(
    Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2),
  );

  if (distance < 1e-6) {
    return {
      isValid: false,
      elementId: line.id,
      elementType: "line",
      errorMessage: "Segmento colapsado (pontos coincidentes)",
    };
  }

  return { isValid: true, elementId: line.id, elementType: "line" };
}

/**
 * Validate that a circle remains constructible.
 * For now, just checks basic validity.
 */
export function validateCircle(
  circle: Circle,
  elements: GeometryElement[],
  draggedIds: string[],
  delta: { x: number; y: number },
): ValidationResult {
  const center = getEffectivePosition(
    circle.centerPoint,
    elements,
    draggedIds,
    delta,
  );

  if (!center) {
    return {
      isValid: false,
      elementId: circle.id,
      elementType: "circle",
      errorMessage: "Centro do círculo não encontrado",
    };
  }

  // If circle has radiusPoint, check that it doesn't collapse
  if (circle.radiusPoint) {
    const radiusPos = getEffectivePosition(
      circle.radiusPoint,
      elements,
      draggedIds,
      delta,
    );
    if (radiusPos) {
      const dist = Math.sqrt(
        Math.pow(radiusPos.x - center.x, 2) +
          Math.pow(radiusPos.y - center.y, 2),
      );
      if (dist < 1e-6) {
        return {
          isValid: false,
          elementId: circle.id,
          elementType: "circle",
          errorMessage: "Raio do círculo colapsou (raio zero)",
        };
      }
    }
  }

  return { isValid: true, elementId: circle.id, elementType: "circle" };
}

/**
 * Validate that an arc's parent lines still intersect.
 */
export function validateArc(
  arc: Arc,
  elements: GeometryElement[],
  draggedIds: string[],
  delta: { x: number; y: number },
): ValidationResult {
  // Find parent lines
  const line1 = elements.find(
    (el) => el.id === arc.line1 && el.type === "line",
  ) as Line | undefined;
  const line2 = elements.find(
    (el) => el.id === arc.line2 && el.type === "line",
  ) as Line | undefined;

  if (!line1 || !line2) {
    return {
      isValid: false,
      elementId: arc.id,
      elementType: "arc",
      errorMessage: "Segmentos do arco não encontrados",
    };
  }

  // Get effective endpoints
  const line1Endpoints = getLineEndpoints(line1, elements, draggedIds, delta);
  const line2Endpoints = getLineEndpoints(line2, elements, draggedIds, delta);

  if (
    !line1Endpoints.start ||
    !line1Endpoints.end ||
    !line2Endpoints.start ||
    !line2Endpoints.end
  ) {
    return {
      isValid: false,
      elementId: arc.id,
      elementType: "arc",
      errorMessage: "Pontos dos segmentos não encontrados",
    };
  }

  // Check if lines are parallel (no intersection)
  if (
    areLinesParallel(
      line1Endpoints.start,
      line1Endpoints.end,
      line2Endpoints.start,
      line2Endpoints.end,
    )
  ) {
    return {
      isValid: false,
      elementId: arc.id,
      elementType: "arc",
      errorMessage: "Segmentos paralelos (sem interseção)",
    };
  }

  return { isValid: true, elementId: arc.id, elementType: "arc" };
}

/**
 * Validate an element based on its type.
 */
export function validateElement(
  element: GeometryElement,
  elements: GeometryElement[],
  draggedIds: string[],
  delta: { x: number; y: number },
): ValidationResult {
  switch (element.type) {
    case "line":
      return validateLine(element as Line, elements, draggedIds, delta);
    case "circle":
      return validateCircle(element as Circle, elements, draggedIds, delta);
    case "arc":
      return validateArc(element as Arc, elements, draggedIds, delta);
    default:
      return {
        isValid: true,
        elementId: element.id,
        elementType: element.type,
      };
  }
}

/**
 * Validate all affected elements during a drag operation.
 * Returns a list of invalid elements.
 */
export function validateDragAffectedElements(
  affectedIds: string[],
  elements: GeometryElement[],
  draggedIds: string[],
  delta: { x: number; y: number },
): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const id of affectedIds) {
    const element = elements.find((el) => el.id === id);
    if (!element) continue;

    const result = validateElement(element, elements, draggedIds, delta);
    if (!result.isValid) {
      results.push(result);
    }
  }

  return results;
}
