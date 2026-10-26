import { useMemo } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import type { Point, Polygon } from "@/geometry/types";
import { MINIMUM_SELECTION_WIDTH } from "@/geometry/constants";

interface PolygonElementProps {
  polygon: Polygon;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
}

export function PolygonElement({
  polygon,
  isSelected = false,
  onSelect,
}: PolygonElementProps) {
  const elements = useEditorStore((s) => s.elements);

  // Preserve vertex order by mapping through polygon.vertices
  const points = useMemo(() => {
    return polygon.vertices
      .map(
        (id) =>
          elements.find((el) => el.type === "point" && el.id === id) as
            | Point
            | undefined,
      )
      .filter((p): p is Point => p !== undefined);
  }, [polygon.vertices, elements]);

  if (points.length < 3) return null;

  const pathD =
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") +
    " Z";

  const hitboxWidth = Math.max(
    MINIMUM_SELECTION_WIDTH,
    polygon.style.strokeWidth,
  );

  return (
    <g filter={isSelected ? "url(#selection-glow)" : "none"}>
      {/* Hitbox - transparent, wider stroke */}
      <path
        d={pathD}
        fill={polygon.style.fillColor ? "transparent" : "none"}
        stroke="transparent"
        strokeWidth={hitboxWidth}
        onClick={onSelect}
        className="cursor-pointer"
      />
      {/* Visual polygon */}
      <path
        d={pathD}
        fill={polygon.style.fillColor || "none"}
        stroke={polygon.style.strokeColor}
        strokeWidth={polygon.style.strokeWidth}
        strokeDasharray={polygon.style.dashArray.join(" ")}
        style={{ opacity: polygon.style.opacity, pointerEvents: "none" }}
      />
    </g>
  );
}
