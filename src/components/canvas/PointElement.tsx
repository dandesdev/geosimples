import { useEditorStore } from "@/store/useEditorStore";
import { useTotalScale } from "@/hooks/useTotalScale";
import type { Point } from "@/geometry/types";
import type { DragState } from "@/hooks/useSvgDrag";
import { useCssVars } from "@/hooks/useCssVar";
import { MINIMUM_SELECTION_WIDTH } from "@/geometry/constants";

interface PointElementProps {
  point: Point;
  showBadges?: boolean;
  selectedPoints: Point[];
  isDragEnabled: boolean;
  dragState: DragState;
  onDragStart: (e: React.MouseEvent, elementId: string) => void;
}

export function PointElement({
  point,
  showBadges,
  selectedPoints,
  isDragEnabled,
  dragState,
  onDragStart,
}: PointElementProps) {
  const selectionOrder = useEditorStore((s) => s.selectionOrder);
  const isSelected = useEditorStore((s) => s.selection.ids.includes(point.id));
  const isHoveringLineTool = useEditorStore((s) => s.isHoveringLineTool);
  const { totalScale } = useTotalScale();
  const orderIndex = selectionOrder.indexOf(point.id);

  // Get hex colors for SVG attributes (CSS vars don't work directly in SVG)
  const colors = useCssVars({
    muted: "--color-muted",
    foreground: "--color-foreground",
  });

  const isBeingDragged =
    dragState.isDragging && dragState.elementIds.includes(point.id);

  // Show badge when:
  // 1. showBadges toggle is on (for any selected element), OR
  // 2. Hovering line tool with 2+ points selected (to preview which points will form lines)
  const showBadge =
    isSelected &&
    orderIndex >= 0 &&
    (showBadges || (isHoveringLineTool && selectedPoints.length >= 2));

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDragEnabled) {
      onDragStart(e, point.id);
    }
  };

  // Cursor: move tool uses 'move' cursor, pan will use 'grab'
  const getCursor = () => {
    if (!isDragEnabled) return "default";
    return isBeingDragged ? "grabbing" : "move";
  };

  // Convert pixel values to world units
  const scaledRadius = point.style.radius / totalScale;
  const scaledStrokeWidth = point.style.strokeWidth / totalScale;
  const scaledHitboxRadius = Math.max(
    scaledRadius,
    MINIMUM_SELECTION_WIDTH / 2 / totalScale,
  );
  const scaledHitboxStroke = MINIMUM_SELECTION_WIDTH / totalScale;

  // Badge positioning and sizing (all in world units)
  const badgeOffset = 10 / totalScale;
  const badgeRadius = 7 / totalScale;
  const badgeFontSize = 9 / totalScale;

  // Label positioning and sizing
  const labelOffset = (point.style.radius + 4) / totalScale;
  const labelFontSize = 12 / totalScale;

  return (
    <g onMouseDown={handleMouseDown} style={{ cursor: getCursor() }}>
      {/* Hitbox - transparent, larger radius for easier clicking */}
      <circle
        cx={point.x}
        cy={point.y}
        r={scaledHitboxRadius}
        fill="transparent"
        stroke="transparent"
        strokeWidth={scaledHitboxStroke}
        className="cursor-pointer"
      />
      {/* Main point circle - wrapped in filtered group when selected */}
      <g filter={isSelected ? "url(#selection-glow)" : "none"}>
        <circle
          cx={point.x}
          cy={point.y}
          r={scaledRadius}
          fill={point.style.fillColor || "none"}
          stroke={point.style.strokeColor}
          strokeWidth={scaledStrokeWidth}
          strokeDasharray={point.style.dashArray
            .map((d) => d / totalScale)
            .join(" ")}
          style={{
            opacity: point.style.opacity,
            pointerEvents: "none",
          }}
        />
      </g>

      {showBadge && (
        <g>
          <circle
            cx={point.x + badgeOffset}
            cy={point.y + badgeOffset}
            r={badgeRadius}
            fill={colors.muted}
            fillOpacity={0.6}
            stroke="none"
          />
          <text
            x={point.x + badgeOffset}
            y={point.y + badgeOffset}
            textAnchor="middle"
            dominantBaseline="central"
            fill={colors.foreground}
            fontSize={badgeFontSize}
            fontWeight="bold"
            transform={`translate(${point.x + badgeOffset}, ${point.y + badgeOffset}) scale(1, -1) translate(${-(point.x + badgeOffset)}, ${-(point.y + badgeOffset)})`}
          >
            {orderIndex + 1}
          </text>
        </g>
      )}
      {point.label && (
        <text
          x={point.x + labelOffset}
          y={point.y}
          fill={point.style.labelColor}
          fontSize={labelFontSize}
          fontFamily="Inter"
          dominantBaseline="central"
          transform={`translate(${point.x + labelOffset}, ${point.y}) scale(1, -1) translate(${-(point.x + labelOffset)}, ${-point.y})`}
        >
          {point.label}
        </text>
      )}
    </g>
  );
}
