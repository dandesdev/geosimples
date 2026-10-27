import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import {
  DEFAULT_LINE_STYLE,
  findNearestPoint,
  getProposedLine,
  type Line,
  type Point,
} from "@geosimples/core/geo";
import { screenToWorld } from "@/utils/geometry/coordinate";

export interface UseLineToolOptions {
  svgRef: React.RefObject<SVGSVGElement | null>;
}

export interface LinePreview {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * Hook for line tool functionality.
 * Handles point selection, hover preview, and line creation.
 */
export function useLineTool({ svgRef }: UseLineToolOptions) {
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Store refs to track previous state for "On Activation" logic
  const wasActiveRef = useRef(false);

  const tool = useEditorStore((s) => s.tool);
  const elements = useEditorStore((s) => s.elements);
  const selection = useEditorStore((s) => s.selection);
  const transform = useEditorStore((s) => s.transform);
  const coordinateSystem = useEditorStore((s) => s.coordinateSystem);
  const isHoveringLineTool = useEditorStore((s) => s.isHoveringLineTool);

  const addElement = useEditorStore((s) => s.addElement);
  const selectSingle = useEditorStore((s) => s.selectSingle);
  // const selectToggle = useEditorStore((s) => s.selectToggle);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  const isActive = tool === "line";
  const shouldShowPreview = isActive || isHoveringLineTool;

  // 1. Calculate Proposal
  const proposal = useMemo(() => {
    if (!shouldShowPreview) return null;

    return getProposedLine(selection.ids, elements, {
      hoveredPointId: isActive ? hoveredPointId : null,
      mousePosition: isActive ? mousePosition : null,
    });
  }, [
    selection.ids,
    elements,
    hoveredPointId,
    mousePosition,
    isActive,
    shouldShowPreview,
  ]);

  // 2. Map Proposal to Preview(s)
  const previewLine = useMemo((): LinePreview | null => {
    if (!proposal) return null;

    // Single line preview (2-points or interactive)
    if (
      (proposal.mode === "2-points" ||
        proposal.mode === "1-point-interactive") &&
      proposal.start &&
      proposal.end
    ) {
      return {
        startX: proposal.start.x,
        startY: proposal.start.y,
        endX: proposal.end.x,
        endY: proposal.end.y,
      };
    }
    return null;
  }, [proposal]);

  const previewLinesFromSelection = useMemo((): LinePreview[] => {
    if (!proposal || proposal.mode !== "multi-points" || !proposal.multiPoints)
      return [];

    const previews: LinePreview[] = [];
    for (let i = 0; i < proposal.multiPoints.length - 1; i++) {
      const p1 = proposal.multiPoints[i];
      const p2 = proposal.multiPoints[i + 1];
      previews.push({
        startX: p1.x,
        startY: p1.y,
        endX: p2.x,
        endY: p2.y,
      });
    }
    return previews;
  }, [proposal]);

  // 3. Helper to commit creation
  const confirmCreation = useCallback(() => {
    if (!proposal || proposal.error) return;

    if (proposal.mode === "multi-points" && proposal.multiPoints) {
      // Batch Create
      for (let i = 0; i < proposal.multiPoints.length - 1; i++) {
        const p1 = proposal.multiPoints[i];
        const p2 = proposal.multiPoints[i + 1];
        const line: Line = {
          id: crypto.randomUUID(),
          type: "line",
          startPoint: p1.id,
          endPoint: p2.id,
          style: { ...DEFAULT_LINE_STYLE },
          lockedBy: [p1.id, p2.id],
        };
        addElement(line);
      }
      clearSelection();
    } else if (
      proposal.mode === "2-points" &&
      proposal.start?.id &&
      proposal.end?.id
    ) {
      // Single Create (Point to Point)
      const line: Line = {
        id: crypto.randomUUID(),
        type: "line",
        startPoint: proposal.start.id,
        endPoint: proposal.end.id,
        style: { ...DEFAULT_LINE_STYLE },
        lockedBy: [proposal.start.id, proposal.end.id],
      };
      addElement(line);
      clearSelection();
    }
    // Note: '1-point-interactive' usually doesn't create unless we clicked a point (which upgrades it to 2-points)
    // or creating a point in empty space? Currently we only support connecting existing points.
  }, [proposal, addElement, clearSelection]);

  // 4. Auto-Create on Activation (Flow X)
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      const staticProposal = getProposedLine(selection.ids, elements);
      if (staticProposal && !staticProposal.error) {
        const staticModes = ["2-points", "multi-points"];
        if (staticModes.includes(staticProposal.mode)) {
          // Trigger creation for valid static proposals
          // We need to re-run creation logic manually or trust `confirmCreation`?
          // `confirmCreation` uses `proposal` state which involves `hoveredPointId`.
          // Static Proposal doesn't use hover.
          // So let's manually call addElement logic here to be safe and immediate.

          // Reuse logic:
          if (
            staticProposal.mode === "multi-points" &&
            staticProposal.multiPoints
          ) {
            staticProposal.multiPoints.forEach((p, i, arr) => {
              if (i < arr.length - 1) {
                addElement({
                  id: crypto.randomUUID(),
                  type: "line",
                  startPoint: p.id,
                  endPoint: arr[i + 1].id,
                  style: { ...DEFAULT_LINE_STYLE },
                  lockedBy: [p.id, arr[i + 1].id],
                });
              }
            });
            clearSelection();
          } else if (
            staticProposal.mode === "2-points" &&
            staticProposal.start?.id &&
            staticProposal.end?.id
          ) {
            addElement({
              id: crypto.randomUUID(),
              type: "line",
              startPoint: staticProposal.start.id,
              endPoint: staticProposal.end.id,
              style: { ...DEFAULT_LINE_STYLE },
              lockedBy: [staticProposal.start.id, staticProposal.end.id],
            });
            clearSelection();
          }
        }
      }
    }
    wasActiveRef.current = isActive;
  }, [isActive, selection.ids, elements, addElement, clearSelection]);

  // 5. Handle Mouse Move - convert to world coordinates
  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      // First get screen coordinates
      const screenX =
        (clientX - rect.left - transform.offsetX) / transform.scale;
      const screenY =
        (clientY - rect.top - transform.offsetY) / transform.scale;
      // Then convert to world coordinates
      return screenToWorld({ x: screenX, y: screenY }, coordinateSystem);
    },
    [svgRef, transform, coordinateSystem],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive) return;

      const coords = clientToWorld(e.clientX, e.clientY);
      setMousePosition(coords);

      // Find nearest point in world coordinates
      // Threshold in world units (~15px worth)
      const worldThreshold =
        15 / (transform.scale * coordinateSystem.pixelsPerUnit);
      const pointsList = elements.filter((e) => e.type === "point") as Point[];
      const nearest = findNearestPoint(coords, pointsList, worldThreshold);
      setHoveredPointId(nearest?.id ?? null);
    },
    [
      isActive,
      clientToWorld,
      elements,
      transform.scale,
      coordinateSystem.pixelsPerUnit,
    ],
  );

  // 6. Handle Click (Flow Y)
  const handleClick = useCallback(
    (e: React.MouseEvent, coords: { x: number; y: number }) => {
      if (!isActive) return false;

      const isShiftHeld = e.shiftKey;

      // Flow Y: If we have a valid proposal that involves interaction (e.g. clicking 2nd point)
      // we confirm creation.
      if (proposal && !proposal.error) {
        // If we are hovering a point and it forms a '2-points' proposal, create it!
        if (
          proposal.mode === "2-points" &&
          hoveredPointId &&
          proposal.start?.id &&
          proposal.end?.id
        ) {
          // Create the line
          const line: Line = {
            id: crypto.randomUUID(),
            type: "line",
            startPoint: proposal.start.id,
            endPoint: proposal.end.id,
            style: { ...DEFAULT_LINE_STYLE },
            lockedBy: [proposal.start.id, proposal.end.id],
          };
          addElement(line);

          // Chain Creation: If Shift is held, select the endpoint for the next segment
          if (isShiftHeld) {
            selectSingle(proposal.end.id);
          } else {
            clearSelection();
          }
          return true;
        }
      }

      // Default Selection Logic (if not creating)
      // If we clicked a point, select it (start of line)
      // If we clicked empty space, clear selection
      const worldThreshold =
        15 / (transform.scale * coordinateSystem.pixelsPerUnit);
      const pointsList = elements.filter(
        (el) => el.type === "point",
      ) as Point[];
      const nearest = findNearestPoint(coords, pointsList, worldThreshold);

      if (nearest) {
        if (!selection.ids.includes(nearest.id)) {
          selectSingle(nearest.id);
        }
        return true;
      } else {
        clearSelection();
        return true;
      }
    },
    [
      isActive,
      elements,
      selection.ids,
      transform.scale,
      addElement,
      selectSingle,
      clearSelection,
      proposal,
      hoveredPointId,
    ],
  );

  return {
    isActive,
    hoveredPointId,
    handleMouseMove,
    handleClick,
    previewLine,
    previewLinesFromSelection,
    confirmCreation,
    selectedPointCount: selection.ids.length, // Simplified
  };
}
