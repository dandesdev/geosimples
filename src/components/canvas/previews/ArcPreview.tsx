/**
 * ArcPreview - Renders preview arcs during arc tool creation
 */

import { useMemo } from "react";
import { useTotalScale } from "@/hooks/useTotalScale";
import { generateArcPath, type ArcProposal } from "@/utils/geometry/arcSolvers";
import { MINIMUM_SELECTION_WIDTH } from "@/geometry/constants";

interface ArcPreviewProps {
  proposals: ArcProposal[];
  highlightedQuadrant: 1 | 2 | 3 | 4 | null;
  onPreviewClick: (quadrant: 1 | 2 | 3 | 4) => void;
  onPreviewHover: (quadrant: 1 | 2 | 3 | 4 | null) => void;
}

export function ArcPreview({
  proposals,
  highlightedQuadrant,
  onPreviewClick,
  onPreviewHover,
}: ArcPreviewProps) {
  const { totalScale } = useTotalScale();

  const paths = useMemo(
    () => proposals.map((p) => ({ ...p, path: generateArcPath(p) })),
    [proposals],
  );

  if (paths.length === 0) return null;

  // Hitbox width (20px scaled to world units)
  const hitboxWidth = Math.max(MINIMUM_SELECTION_WIDTH, 20) / totalScale;
  // Font size (12px scaled to world units)
  const fontSize = 12 / totalScale;

  return (
    <g className="arc-previews" style={{ pointerEvents: "auto" }}>
      {paths.map((proposal) => {
        const isHighlighted = highlightedQuadrant === proposal.quadrant;

        return (
          <g key={proposal.quadrant}>
            {/* Hitbox - larger transparent stroke for easier clicking */}
            <path
              d={proposal.path}
              fill="none"
              stroke="transparent"
              strokeWidth={hitboxWidth}
              onClick={(e) => {
                e.stopPropagation();
                onPreviewClick(proposal.quadrant);
              }}
              onMouseEnter={() => onPreviewHover(proposal.quadrant)}
              onMouseLeave={() => onPreviewHover(null)}
              className="cursor-pointer"
            />

            {/* Visual preview arc with non-scaling stroke */}
            <path
              d={proposal.path}
              fill="none"
              stroke={isHighlighted ? "var(--primary)" : "var(--primary)"}
              strokeWidth={isHighlighted ? 2.5 : 1.5}
              strokeDasharray={isHighlighted ? "none" : "4 4"}
              vectorEffect="non-scaling-stroke"
              opacity={isHighlighted ? 1 : 0.5}
              style={{ pointerEvents: "none" }}
            />

            {/* Quadrant number label - flipped for world coordinates */}
            <text
              x={proposal.labelPosition.x}
              y={proposal.labelPosition.y}
              fontSize={fontSize}
              fill={isHighlighted ? "var(--primary)" : "var(--foreground)"}
              textAnchor="middle"
              dominantBaseline="middle"
              opacity={isHighlighted ? 1 : 0.7}
              style={{ pointerEvents: "none", fontFamily: "var(--font-sans)" }}
              transform={`translate(${proposal.labelPosition.x}, ${proposal.labelPosition.y}) scale(1, -1) translate(${-proposal.labelPosition.x}, ${-proposal.labelPosition.y})`}
            >
              {proposal.quadrant}
            </text>
          </g>
        );
      })}
    </g>
  );
}
