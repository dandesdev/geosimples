import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import {
  DEFAULT_CIRCLE_STYLE,
  DEFAULT_POINT_STYLE,
  findNearestPoint,
  findNearestLine,
  findNearestCircle,
  getPointByIdMap,
  getProposedCircle,
  type Circle,
  type CircleProposal,
  type GeometryElement,
  type Line,
  type Point,
} from "@geosimples/core/geo";
import { screenToWorld } from "@/utils/geometry/coordinate";

export interface UseCircleToolOptions {
  svgRef: React.RefObject<SVGSVGElement | null>;
}

export interface CirclePreview extends CircleProposal {
  centerX: number;
  centerY: number;
  radius: number;
}

/**
 * Hook for circle tool functionality.
 * Handles center point selection, hover preview, and circle creation.
 */
export function useCircleTool({ svgRef }: UseCircleToolOptions) {
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [hoveredElement, setHoveredElement] = useState<GeometryElement | null>(
    null,
  );
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
  const isHoveringCircleTool = useEditorStore((s) => s.isHoveringCircleTool);

  const addElement = useEditorStore((s) => s.addElement);
  const selectSingle = useEditorStore((s) => s.selectSingle);
  const selectToggle = useEditorStore((s) => s.selectToggle);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  const isActive = tool === "circle";
  const shouldShowPreview = isActive || isHoveringCircleTool;

  // 1. Calculate Proposal
  const proposal = useMemo(() => {
    if (!shouldShowPreview) return null;

    return getProposedCircle(selection.ids, elements, {
      hoveredPointId: isActive ? hoveredPointId : null,
      hoveredElement: isActive ? hoveredElement : null,
      mousePosition: isActive ? mousePosition : null,
    });
  }, [
    selection.ids,
    elements,
    hoveredPointId,
    hoveredElement,
    mousePosition,
    isActive,
    shouldShowPreview,
  ]);

  // 2. Map Proposal to Preview Interface
  const previewCircle: CirclePreview | null = useMemo(() => {
    if (!proposal) return null;
    return {
      ...proposal,
      centerX: proposal.center.x,
      centerY: proposal.center.y,
      radius: proposal.radius,
    };
  }, [proposal]);

  // 3. Helper to commit creation
  const confirmCreation = useCallback(() => {
    if (!proposal || proposal.error) return;

    // Create Center Point
    const centerId = crypto.randomUUID();
    const centerPoint: Point = {
      id: centerId,
      type: "point",
      x: proposal.center.x,
      y: proposal.center.y,
      style: { ...DEFAULT_POINT_STYLE },
      lockedBy: [], // Free point
    };

    // Determine lockedBy based on construction mode
    const getLockedByForProposal = (): string[] => {
      switch (proposal.mode) {
        case "center-radius": {
          // Locked to center point and radius point (if it exists)
          const deps: string[] = [centerId];
          if (proposal.radiusPointId) {
            deps.push(proposal.radiusPointId);
          }
          return deps;
        }
        case "3-points":
          // Locked to all 3 points
          return selection.ids.filter((id) =>
            elements.some((el) => el.id === id && el.type === "point"),
          );
        case "3-lines":
          // Locked to all 3 lines
          return selection.ids.filter((id) =>
            elements.some((el) => el.id === id && el.type === "line"),
          );
        case "3-circles":
          // Locked to all 3 circles
          return selection.ids.filter((id) =>
            elements.some((el) => el.id === id && el.type === "circle"),
          );
        case "point-line":
        case "point-circle":
          // Locked to the point and the line/circle
          return selection.ids;
        default:
          return [centerId];
      }
    };

    // Create Circle
    const circle: Circle = {
      id: crypto.randomUUID(),
      type: "circle",
      centerPoint: centerId,
      radiusPoint: proposal.radiusPointId, // Track radius point for dependency system
      radius: proposal.radius,
      style: { ...DEFAULT_CIRCLE_STYLE },
      lockedBy: getLockedByForProposal(),
    };

    // Optimization: Reuse existing centers if exact match
    if (
      proposal.mode === "center-radius" ||
      proposal.mode === "point-line" ||
      proposal.mode === "point-circle"
    ) {
      const existingCenter = elements.find(
        (el) =>
          el.type === "point" &&
          Math.abs(el.x - proposal.center.x) < 0.001 &&
          Math.abs(el.y - proposal.center.y) < 0.001,
      );

      if (existingCenter) {
        circle.centerPoint = existingCenter.id;
        // Update lockedBy to include existing center instead of new one
        if (proposal.mode === "center-radius") {
          circle.lockedBy = [existingCenter.id];
        }
        addElement(circle);
      } else {
        addElement(centerPoint);
        addElement(circle);
      }
    } else {
      addElement(centerPoint);
      addElement(circle);
    }

    clearSelection();
  }, [proposal, addElement, clearSelection, elements, selection.ids]);

  // 4. Auto-Create on Activation (Flow X)
  useEffect(() => {
    // Logic: If user selects elements THEN activates tool, and those elements match a solution, create it.
    if (isActive && !wasActiveRef.current) {
      // We use the *static* version of getProposedCircle here (no hover state)
      // Check if `getProposedCircle(selectionIds, elements)` returns a valid result.
      const staticProposal = getProposedCircle(selection.ids, elements);

      if (staticProposal && !staticProposal.error) {
        const staticModes = [
          "3-points",
          "3-lines",
          "point-line",
          "point-circle",
          "3-circles",
        ];
        if (staticModes.includes(staticProposal.mode)) {
          // We execute confirmCreation logic but we need to do it with the *staticProposal*
          // Since `confirmCreation` uses `proposal` from state (which might be null initially or same),
          // and state updates are async, we duplicate the minimal creation logic here for immediate execution
          // OR we rely on `proposal` updating fast enough? No, `useEffect` runs after render.
          // `proposal` should already be calculated for the initial render of active state?
          // Yes, assuming `isActive` switched to true, `proposal` would be re-calculated.

          // However, to be safe and cleaner, let's just trigger `confirmCreation` if `proposal` matches
          if (proposal && !proposal.error) {
            confirmCreation();
          }
        }
      }
    }
    wasActiveRef.current = isActive;
  }, [isActive, proposal, confirmCreation, selection.ids, elements]);

  // Handle Mouse Move (Enhanced for Flow Y) - convert to world coordinates
  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const screenX =
        (clientX - rect.left - transform.offsetX) / transform.scale;
      const screenY =
        (clientY - rect.top - transform.offsetY) / transform.scale;
      return screenToWorld({ x: screenX, y: screenY }, coordinateSystem);
    },
    [svgRef, transform, coordinateSystem],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive) return;

      const coords = clientToWorld(e.clientX, e.clientY);
      setMousePosition(coords);

      // Threshold in world units (~15px worth)
      const worldThreshold =
        15 / (transform.scale * coordinateSystem.pixelsPerUnit);
      const pointsList = elements.filter((e) => e.type === "point") as Point[];

      // 1. Find Nearest Point
      const nearestPoint = findNearestPoint(coords, pointsList, worldThreshold);
      setHoveredPointId(nearestPoint?.id ?? null);

      // 2. Find Nearest Other Element (Line/Circle) - Only if not hovering a point?
      // Priority: Point > Line/Circle
      if (!nearestPoint) {
        const pointsMap = getPointByIdMap(elements);
        const lines = elements.filter((e) => e.type === "line") as Line[];
        const circles = elements.filter((e) => e.type === "circle") as Circle[];

        const nearestLine = findNearestLine(
          coords,
          lines,
          pointsMap,
          worldThreshold,
        );
        const nearestCircle = findNearestCircle(
          coords,
          circles,
          pointsMap,
          worldThreshold,
        );

        // Priority: Line or Circle? Smallest distance.
        // For now, simplify: Point > Line > Circle
        if (nearestLine) {
          setHoveredElement(nearestLine);
        } else if (nearestCircle) {
          setHoveredElement(nearestCircle);
        } else {
          setHoveredElement(null);
        }
      } else {
        setHoveredElement(null);
      }
    },
    [
      isActive,
      clientToWorld,
      elements,
      transform.scale,
      coordinateSystem.pixelsPerUnit,
    ],
  );

  // Handle Click (Flow Y Confirmation)
  const handleClick = useCallback(
    (e: React.MouseEvent, coords: { x: number; y: number }) => {
      if (!isActive) return false;

      // Flow Y: If we have a valid proposal involving the hovered element/point,
      // and we Click it, we should CONFIRM creation.

      if (proposal && !proposal.error) {
        // Check if we are interacting with the candidate
        const isInteracting = hoveredPointId || hoveredElement;

        // Special case: Mode B (Center+Radius).
        // If we have 1 point selected, proposal is valid 'center-radius'.
        // If we click EMPTY SPACE, we are completing the radius?
        // Proposal uses mousePosition.
        // So any click should confirm?
        // BUT, we want to allow selecting points too.
        // Flow Y says: "He then selects it [the third circle], and the creation is confirmed."
        // This implies the click MUST target an element.

        if (isInteracting) {
          confirmCreation();
          return true; // Stop propagation
        }

        // What if it's Mode A/B where empty space click is valid?
        // Mode A ('2-points-interactive') currently requires 3rd Point.
        // Mode B ('center-radius') checks `hoveredPointId`.
        // If proposal is 'center-radius' and we click space...
        // Original logic allowed clicking space to set radius.
        // Flow Y focus is on "Selecting Elements".
        // "The user then proceeds to try to click on another element... if found... confirmed."
        // It doesn't explicitly ban free-form.
        // I will allow free-form click for 'center-radius' if proposal is valid and NO element hovered.
        if (proposal.mode === "center-radius" && !hoveredPointId) {
          // Confirm creation with current mouse pos
          confirmCreation();
          return true;
        }
        if (proposal.mode === "2-points-interactive" && !hoveredPointId) {
          // Mode A free-form?
          confirmCreation();
          return true;
        }
      }

      // Standard Selection Logic (Fallback)
      const worldThreshold =
        15 / (transform.scale * coordinateSystem.pixelsPerUnit);
      const points = elements.filter((el): el is Point => el.type === "point");
      const nearest = findNearestPoint(coords, points, worldThreshold);

      if (nearest) {
        if (e.shiftKey) {
          selectToggle(nearest.id);
          return true;
        }
        selectSingle(nearest.id);
        return true;
      }

      // Generic Element Selection (Lines/Circles)
      // GeometryCanvas usually handles this via `renderElement` -> `onSelect`.
      // But for Flow Y, we need `useEffect` on `selection` changes to catch this
      // because `handleClick` here might not fire if `LineElement` stops propagation.

      if (!e.shiftKey) clearSelection();

      return false;
    },
    [
      isActive,
      elements,
      selection.ids,
      transform.scale,
      addElement,
      selectSingle,
      selectToggle,
      clearSelection,
      proposal,
      confirmCreation,
      hoveredPointId,
      hoveredElement,
      coordinateSystem.pixelsPerUnit,
    ],
  );

  // 5. Auto-Create on Selection Change (Flow Y - Final Step)
  useEffect(() => {
    if (!isActive) return;
    // Check static validity on selection change
    const staticProposal = getProposedCircle(selection.ids, elements);
    if (staticProposal && !staticProposal.error) {
      const staticModes = [
        "3-points",
        "3-lines",
        "point-line",
        "point-circle",
        "3-circles",
      ];
      if (staticModes.includes(staticProposal.mode)) {
        confirmCreation();
      }
    }
  }, [selection.ids, isActive, elements]);

  return {
    handleMouseMove,
    handleClick,
    previewCircle,
    hoveredPointId,
    confirmCreation,
  };
}
