import { useId } from "react";
import type { Paper } from "@geosimples/core/figure";
import type { View } from "@/lib/camera";
import { onPaper, type PerUnit } from "@/lib/previewView";

/**
 * The preview's guide grid, which is never exported: one line per world unit,
 * or every 5 or 10 units when zoomed far out, and the lines through the origin.
 */
export function PreviewGrid({ ppu, vb, unitsPerPx, paper }: { ppu: PerUnit; vb: View; unitsPerPx: number; paper: Paper }) {
  // Each grid needs its own pattern id: the guide shows many on one page.
  const id = `gs-grid-${useId().replace(/:/g, "")}`;
  const k = Math.min(ppu.x, ppu.y);
  const step = k / unitsPerPx < 8 ? ((k * 5) / unitsPerPx < 8 ? 10 : 5) : 1;
  const sx = ppu.x * step;
  const sy = ppu.y * step;
  return (
    <g pointerEvents="none">
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={sx} height={sy} x={0} y={0}>
          <path d={`M${sx} 0H0V${sy}`} fill="none" stroke={onPaper("#e5e7eb", paper)} strokeWidth={unitsPerPx} />
        </pattern>
      </defs>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={`url(#${id})`} />
      <path
        d={`M${vb.x} 0H${vb.x + vb.w}M0 ${vb.y}V${vb.y + vb.h}`}
        stroke={onPaper("#cbd5e1", paper)}
        strokeWidth={unitsPerPx * 1.2}
      />
    </g>
  );
}
