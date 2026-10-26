import { useState, useCallback, useRef, useEffect } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import { screenToWorld } from "@/utils/geometry/coordinate";
import type { Point } from "@geosimples/core/geo";

export interface SelectionBoxState {
  isSelecting: boolean;
  startPoint: { x: number; y: number } | null;
  currentPoint: { x: number; y: number } | null;
}

export interface UseSelectionBoxOptions {
  svgRef: React.RefObject<SVGSVGElement | null>;
  enabled?: boolean;
  /** Minimum drag distance to trigger selection box (prevents accidental selections from clicks) */
  minDragDistance?: number;
}

const EMPTY_STATE: SelectionBoxState = {
  isSelecting: false,
  startPoint: null,
  currentPoint: null,
};

/**
 * Hook for drag-to-select box functionality.
 * When the user drags on empty canvas space with the select tool,
 * draws a selection rectangle and selects all points within it.
 */
export function useSelectionBox({
  svgRef,
  enabled = true,
  minDragDistance = 5,
}: UseSelectionBoxOptions) {
  const [state, setState] = useState<SelectionBoxState>(EMPTY_STATE);

  const transform = useEditorStore((s) => s.transform);
  const coordinateSystem = useEditorStore((s) => s.coordinateSystem);
  const elements = useEditorStore((s) => s.elements);
  const select = useEditorStore((s) => s.select);
  const selectToggle = useEditorStore((s) => s.selectToggle);

  const startClientPos = useRef<{ x: number; y: number } | null>(null);
  const hasPassedThreshold = useRef(false);
  const isShiftHeld = useRef(false);
  const justFinishedSelecting = useRef(false);

  /** Convert client coordinates to world coordinates */
  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };

      // First convert to screen/pixel coordinates relative to SVG
      const screenX =
        (clientX - rect.left - transform.offsetX) / transform.scale;
      const screenY =
        (clientY - rect.top - transform.offsetY) / transform.scale;

      // Then convert to world coordinates using screenToWorld
      return screenToWorld({ x: screenX, y: screenY }, coordinateSystem);
    },
    [svgRef, transform, coordinateSystem],
  );

  /** Start selection on mousedown in empty canvas area */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;

      // Only left mouse button
      if (e.button !== 0) return;

      const canvasCoords = clientToWorld(e.clientX, e.clientY);

      startClientPos.current = { x: e.clientX, y: e.clientY };
      hasPassedThreshold.current = false;
      isShiftHeld.current = e.shiftKey;

      setState({
        isSelecting: true,
        startPoint: canvasCoords,
        currentPoint: canvasCoords,
      });
    },
    [enabled, clientToWorld],
  );

  /** Update selection box on mousemove */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!state.isSelecting || !startClientPos.current) return;

      // Check if we've passed the minimum drag threshold
      if (!hasPassedThreshold.current) {
        const dx = e.clientX - startClientPos.current.x;
        const dy = e.clientY - startClientPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDragDistance) {
          return; // Don't show selection box yet
        }
        hasPassedThreshold.current = true;
      }

      const canvasCoords = clientToWorld(e.clientX, e.clientY);
      setState((prev) => ({
        ...prev,
        currentPoint: canvasCoords,
      }));
    },
    [state.isSelecting, clientToWorld, minDragDistance],
  );

  /** Complete selection on mouseup */
  const handleMouseUp = useCallback(
    (_e: MouseEvent) => {
      if (!state.isSelecting) return;

      // Only select if we passed the threshold (was a real drag, not a click)
      if (
        hasPassedThreshold.current &&
        state.startPoint &&
        state.currentPoint
      ) {
        // Calculate selection bounds
        const minX = Math.min(state.startPoint.x, state.currentPoint.x);
        const maxX = Math.max(state.startPoint.x, state.currentPoint.x);
        const minY = Math.min(state.startPoint.y, state.currentPoint.y);
        const maxY = Math.max(state.startPoint.y, state.currentPoint.y);

        // Find primitives in box
        const elementsInBox = elements.filter((el) => {
          if (el.type === "point") {
            return el.x >= minX && el.x <= maxX && el.y >= minY && el.y <= maxY;
          } else if (el.type === "line") {
            // Select line if both endpoints are within the box
            const startPoint = elements.find(
              (e) => e.type === "point" && e.id === el.startPoint,
            ) as Point | undefined;
            const endPoint = elements.find(
              (e) => e.type === "point" && e.id === el.endPoint,
            ) as Point | undefined;

            if (!startPoint || !endPoint) return false;

            const startIn =
              startPoint.x >= minX &&
              startPoint.x <= maxX &&
              startPoint.y >= minY &&
              startPoint.y <= maxY;
            const endIn =
              endPoint.x >= minX &&
              endPoint.x <= maxX &&
              endPoint.y >= minY &&
              endPoint.y <= maxY;

            return startIn && endIn;
          }
          return false;
        });

        if (elementsInBox.length > 0) {
          const ids = elementsInBox.map((el) => el.id);

          if (isShiftHeld.current) {
            // Shift + drag: add to existing selection
            ids.forEach((id) => selectToggle(id));
          } else {
            // Default: replace selection with new items
            select(ids);
          }
        }
      }

      // Reset state
      setState(EMPTY_STATE);
      startClientPos.current = null;

      // Set flag to prevent click handler from clearing selection
      if (hasPassedThreshold.current) {
        justFinishedSelecting.current = true;
        setTimeout(() => {
          justFinishedSelecting.current = false;
        }, 100);
      }

      hasPassedThreshold.current = false;
    },
    [state, elements, select, selectToggle],
  );

  // Attach global mouse listeners when selecting
  useEffect(() => {
    if (state.isSelecting) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [state.isSelecting, handleMouseMove, handleMouseUp]);

  /** Get the selection box rect for rendering (normalized coordinates) */
  const getSelectionRect = useCallback(() => {
    if (
      !state.isSelecting ||
      !state.startPoint ||
      !state.currentPoint ||
      !hasPassedThreshold.current
    ) {
      return null;
    }

    const x = Math.min(state.startPoint.x, state.currentPoint.x);
    const y = Math.min(state.startPoint.y, state.currentPoint.y);
    const width = Math.abs(state.currentPoint.x - state.startPoint.x);
    const height = Math.abs(state.currentPoint.y - state.startPoint.y);

    return { x, y, width, height };
  }, [state]);

  return {
    selectionBoxState: state,
    handleSelectionBoxMouseDown: handleMouseDown,
    getSelectionRect,
    isSelecting: state.isSelecting && hasPassedThreshold.current,
    justFinishedSelecting,
  };
}
