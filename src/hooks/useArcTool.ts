/**
 * useArcTool - Hook for arc creation between intersecting line segments
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import { useTotalScale } from "@/hooks/useTotalScale";
import type { Point, Arc } from "@/geometry/types";
import { DEFAULT_ARC_STYLE, DEFAULT_POINT_STYLE } from "@/geometry/types";
import { getPointByIdMap } from "@/utils/geometry/math";
import {
  getProposedArcs,
  getSelectedLines,
  type ArcProposal,
  type GetArcProposalsResult,
} from "@/utils/geometry/arcSolvers";

export interface UseArcToolOptions {
  svgRef: React.RefObject<SVGSVGElement | null>;
}

export interface ArcToolState {
  proposals: ArcProposal[];
  highlightedQuadrant: 1 | 2 | 3 | 4 | null;
  errorMessage: string | null;
  intersection: { x: number; y: number } | null;
}

/**
 * Hook for arc tool functionality.
 * Handles line selection, intersection detection, arc preview, and creation.
 */
export function useArcTool(_options: UseArcToolOptions) {
  const [highlightedQuadrant, setHighlightedQuadrant] = useState<
    1 | 2 | 3 | 4 | null
  >(null);

  const tool = useEditorStore((s) => s.tool);
  const elements = useEditorStore((s) => s.elements);
  const selection = useEditorStore((s) => s.selection);
  const { totalScale } = useTotalScale();

  const addElement = useEditorStore((s) => s.addElement);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  const isActive = tool === "arc";

  // Calculate scaled arc radius (convert pixels to world units)
  const scaledArcRadius = DEFAULT_ARC_STYLE.radius / totalScale;

  // Get points map for lookups
  const pointsMap = useMemo(() => getPointByIdMap(elements), [elements]);

  // Get selected lines
  const selectedLines = useMemo(
    () => getSelectedLines(selection.ids, elements),
    [selection.ids, elements],
  );

  // Calculate arc proposals when 2 lines are selected
  const proposalsResult: GetArcProposalsResult | null = useMemo(() => {
    if (!isActive || selectedLines.length !== 2) {
      return null;
    }

    return getProposedArcs(
      selectedLines[0],
      selectedLines[1],
      scaledArcRadius,
      pointsMap,
    );
  }, [isActive, selectedLines, scaledArcRadius, pointsMap]);

  const proposals = proposalsResult?.proposals ?? [];
  const errorMessage = proposalsResult?.error ?? null;
  const intersection = proposalsResult?.intersection?.point ?? null;

  // Reset highlight when proposals change
  useEffect(() => {
    setHighlightedQuadrant(null);
  }, [proposalsResult]);

  // Keyboard handling for 1-4 and Enter
  useEffect(() => {
    if (!isActive || proposals.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const num = parseInt(e.key);
      if (num >= 1 && num <= proposals.length) {
        e.preventDefault();
        setHighlightedQuadrant(num as 1 | 2 | 3 | 4);
      }

      if (e.key === "Enter" && highlightedQuadrant) {
        e.preventDefault();
        const proposal = proposals.find(
          (p) => p.quadrant === highlightedQuadrant,
        );
        if (proposal) {
          confirmCreation(proposal);
        }
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setHighlightedQuadrant(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, proposals, highlightedQuadrant]);

  // Create the arc with all required points
  const confirmCreation = useCallback(
    (proposal: ArcProposal) => {
      if (selectedLines.length !== 2) return;

      const line1 = selectedLines[0];
      const line2 = selectedLines[1];

      // Check if intersection point already exists (endpoint case)
      const existingIntersection = proposalsResult?.intersection?.sharedPointId;

      let intersectionPointId: string;

      if (existingIntersection) {
        // Use existing shared point
        intersectionPointId = existingIntersection;
      } else {
        // Create new intersection point
        intersectionPointId = crypto.randomUUID();
        const intersectionPoint: Point = {
          id: intersectionPointId,
          type: "point",
          x: proposal.center.x,
          y: proposal.center.y,
          style: { ...DEFAULT_POINT_STYLE },
          lockedBy: [], // Free point at intersection
        };
        addElement(intersectionPoint);
      }

      // Generate arc ID first so endpoints can reference it
      const arcId = crypto.randomUUID();

      // Create arc start point (on line1 at radius)
      // This point depends on the arc (not the line directly)
      const arcStartPointId = crypto.randomUUID();
      const arcStartPoint: Point = {
        id: arcStartPointId,
        type: "point",
        x: proposal.arcStart.x,
        y: proposal.arcStart.y,
        style: { ...DEFAULT_POINT_STYLE },
        lockedBy: [arcId], // Depends on the arc
      };
      addElement(arcStartPoint);

      // Create arc end point (on line2 at radius)
      // This point depends on the arc (not the line directly)
      const arcEndPointId = crypto.randomUUID();
      const arcEndPoint: Point = {
        id: arcEndPointId,
        type: "point",
        x: proposal.arcEnd.x,
        y: proposal.arcEnd.y,
        style: { ...DEFAULT_POINT_STYLE },
        lockedBy: [arcId], // Depends on the arc
      };
      addElement(arcEndPoint);

      // Determine sweep direction based on the shorter angular path
      const direction: "cw" | "ccw" = proposal.sweepFlag === 0 ? "ccw" : "cw";

      // Create the arc
      const arc: Arc = {
        id: arcId,
        type: "arc",
        line1: line1.id,
        line2: line2.id,
        intersectionPoint: intersectionPointId,
        arcStartPoint: arcStartPointId,
        arcEndPoint: arcEndPointId,
        quadrant: proposal.quadrant,
        direction,
        style: { ...DEFAULT_ARC_STYLE },
        lockedBy: [line1.id, line2.id], // Arc is locked to its parent lines
      };
      addElement(arc);

      // Clear selection and reset state
      clearSelection();
      setHighlightedQuadrant(null);
    },
    [selectedLines, proposalsResult, addElement, clearSelection],
  );

  // Handle click on a preview arc
  const handlePreviewClick = useCallback(
    (quadrant: 1 | 2 | 3 | 4) => {
      const proposal = proposals.find((p) => p.quadrant === quadrant);
      if (proposal) {
        confirmCreation(proposal);
      }
    },
    [proposals, confirmCreation],
  );

  // Handle hover on a preview arc
  const handlePreviewHover = useCallback((quadrant: 1 | 2 | 3 | 4 | null) => {
    setHighlightedQuadrant(quadrant);
  }, []);

  // State for rendering
  const state: ArcToolState = {
    proposals,
    highlightedQuadrant,
    errorMessage,
    intersection,
  };

  return {
    isActive,
    state,
    selectedLinesCount: selectedLines.length,
    handlePreviewClick,
    handlePreviewHover,
    confirmCreation,
  };
}

export type { ArcProposal };
