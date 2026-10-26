import { useEditorStore } from "@/store/useEditorStore";
import { useTotalScale } from "@/hooks/useTotalScale";
import { distance, type Circle, type Point } from "@geosimples/core/geo";
import { MINIMUM_SELECTION_WIDTH } from "@/geometry/constants";

interface CircleElementProps {
  circle: Circle;
  /** Whether this circle is currently selected */
  isSelected?: boolean;
  /** Callback when circle is clicked for selection */
  onSelect?: (e: React.MouseEvent) => void;
}

export function CircleElement({
  circle,
  isSelected = false,
  onSelect,
}: CircleElementProps) {
  const center = useEditorStore((s) =>
    s.elements.find(
      (el): el is Point => el.type === "point" && el.id === circle.centerPoint,
    ),
  );

  const radiusPoint = useEditorStore((s) =>
    circle.radiusPoint
      ? (s.elements.find(
          (el) => el.id === circle.radiusPoint && el.type === "point",
        ) as Point | undefined)
      : undefined,
  );

  const { totalScale } = useTotalScale();

  if (!center) return null;

  const radius = radiusPoint
    ? distance(
        { x: center.x, y: center.y },
        { x: radiusPoint.x, y: radiusPoint.y },
      )
    : circle.radius;

  // Calculate hitbox width in world units
  const hitboxWidth =
    Math.max(MINIMUM_SELECTION_WIDTH, circle.style.strokeWidth) / totalScale;

  return (
    <g filter={isSelected ? "url(#selection-glow)" : "none"}>
      {/* Hitbox - transparent, wider stroke */}
      <circle
        cx={center.x}
        cy={center.y}
        r={radius}
        fill="none"
        stroke="transparent"
        strokeWidth={hitboxWidth}
        onClick={onSelect}
        className="cursor-pointer"
      />
      {/* Visual circle with non-scaling stroke */}
      <circle
        cx={center.x}
        cy={center.y}
        r={radius}
        fill={circle.style.fillColor || "none"}
        stroke={circle.style.strokeColor}
        strokeWidth={circle.style.strokeWidth}
        strokeDasharray={circle.style.dashArray.join(" ")}
        vectorEffect="non-scaling-stroke"
        style={{ opacity: circle.style.opacity, pointerEvents: "none" }}
      />
    </g>
  );
}
