import { useEffect, useMemo, useRef, useState } from "react";
import { buildScene, paintScene, paperColor, sceneMarkup, type FigureDoc } from "@geosimples/core/figure";
import { usePreviewPaper } from "@/lib/theme";
import { fitView } from "@/lib/previewView";
import { cn } from "@/lib/utils";
import { PreviewGrid } from "./PreviewGrid";

/**
 * A figure drawn as the preview draws it, without any of its controls: on the
 * theme's paper, over the grid when `grid` is on, fitted the same way and
 * widened or heightened to the box's shape so the grid reaches every edge.
 * The box sets the size (`className`); nothing in it can be clicked.
 */
export function FigureSnapshot({
  doc,
  scale = 1,
  grid = true,
  label,
  className,
  empty,
}: {
  doc: FigureDoc;
  scale?: number;
  grid?: boolean;
  label: string;
  className?: string;
  /** Shown over the paper when the figure has nothing in it. */
  empty?: string;
}) {
  const paper = usePreviewPaper();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 480, h: 320 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: Math.max(1, entry.contentRect.width), h: Math.max(1, entry.contentRect.height) }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const scene = useMemo(() => buildScene(doc, { scale }), [doc, scale]);
  const markup = useMemo(() => sceneMarkup(paintScene(scene, paper)), [scene, paper]);
  const fit = fitView(scene.box, scene.k);
  const aspect = size.w / size.h;
  const w = Math.max(fit.w, fit.h * aspect);
  const h = w / aspect;
  const vb = { x: fit.x - (w - fit.w) / 2, y: fit.y - (h - fit.h) / 2, w, h };
  const blank = doc.elements.length === 0;
  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <svg
        className="pointer-events-none absolute inset-0 block h-full w-full select-none"
        // The paper's color comes from core, which also colors the figure on it.
        style={{ backgroundColor: paperColor(paper) }}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        role="img"
        aria-label={label}
      >
        {grid && <PreviewGrid ppu={{ x: scene.kx, y: scene.ky }} vb={vb} unitsPerPx={vb.w / size.w} paper={paper} />}
        <g dangerouslySetInnerHTML={{ __html: markup }} />
      </svg>
      {blank && empty && (
        <p className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
