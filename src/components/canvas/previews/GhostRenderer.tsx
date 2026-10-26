/**
 * GhostRenderer - Renders ghost previews for elements being dragged
 *
 * Cascade principle:
 * - Ghost point follows cursor (with snap-to-grid if enabled)
 * - Dependent elements follow ghost point position (not cursor)
 *
 * Performance optimizations:
 * - Uses useDragState (useSyncExternalStore) for efficient subscription
 * - Wrapped in React.memo to prevent unnecessary re-renders
 * - Pre-computed snapped positions
 * - Memoized dependency map (only rebuilds when elements change)
 * - Caches previous render to avoid flickering
 */

import React, { useMemo, useRef } from "react";
import { useDragState } from "@/hooks/useSvgDrag";
import type {
  GeometryElement,
  Point,
  Line,
  Circle,
  Arc,
  ElementID,
} from "@/geometry/types";
import { useTotalScale } from "@/hooks/useTotalScale";
import { useCssVars } from "@/hooks/useCssVar";
import { useEditorStore } from "@/store/useEditorStore";
import { snapToWorldGrid } from "@/utils/geometry/coordinate";
import { buildDependencyMap } from "@/utils/geometry/dependencies";
import {
  generateConcentricArcPaths,
  type ArcProposal,
} from "@/utils/geometry/arcSolvers";

interface GhostRendererProps {
  elements: GeometryElement[];
}

type PositionMap = Map<string, { x: number; y: number }>;

/**
 * Build a map of ID -> Point for quick lookups
 */
function buildPointMap(elements: GeometryElement[]): Map<string, Point> {
  const map = new Map<string, Point>();
  for (const el of elements) {
    if (el.type === "point") {
      map.set(el.id, el as Point);
    }
  }
  return map;
}

/**
 * Build a map of radiusPoint ID -> Circle for quick lookups
 */
function buildRadiusPointMap(elements: GeometryElement[]): Map<string, Circle> {
  const map = new Map<string, Circle>();
  for (const el of elements) {
    if (el.type === "circle") {
      const circle = el as Circle;
      if (circle.radiusPoint) {
        map.set(circle.radiusPoint, circle);
      }
    }
  }
  return map;
}

/**
 * Compute the effective (snapped) positions for all dragged points
 */
function computeSnappedPositions(
  draggedIds: string[],
  startPositions: Map<string, { x: number; y: number }>,
  delta: { x: number; y: number },
  snapToGrid: boolean,
  gridSpacing: number,
): PositionMap {
  const positions = new Map<string, { x: number; y: number }>();

  for (const id of draggedIds) {
    const startPos = startPositions.get(id);
    if (!startPos) continue;

    let pos = { x: startPos.x + delta.x, y: startPos.y + delta.y };

    // Only snap when dragging a single point
    if (snapToGrid && draggedIds.length === 1) {
      pos = snapToWorldGrid(pos, gridSpacing);
    }

    positions.set(id, pos);
  }

  return positions;
}

/**
 * Check if snapped positions changed from previous
 */
function positionsChanged(
  current: PositionMap,
  previous: PositionMap,
): boolean {
  if (current.size !== previous.size) return true;

  for (const [id, pos] of current) {
    const prev = previous.get(id);
    if (!prev || prev.x !== pos.x || prev.y !== pos.y) {
      return true;
    }
  }
  return false;
}

/**
 * Get the effective position for a point - either snapped (if dragged) or original
 */
function getEffectivePosition(
  pointId: string | undefined,
  snappedPositions: PositionMap,
  pointMap: Map<string, Point>,
): { x: number; y: number } | null {
  if (!pointId) return null;

  const snappedPos = snappedPositions.get(pointId);
  if (snappedPos) return snappedPos;

  const point = pointMap.get(pointId);
  if (point) return { x: point.x, y: point.y };

  return null;
}

/**
 * Build arc ghost proposal from effective positions
 */
function buildArcProposal(
  arc: Arc,
  snappedPositions: PositionMap,
  pointMap: Map<string, Point>,
  scaledRadius: number,
): ArcProposal | null {
  const center = getEffectivePosition(
    arc.intersectionPoint,
    snappedPositions,
    pointMap,
  );
  const arcStart = getEffectivePosition(
    arc.arcStartPoint,
    snappedPositions,
    pointMap,
  );
  const arcEnd = getEffectivePosition(
    arc.arcEndPoint,
    snappedPositions,
    pointMap,
  );

  if (!center || !arcStart || !arcEnd) return null;

  const dir1 = { x: arcStart.x - center.x, y: arcStart.y - center.y };
  const dir2 = { x: arcEnd.x - center.x, y: arcEnd.y - center.y };

  return {
    quadrant: arc.quadrant,
    center,
    arcStart,
    arcEnd,
    startAngle: Math.atan2(dir1.y, dir1.x),
    endAngle: Math.atan2(dir2.y, dir2.x),
    sweepFlag: arc.direction === "cw" ? 1 : 0,
    largeArcFlag: 0,
    radius: scaledRadius,
    dir1,
    dir2,
    labelPosition: center,
  };
}

function GhostRendererInner({ elements }: GhostRendererProps) {
  // Subscribe to drag state via useSyncExternalStore
  const dragState = useDragState();

  const { totalScale } = useTotalScale();
  const preferences = useEditorStore((s) => s.preferences);
  const { primary } = useCssVars({ primary: "--color-primary" });

  // Track previous state to avoid flickering
  const prevSnappedRef = useRef<PositionMap>(new Map());
  const prevGhostRef = useRef<React.ReactNode>(null);

  // Memoize maps - only rebuild when elements change
  const pointMap = useMemo(() => buildPointMap(elements), [elements]);
  const dependencyMap = useMemo(() => buildDependencyMap(elements), [elements]);
  const radiusPointMap = useMemo(
    () => buildRadiusPointMap(elements),
    [elements],
  );

  // Early return if not dragging (before useMemo to avoid issues)
  if (!dragState || !dragState.isDragging) {
    return null;
  }

  const ghostElements = (() => {
    // Not dragging - clear cache and return null
    if (
      !dragState.isDragging ||
      !dragState.elementIds ||
      dragState.elementIds.length === 0 ||
      !dragState.currentDelta ||
      !dragState.startPositions
    ) {
      prevSnappedRef.current = new Map();
      prevGhostRef.current = null;
      return null;
    }

    const { elementIds: draggedIds, startPositions, currentDelta } = dragState;

    // 1. Compute snapped positions
    const snappedPositions = computeSnappedPositions(
      draggedIds,
      startPositions,
      currentDelta,
      preferences?.snapToGrid ?? false,
      preferences?.grid?.spacing ?? 1,
    );

    // 2. If positions unchanged, return previous ghost (avoid flickering)
    if (!positionsChanged(snappedPositions, prevSnappedRef.current)) {
      return prevGhostRef.current;
    }

    prevSnappedRef.current = snappedPositions;

    const ghosts: React.ReactNode[] = [];

    // 3. Render ghost for directly dragged points
    for (const id of draggedIds) {
      const point = pointMap.get(id);
      if (!point) continue;

      const ghostPos = snappedPositions.get(id);
      if (!ghostPos) continue;

      const scaledRadius = (point.style?.radius ?? 5) / totalScale;

      ghosts.push(
        <circle
          key={`ghost-point-${id}`}
          cx={ghostPos.x}
          cy={ghostPos.y}
          r={scaledRadius}
          fill={point.style?.fillColor || "none"}
          stroke={primary || "#10b981"}
          strokeWidth={point.style?.strokeWidth ?? 2}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
          opacity={0.6}
          style={{ pointerEvents: "none" }}
        />,
      );
    }

    // 4. Find all affected elements
    const affectedIds = new Set<ElementID>();

    // 4a. Via dependency map (lockedBy)
    for (const id of draggedIds) {
      const dependents = dependencyMap.get(id);
      if (dependents) {
        for (const depId of dependents) {
          affectedIds.add(depId);
        }
      }
    }

    // 4b. Via radiusPoint map
    for (const id of draggedIds) {
      const circleByRadius = radiusPointMap.get(id);
      if (circleByRadius) {
        affectedIds.add(circleByRadius.id);
      }
    }

    // 5. Render ghost for each affected element
    for (const affectedId of affectedIds) {
      const element = elements.find((el) => el.id === affectedId);
      if (!element) continue;

      switch (element.type) {
        case "line": {
          const line = element as Line;
          const startPos = getEffectivePosition(
            line.startPoint,
            snappedPositions,
            pointMap,
          );
          const endPos = getEffectivePosition(
            line.endPoint,
            snappedPositions,
            pointMap,
          );

          if (startPos && endPos) {
            ghosts.push(
              <line
                key={`ghost-line-${affectedId}`}
                x1={startPos.x}
                y1={startPos.y}
                x2={endPos.x}
                y2={endPos.y}
                stroke={primary || "#10b981"}
                strokeWidth={line.style?.strokeWidth ?? 2}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
                opacity={0.5}
                style={{ pointerEvents: "none" }}
              />,
            );
          }
          break;
        }

        case "circle": {
          const circle = element as Circle;
          const centerPos = getEffectivePosition(
            circle.centerPoint,
            snappedPositions,
            pointMap,
          );

          if (centerPos) {
            let ghostRadius = circle.radius ?? 1;

            if (circle.radiusPoint) {
              const radiusPos = getEffectivePosition(
                circle.radiusPoint,
                snappedPositions,
                pointMap,
              );
              if (radiusPos) {
                ghostRadius = Math.hypot(
                  radiusPos.x - centerPos.x,
                  radiusPos.y - centerPos.y,
                );
              }
            }

            ghosts.push(
              <circle
                key={`ghost-circle-${affectedId}`}
                cx={centerPos.x}
                cy={centerPos.y}
                r={ghostRadius}
                fill="none"
                stroke={primary || "#10b981"}
                strokeWidth={circle.style?.strokeWidth ?? 2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
                opacity={0.5}
                style={{ pointerEvents: "none" }}
              />,
            );
          }
          break;
        }

        case "arc": {
          const arc = element as Arc;
          const scaledArcRadius = (arc.style?.radius ?? 20) / totalScale;

          const proposal = buildArcProposal(
            arc,
            snappedPositions,
            pointMap,
            scaledArcRadius,
          );

          if (proposal) {
            const arcPaths = generateConcentricArcPaths(
              proposal,
              arc.style?.arcCount ?? 1,
              scaledArcRadius,
              5 / totalScale,
            );

            arcPaths.forEach((pathD, index) => {
              ghosts.push(
                <path
                  key={`ghost-arc-${affectedId}-${index}`}
                  d={pathD}
                  fill="none"
                  stroke={primary || "#10b981"}
                  strokeWidth={arc.style?.strokeWidth ?? 2}
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                  opacity={0.5}
                  style={{ pointerEvents: "none" }}
                />,
              );
            });
          }
          break;
        }
      }
    }

    const result =
      ghosts.length > 0 ? <g className="ghost-layer">{ghosts}</g> : null;
    prevGhostRef.current = result;
    return result;
  })();

  return ghostElements;
}

// Export memoized component to prevent parent re-renders from affecting ghost rendering
export const GhostRenderer = React.memo(GhostRendererInner);
