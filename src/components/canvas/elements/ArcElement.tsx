/**
 * ArcElement - Renders an angle arc between two intersecting line segments
 */

import { useMemo } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import { useTotalScale } from "@/hooks/useTotalScale";
import type { Point, Arc } from "@/geometry/types";
import { MINIMUM_SELECTION_WIDTH } from "@/geometry/constants";
import {
  generateConcentricArcPaths,
  calculateTickMarks,
  type ArcProposal,
} from "@/utils/geometry/arcSolvers";

interface ArcElementProps {
  arc: Arc;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
}

export function ArcElement({
  arc,
  isSelected = false,
  onSelect,
}: ArcElementProps) {
  // Get all elements and find the required points using useMemo for stable reference
  const elements = useEditorStore((s) => s.elements);
  const { totalScale } = useTotalScale();

  // Use useMemo to compute points from elements - this is stable
  const { intersection, arcStart, arcEnd } = useMemo(() => {
    let intersection: Point | undefined;
    let arcStart: Point | undefined;
    let arcEnd: Point | undefined;

    for (const el of elements) {
      if (el.type === "point") {
        if (el.id === arc.intersectionPoint) intersection = el;
        else if (el.id === arc.arcStartPoint) arcStart = el;
        else if (el.id === arc.arcEndPoint) arcEnd = el;
      }
    }

    return { intersection, arcStart, arcEnd };
  }, [elements, arc.intersectionPoint, arc.arcStartPoint, arc.arcEndPoint]);

  // Convert pixel values to world units
  const scaledArcRadius = arc.style.radius / totalScale;
  const scaledSpacing = 5 / totalScale; // 5px spacing
  const scaledTickLength = 8 / totalScale; // 8px tick length
  const scaledLabelOffset = 20 / totalScale; // 20px label offset
  const scaledHitboxWidth =
    Math.max(MINIMUM_SELECTION_WIDTH, arc.style.strokeWidth + 10) / totalScale;

  // Calculate arc geometry
  const arcGeometry = useMemo(() => {
    if (!intersection || !arcStart || !arcEnd) return null;

    const center = { x: intersection.x, y: intersection.y };
    const startPt = { x: arcStart.x, y: arcStart.y };
    const endPt = { x: arcEnd.x, y: arcEnd.y };

    // Direction vectors from center
    const dir1 = { x: startPt.x - center.x, y: startPt.y - center.y };
    const dir2 = { x: endPt.x - center.x, y: endPt.y - center.y };

    const startAngle = Math.atan2(dir1.y, dir1.x);
    const endAngle = Math.atan2(dir2.y, dir2.x);

    // Determine sweep flag based on direction
    const sweepFlag: 0 | 1 = arc.direction === "cw" ? 1 : 0;

    // Calculate label position
    const chordMidX = (startPt.x + endPt.x) / 2;
    const chordMidY = (startPt.y + endPt.y) / 2;
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

    const labelPosition = {
      x: center.x + labelDirX * (scaledArcRadius + scaledLabelOffset),
      y: center.y + labelDirY * (scaledArcRadius + scaledLabelOffset),
    };

    const proposal: ArcProposal = {
      quadrant: arc.quadrant,
      center,
      arcStart: startPt,
      arcEnd: endPt,
      startAngle,
      endAngle,
      sweepFlag,
      largeArcFlag: 0,
      radius: scaledArcRadius,
      dir1,
      dir2,
      labelPosition,
    };

    return proposal;
  }, [
    intersection,
    arcStart,
    arcEnd,
    arc.direction,
    arc.quadrant,
    scaledArcRadius,
    scaledLabelOffset,
  ]);

  if (!arcGeometry) return null;

  // Generate paths for concentric arcs
  const arcPaths = generateConcentricArcPaths(
    arcGeometry,
    arc.style.arcCount,
    scaledArcRadius,
    scaledSpacing,
  );

  // Generate tick marks
  const tickMarks = calculateTickMarks(
    arcGeometry,
    arc.style.tickMarks,
    scaledTickLength,
  );

  return (
    <g filter={isSelected ? "url(#selection-glow)" : "none"}>
      {/* Hitbox - using first arc path */}
      <path
        d={arcPaths[0]}
        fill="none"
        stroke="transparent"
        strokeWidth={scaledHitboxWidth}
        onClick={onSelect}
        className="cursor-pointer"
      />

      {/* Visual arcs (1, 2, or 3 concentric) with non-scaling stroke */}
      {arcPaths.map((pathD, index) => (
        <path
          key={index}
          d={pathD}
          fill="none"
          stroke={arc.style.strokeColor}
          strokeWidth={arc.style.strokeWidth}
          strokeDasharray={arc.style.dashArray.join(" ")}
          vectorEffect="non-scaling-stroke"
          style={{ opacity: arc.style.opacity, pointerEvents: "none" }}
        />
      ))}

      {/* Fill (if specified) - only for first arc */}
      {arc.style.fillColor && arc.style.fillPattern && (
        <path
          d={arcPaths[0]}
          fill={arc.style.fillColor}
          stroke="none"
          style={{ opacity: arc.style.opacity * 0.3, pointerEvents: "none" }}
        />
      )}

      {/* Tick marks with non-scaling stroke */}
      {tickMarks.map((tick, index) => (
        <line
          key={`tick-${index}`}
          x1={tick.start.x}
          y1={tick.start.y}
          x2={tick.end.x}
          y2={tick.end.y}
          stroke={arc.style.strokeColor}
          strokeWidth={arc.style.strokeWidth}
          vectorEffect="non-scaling-stroke"
          style={{ opacity: arc.style.opacity, pointerEvents: "none" }}
        />
      ))}
    </g>
  );
}
