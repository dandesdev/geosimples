import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import type { Point, GeometryElement } from "@/geometry/types";
import { findNearestPoint } from "@/utils/geometry/math";
import { screenToWorld, snapToWorldGrid } from "@/utils/geometry/coordinate";
import { DEFAULT_POINT_STYLE } from "@/geometry/types";
import { useSvgDrag } from "@/hooks/useSvgDrag";
import { useSelectionBox } from "@/hooks/useSelectionBox";
import { useLineTool } from "@/hooks/useLineTool";
import { useCircleTool } from "@/hooks/useCircleTool";
import { useArcTool } from "@/hooks/useArcTool";
import { useCssVar } from "@/hooks/useCssVar";
import { PointElement } from "./PointElement";
import { SelectionGlowFilter } from "./SelectionGlowFilter";
import { SelectionBoxRect } from "./SelectionBoxRect";
import { ArcPreview } from "./previews/ArcPreview";
import { GhostRenderer } from "./previews/GhostRenderer";
import {
  LineElement,
  CircleElement,
  ArcElement,
  PolygonElement,
  LabelElement,
} from "./elements";

export function GeometryCanvas() {
  const svgElementRef = useRef<SVGSVGElement | null>(null);
  // Track recent drag to prevent click handler from modifying selection
  const justFinishedDrag = useRef(false);

  const {
    elements,
    transform,
    selection,
    tool,
    multiSelect,
    showBadges,
    selectionOrder,
    preferences,
    coordinateSystem,
    addElement,
    selectSingle,
    selectToggle,
    clearSelection,
    updateElementPosition,
    updateWorldOrigin,
    zoom,
    pan,
  } = useEditorStore();

  // Track cursor position in world coordinates for status bar
  const [cursorWorld, setCursorWorld] = useState({ x: 0, y: 0 });

  // Update world origin when canvas size changes
  useEffect(() => {
    const updateOrigin = () => {
      const rect = svgElementRef.current?.getBoundingClientRect();
      if (rect) {
        updateWorldOrigin(rect.width, rect.height);
      }
    };
    updateOrigin();
    window.addEventListener("resize", updateOrigin);
    return () => window.removeEventListener("resize", updateOrigin);
  }, [updateWorldOrigin]);

  // Custom SVG drag hook - only enabled when move tool is selected
  const isDragEnabled = tool === "move";

  const handleDragEnd = useCallback(
    (updates: Array<{ id: string; x: number; y: number }>) => {
      for (const update of updates) {
        updateElementPosition(update.id, update.x, update.y);
      }
      // Set flag to prevent click handler from clearing selection
      justFinishedDrag.current = true;
      // Reset flag after a short delay (after click event fires)
      setTimeout(() => {
        justFinishedDrag.current = false;
      }, 100);
    },
    [updateElementPosition],
  );

  const { dragState, handleMouseDown } = useSvgDrag({
    svgRef: svgElementRef,
    enabled: isDragEnabled,
    onDragEnd: handleDragEnd,
  });

  // Selection box for drag-to-select (only when select tool is active)
  const isSelectionBoxEnabled = tool === "select";
  const {
    handleSelectionBoxMouseDown,
    getSelectionRect,
    isSelecting,
    justFinishedSelecting,
  } = useSelectionBox({
    svgRef: svgElementRef,
    enabled: isSelectionBoxEnabled,
  });

  // Line tool with hover preview
  const {
    handleMouseMove: handleLineToolMouseMove,
    handleClick: handleLineToolClick,
    previewLine: lineToolPreviewLine,
    previewLinesFromSelection: lineToolPreviewLinesFromSelection,
  } = useLineTool({
    svgRef: svgElementRef,
  });

  // Circle tool with hover preview
  const {
    handleMouseMove: handleCircleToolMouseMove,
    handleClick: handleCircleToolClick,
    previewCircle: circleToolPreviewCircle,
    confirmCreation,
  } = useCircleTool({
    svgRef: svgElementRef,
  });

  // Arc tool for angle arcs between intersecting lines
  const {
    isActive: isArcToolActive,
    state: arcToolState,
    selectedLinesCount,
    handlePreviewClick: handleArcPreviewClick,
    handlePreviewHover: handleArcPreviewHover,
  } = useArcTool({
    svgRef: svgElementRef,
  });

  // Get hex color for SVG attributes (CSS vars don't work directly in SVG)
  const primaryColor = useCssVar("--color-primary", "#10b981");

  const selectedPoints = useMemo(() => {
    return elements.filter(
      (el): el is Point => el.type === "point" && selection.ids.includes(el.id),
    );
  }, [elements, selection.ids]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = svgElementRef.current?.getBoundingClientRect();
        if (!rect) return;
        const centerX = e.clientX - rect.left;
        const centerY = e.clientY - rect.top;
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        zoom(factor, centerX, centerY);
      } else {
        pan(-e.deltaX, -e.deltaY);
      }
    },
    [zoom, pan],
  );

  /**
   * Get screen coordinates from client coordinates.
   * This is the raw SVG position without world transformation.
   */
  const getScreenCoordinates = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgElementRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - transform.offsetX) / transform.scale,
        y: (clientY - rect.top - transform.offsetY) / transform.scale,
      };
    },
    [transform],
  );

  /**
   * Get world coordinates from client coordinates.
   * This applies the screen-to-world transformation (y-flip, origin offset, scale).
   */
  const getWorldCoordinates = useCallback(
    (clientX: number, clientY: number) => {
      const screenPoint = getScreenCoordinates(clientX, clientY);
      return screenToWorld(screenPoint, coordinateSystem);
    },
    [getScreenCoordinates, coordinateSystem],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Update cursor position in world coordinates for status bar
      const worldPos = getWorldCoordinates(e.clientX, e.clientY);
      setCursorWorld(worldPos);

      handleLineToolMouseMove(e);
      handleCircleToolMouseMove(e);
    },
    [getWorldCoordinates, handleLineToolMouseMove, handleCircleToolMouseMove],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't process clicks if we just finished dragging or selecting
      if (
        dragState.isDragging ||
        justFinishedDrag.current ||
        isSelecting ||
        justFinishedSelecting.current
      )
        return;

      // Get click position in world coordinates
      const worldCoords = getWorldCoordinates(e.clientX, e.clientY);

      if (tool === "point") {
        // Snap to world grid if enabled
        const finalCoords = preferences.snapToGrid
          ? snapToWorldGrid(worldCoords, preferences.grid.spacing)
          : worldCoords;

        const point: Point = {
          id: crypto.randomUUID(),
          type: "point",
          x: finalCoords.x,
          y: finalCoords.y,
          style: { ...DEFAULT_POINT_STYLE },
          lockedBy: [], // Free point
        };
        addElement(point);
      } else if (tool === "select" || tool === "move") {
        const points = elements.filter(
          (el): el is Point => el.type === "point",
        );
        // Find nearest point in world coordinates
        // Adjust threshold based on world scale (convert 15px to world units)
        const worldThreshold =
          15 / (transform.scale * coordinateSystem.pixelsPerUnit);
        const nearest = findNearestPoint(worldCoords, points, worldThreshold);
        if (nearest) {
          if (e.shiftKey && !multiSelect) {
            selectToggle(nearest.id);
          } else if (multiSelect) {
            selectToggle(nearest.id);
          } else {
            selectSingle(nearest.id);
          }
        } else {
          clearSelection();
        }
      } else if (tool === "line") {
        // Delegate to line tool hook with world coordinates
        handleLineToolClick(e, worldCoords);
      } else if (tool === "circle") {
        // Delegate to circle tool hook with world coordinates
        handleCircleToolClick(e, worldCoords);
      }
    },
    [
      dragState.isDragging,
      elements,
      transform,
      coordinateSystem,
      tool,
      multiSelect,
      preferences,
      addElement,
      selectSingle,
      selectToggle,
      clearSelection,
      getWorldCoordinates,
      handleLineToolClick,
      handleCircleToolClick,
    ],
  );

  const renderElement = (element: GeometryElement) => {
    switch (element.type) {
      case "point":
        return (
          <PointElement
            key={element.id}
            point={element}
            showBadges={showBadges}
            selectedPoints={selectedPoints}
            isDragEnabled={isDragEnabled}
            dragState={dragState}
            onDragStart={handleMouseDown}
          />
        );
      case "line": {
        // Resolve point coordinates from elements
        const startPoint = elements.find(
          (el) => el.type === "point" && el.id === element.startPoint,
        ) as Point | undefined;
        const endPoint = elements.find(
          (el) => el.type === "point" && el.id === element.endPoint,
        ) as Point | undefined;

        if (!startPoint || !endPoint) return null;

        const lineIsSelected = selection.ids.includes(element.id);

        return (
          <LineElement
            key={element.id}
            line={element}
            startX={startPoint.x}
            startY={startPoint.y}
            endX={endPoint.x}
            endY={endPoint.y}
            isSelected={lineIsSelected}
            onSelect={(e) => {
              e.stopPropagation();
              if (e.shiftKey) {
                selectToggle(element.id);
              } else {
                selectSingle(element.id);
              }
            }}
          />
        );
      }
      case "circle":
        return (
          <CircleElement
            key={element.id}
            circle={element}
            isSelected={selection.ids.includes(element.id)}
            onSelect={(e) => {
              e.stopPropagation();
              if (e.shiftKey) {
                selectToggle(element.id);
              } else {
                selectSingle(element.id);
              }
            }}
          />
        );
      case "arc":
        return (
          <ArcElement
            key={element.id}
            arc={element}
            isSelected={selection.ids.includes(element.id)}
            onSelect={(e) => {
              e.stopPropagation();
              if (e.shiftKey) {
                selectToggle(element.id);
              } else {
                selectSingle(element.id);
              }
            }}
          />
        );
      case "polygon":
        return (
          <PolygonElement
            key={element.id}
            polygon={element}
            isSelected={selection.ids.includes(element.id)}
            onSelect={(e) => {
              e.stopPropagation();
              if (e.shiftKey) {
                selectToggle(element.id);
              } else {
                selectSingle(element.id);
              }
            }}
          />
        );
      case "label":
        return <LabelElement key={element.id} label={element} />;
      default:
        return null;
    }
  };

  // Line preview: from hook (includes hover preview and multi-select previews)
  const previewLines = useMemo(() => {
    const lines: React.ReactNode[] = [];

    // Multi-select preview lines (shown when line tool active and 2+ points selected)
    for (const preview of lineToolPreviewLinesFromSelection) {
      lines.push(
        <line
          key={`preview-multi-${lines.length}`}
          x1={preview.startX}
          y1={preview.startY}
          x2={preview.endX}
          y2={preview.endY}
          stroke={primaryColor}
          strokeWidth={2}
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
          strokeOpacity={0.8}
          pointerEvents="none"
        />,
      );
    }

    // Single hover preview line (from selected point to hovered/cursor)
    if (lineToolPreviewLine) {
      lines.push(
        <line
          key="preview-hover"
          x1={lineToolPreviewLine.startX}
          y1={lineToolPreviewLine.startY}
          x2={lineToolPreviewLine.endX}
          y2={lineToolPreviewLine.endY}
          stroke={primaryColor}
          strokeWidth={2}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
          strokeOpacity={0.7}
          pointerEvents="none"
        />,
      );
    }

    return lines.length > 0 ? lines : null;
  }, [
    lineToolPreviewLine,
    lineToolPreviewLinesFromSelection,
    primaryColor,
    tool,
    /* force update when hovering tool changes */
  ]);

  const circlePreview = useMemo(() => {
    if (!circleToolPreviewCircle) return null;
    return (
      <circle
        cx={circleToolPreviewCircle.centerX}
        cy={circleToolPreviewCircle.centerY}
        r={circleToolPreviewCircle.radius}
        fill="none"
        stroke={primaryColor}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
        style={{
          pointerEvents: "visibleStroke",
          opacity: 0.8,
          cursor: "pointer",
        }}
        onClick={(e) => {
          e.stopPropagation(); // Prevent canvas click handler
          confirmCreation && confirmCreation();
        }}
      />
    );
  }, [circleToolPreviewCircle, primaryColor, confirmCreation]);

  // Note: Ghost preview for dragging is now handled by GhostRenderer component

  // Determine cursor based on tool and drag state
  const getCursor = () => {
    if (dragState.isDragging) return "grabbing";
    if (tool === "move") return "move";
    if (tool === "select") return "default";
    return "crosshair";
  };

  return (
    <div className="flex-1 relative overflow-hidden">
      <svg
        ref={svgElementRef}
        className="w-full h-full"
        onWheel={handleWheel}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseDown={
          isSelectionBoxEnabled ? handleSelectionBoxMouseDown : undefined
        }
        style={{ cursor: getCursor() }}
      >
        <defs>
          {/* Grid pattern using world units */}
          <pattern
            id="grid"
            width={preferences.grid.spacing * coordinateSystem.pixelsPerUnit}
            height={preferences.grid.spacing * coordinateSystem.pixelsPerUnit}
            patternUnits="userSpaceOnUse"
            x={coordinateSystem.worldOrigin.x}
            y={coordinateSystem.worldOrigin.y}
          >
            <path
              d={`M ${preferences.grid.spacing * coordinateSystem.pixelsPerUnit} 0 L 0 0 0 ${preferences.grid.spacing * coordinateSystem.pixelsPerUnit}`}
              fill="none"
              stroke={preferences.grid.color}
              strokeWidth={0.5}
              strokeOpacity={preferences.grid.opacity}
            />
          </pattern>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="currentColor"
              className="text-foreground"
            />
          </marker>
          <SelectionGlowFilter />
        </defs>

        <g
          transform={`translate(${transform.offsetX}, ${transform.offsetY}) scale(${transform.scale})`}
        >
          {preferences.grid.visible && (
            <rect
              x="-10000"
              y="-10000"
              width="20000"
              height="20000"
              fill="url(#grid)"
            />
          )}

          {/* Axes positioned at world origin */}
          {preferences.axis.visible && (
            <>
              {/* X-axis (horizontal line at y=0 in world coords) */}
              <line
                x1={-10000}
                y1={coordinateSystem.worldOrigin.y}
                x2={10000}
                y2={coordinateSystem.worldOrigin.y}
                stroke={preferences.axis.xColor}
                strokeWidth={1}
              />
              {/* Y-axis (vertical line at x=0 in world coords) */}
              <line
                x1={coordinateSystem.worldOrigin.x}
                y1={-10000}
                x2={coordinateSystem.worldOrigin.x}
                y2={10000}
                stroke={preferences.axis.yColor}
                strokeWidth={1}
              />
            </>
          )}

          {/* World coordinate transform group:
              - Translate to world origin
              - Scale by pixelsPerUnit 
              - Flip Y axis (world Y up, screen Y down) */}
          <g
            transform={`translate(${coordinateSystem.worldOrigin.x}, ${coordinateSystem.worldOrigin.y}) scale(${coordinateSystem.pixelsPerUnit}, ${-coordinateSystem.pixelsPerUnit})`}
          >
            {/* Render non-point elements first (Lines, Circles, etc.) */}
            {elements.filter((el) => el.type !== "point").map(renderElement)}

            {previewLines}
            {circlePreview}
            {circleToolPreviewCircle?.error &&
              circleToolPreviewCircle.errorPosition && (
                <text
                  x={circleToolPreviewCircle.errorPosition.x}
                  y={circleToolPreviewCircle.errorPosition.y}
                  fill="red"
                  fontSize={14 / coordinateSystem.pixelsPerUnit}
                  textAnchor="middle"
                  dy="-10"
                  transform={`scale(1, -1)`}
                >
                  {circleToolPreviewCircle.error}
                </text>
              )}

            {/* Arc tool preview - shown when arc tool active and 2 lines selected */}
            {isArcToolActive && selectedLinesCount === 2 && (
              <>
                <ArcPreview
                  proposals={arcToolState.proposals}
                  highlightedQuadrant={arcToolState.highlightedQuadrant}
                  onPreviewClick={handleArcPreviewClick}
                  onPreviewHover={handleArcPreviewHover}
                />
                {arcToolState.errorMessage && arcToolState.intersection && (
                  <text
                    x={arcToolState.intersection.x}
                    y={arcToolState.intersection.y}
                    fill="red"
                    fontSize={14 / coordinateSystem.pixelsPerUnit}
                    textAnchor="middle"
                    transform={`scale(1, -1)`}
                  >
                    {arcToolState.errorMessage}
                  </text>
                )}
              </>
            )}
            {/* Arc tool instruction when not enough lines selected */}
            {isArcToolActive && selectedLinesCount !== 2 && (
              <text
                x={0}
                y={2}
                fill="var(--foreground)"
                fontSize={14 / coordinateSystem.pixelsPerUnit}
                textAnchor="middle"
                opacity={0.6}
                transform={`scale(1, -1)`}
              >
                Select 2 intersecting lines to create an angle arc
              </text>
            )}

            {/* Render points last to ensure they are on top for selection */}
            {elements.filter((el) => el.type === "point").map(renderElement)}

            {/* Selection box rectangle - now in world coordinates */}
            {(() => {
              const rect = getSelectionRect();
              if (!rect) return null;
              const totalScale =
                transform.scale * coordinateSystem.pixelsPerUnit;
              return (
                <SelectionBoxRect
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  scale={totalScale}
                />
              );
            })()}

            {/* Ghost preview for drag - rendered after elements so it's on top */}
            <GhostRenderer elements={elements} />
          </g>
        </g>
      </svg>

      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
        ({cursorWorld.x.toFixed(1)}, {cursorWorld.y.toFixed(1)}) | Zoom:{" "}
        {Math.round(transform.scale * 100)}% |{" "}
        {elements.filter((e) => e.type === "point").length} points
        {selectionOrder.length > 0 && (
          <span className="ml-2 text-primary">
            | {selectionOrder.length} selected
          </span>
        )}
        {tool === "move" && (
          <span className="ml-2 text-primary">| Move mode</span>
        )}
      </div>
    </div>
  );
}
