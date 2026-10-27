import type { Line } from "@geosimples/core/geo";
import { MINIMUM_SELECTION_WIDTH } from "@/geometry/constants";
import { useTotalScale } from "@/hooks/useTotalScale";

interface LineElementProps {
  line: Line;
  /** Start point coordinates (resolved by parent) */
  startX: number;
  startY: number;
  /** End point coordinates (resolved by parent) */
  endX: number;
  endY: number;
  /** Whether this line is currently selected */
  isSelected?: boolean;
  /** Callback when line is clicked for selection */
  onSelect?: (e: React.MouseEvent) => void;
}

/**
 * Renders a line segment between two points.
 * Includes an invisible hitbox for easier selection.
 */
export function LineElement({
  line,
  startX,
  startY,
  endX,
  endY,
  isSelected = false,
  onSelect,
}: LineElementProps) {
  const { totalScale } = useTotalScale();

  // Calculate hitbox width in world units
  const hitboxWidth =
    Math.max(MINIMUM_SELECTION_WIDTH, line.style.strokeWidth) / totalScale;

  return (
    <g filter={isSelected ? "url(#selection-glow)" : "none"}>
      {/* Hitbox - transparent, wider stroke for easier clicking */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="transparent"
        strokeWidth={hitboxWidth}
        strokeLinecap="round"
        onClick={onSelect}
        className="cursor-pointer"
      />
      {/* Visual line - actual rendering with non-scaling stroke */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={line.style.strokeColor}
        strokeWidth={line.style.strokeWidth}
        strokeDasharray={line.style.dashArray.join(" ")}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        markerEnd={
          line.style.endMarkers === "arrow" || line.style.endMarkers === "both"
            ? "url(#arrowhead)"
            : undefined
        }
        markerStart={
          line.style.endMarkers === "both" ? "url(#arrowhead)" : undefined
        }
        style={{ opacity: line.style.opacity, pointerEvents: "none" }}
      />
    </g>
  );
}
