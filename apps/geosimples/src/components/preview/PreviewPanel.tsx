import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildScene,
  movePoints,
  paddedBox,
  pointMap,
  sceneMarkup,
  type Box,
  type FigureDoc,
  type Hit,
  type Id,
  type Point,
} from "@geosimples/core/figure";
import { useFigureStore } from "@/store/figureStore";
import { ActionBar } from "./ActionBar";
import { ZoomBar } from "./ZoomBar";
import { EmptyState } from "./EmptyState";
import { SelectionSummary } from "./SelectionSummary";

const PRIMARY = "#10b981";
/** View shown for an empty figure: about x ∈ [-1, 6], y ∈ [-1, 4]. */
const EMPTY_WORLD = { minX: -1, minY: -1, maxX: 6, maxY: 4 };

type View = { x: number; y: number; w: number; h: number };

type Gesture =
  | { kind: "none" }
  | { kind: "press"; owner: Id | null; x: number; y: number }
  | { kind: "drag"; owner: Id; ids: Id[]; base: FigureDoc; start: { x: number; y: number }; moved: boolean }
  | { kind: "pan"; x: number; y: number; view: View };

function fitView(box: Box | null, k: number): View {
  const b =
    box ??
    { minX: EMPTY_WORLD.minX * k, minY: -EMPTY_WORLD.maxY * k, maxX: EMPTY_WORLD.maxX * k, maxY: -EMPTY_WORLD.minY * k };
  const size = Math.max(b.maxX - b.minX, b.maxY - b.minY, k);
  const p = paddedBox(b, Math.max(14, size * 0.08));
  return { x: p.minX, y: p.minY, w: p.maxX - p.minX, h: p.maxY - p.minY };
}

export function PreviewPanel() {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const moveMode = useFigureStore((s) => s.moveMode);
  const scale = useFigureStore((s) => s.settings.scale);
  const showGrid = useFigureStore((s) => s.settings.showGrid);

  const scene = useMemo(() => buildScene(doc, { scale }), [doc, scale]);
  const markup = useMemo(() => sceneMarkup(scene), [scene]);
  const k = scene.k;

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  /** null follows the figure; set when the teacher zooms or pans. */
  const [view, setView] = useState<View | null>(null);
  const [frozen, setFrozen] = useState<View | null>(null);
  const gesture = useRef<Gesture>({ kind: "none" });

  const fitted = useMemo(() => fitView(scene.box, k), [scene.box, k]);
  const vb = frozen ?? view ?? fitted;
  const unitsPerPx = Math.max(vb.w / Math.max(size.w, 1), vb.h / Math.max(size.h, 1));
  const vbRef = useRef(vb);
  useEffect(() => {
    vbRef.current = vb;
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A native listener: React's wheel handler is passive and can't stop the page from zooming.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toUser(svg, e.clientX, e.clientY);
      const factor = Math.exp(e.deltaY * 0.0015);
      setView((current) => zoomView(current ?? vbRef.current, factor, p));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    const current = view ?? vb;
    setView(zoomView(current, factor, { x: current.x + current.w / 2, y: current.y + current.h / 2 }));
  };

  const ownerAt = (target: EventTarget | null): Id | null =>
    (target instanceof Element && target.closest("[data-owner]")?.getAttribute("data-owner")) || null;

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const svg = svgRef.current!;
    svg.setPointerCapture(e.pointerId);
    const owner = ownerAt(e.target);
    const store = useFigureStore.getState();
    const isPoint = owner !== null && pointMap(store.doc).has(owner);
    if (moveMode && owner && isPoint) {
      const selectedPoints = store.selection.filter((id) => pointMap(store.doc).has(id));
      const ids = store.selection.includes(owner) ? selectedPoints : [owner];
      store.beginTransient();
      setFrozen(vb);
      gesture.current = { kind: "drag", owner, ids, base: store.doc, start: toUser(svg, e.clientX, e.clientY), moved: false };
      return;
    }
    gesture.current = { kind: "press", owner, x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    const svg = svgRef.current!;
    if (g.kind === "drag") {
      const p = toUser(svg, e.clientX, e.clientY);
      const dx = (p.x - g.start.x) / k;
      const dy = -(p.y - g.start.y) / k;
      if (!g.moved && Math.hypot(dx, dy) * k < 2 * unitsPerPx) return;
      g.moved = true;
      const pts = pointMap(g.base);
      const moves = g.ids
        .map((id) => pts.get(id))
        .filter((pt): pt is Point => pt !== undefined)
        .map((pt) => ({ id: pt.id, x: round2(pt.x + dx), y: round2(pt.y + dy) }));
      useFigureStore.getState().setTransient(movePoints(g.base, moves));
    } else if (g.kind === "press" && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 4) {
      gesture.current = { kind: "pan", x: e.clientX, y: e.clientY, view: view ?? vb };
    } else if (g.kind === "pan") {
      const dx = (e.clientX - g.x) * unitsPerPx;
      const dy = (e.clientY - g.y) * unitsPerPx;
      setView({ ...g.view, x: g.view.x - dx, y: g.view.y - dy });
    }
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = { kind: "none" };
    const store = useFigureStore.getState();
    if (g.kind === "press") {
      if (g.owner) store.toggleSelect(g.owner);
      else store.clearSelection();
    } else if (g.kind === "drag") {
      store.endTransient();
      setFrozen(null);
      if (!g.moved) store.toggleSelect(g.owner);
    }
  };

  const pointOrder = selection.filter((id) => scene.hits.some((h) => h.type === "point" && h.owner === id));

  return (
    <section
      aria-label="Prévia da figura"
      className="relative flex min-h-[55dvh] flex-1 flex-col overflow-hidden rounded-lg border bg-card md:min-h-0"
    >
      <ActionBar />
      <div ref={containerRef} className="relative min-h-0 flex-1">
        <svg
          ref={svgRef}
          className={`absolute inset-0 h-full w-full touch-none select-none bg-white ${moveMode ? "cursor-default" : ""}`}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {showGrid && <Grid k={k} vb={vb} unitsPerPx={unitsPerPx} />}
          <g dangerouslySetInnerHTML={{ __html: markup }} />
          <Overlay
            hits={scene.hits}
            selection={selection}
            pointOrder={pointOrder}
            unitsPerPx={unitsPerPx}
            moveMode={moveMode}
            doc={doc}
          />
        </svg>
        {doc.elements.length === 0 && <EmptyState />}
        <ZoomBar
          onZoomIn={() => zoomBy(1 / 1.25)}
          onZoomOut={() => zoomBy(1.25)}
          onFit={() => setView(null)}
          fitted={view === null}
        />
        <SelectionSummary />
      </div>
    </section>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function toUser(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function zoomView(v: View, factor: number, at: { x: number; y: number }): View {
  const w = Math.min(Math.max(v.w * factor, 5), 1e6);
  const f = w / v.w;
  return { x: at.x - (at.x - v.x) * f, y: at.y - (at.y - v.y) * f, w, h: v.h * f };
}

function Grid({ k, vb, unitsPerPx }: { k: number; vb: View; unitsPerPx: number }) {
  // One line per world unit, or every 5 or 10 units when zoomed far out.
  const step = k / unitsPerPx < 8 ? (k * 5) / unitsPerPx < 8 ? 10 : 5 : 1;
  const s = k * step;
  return (
    <g pointerEvents="none">
      <defs>
        <pattern id="gs-preview-grid" patternUnits="userSpaceOnUse" width={s} height={s} x={0} y={0}>
          <path d={`M${s} 0H0V${s}`} fill="none" stroke="#e5e7eb" strokeWidth={unitsPerPx} />
        </pattern>
      </defs>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#gs-preview-grid)" />
      <path
        d={`M${vb.x} 0H${vb.x + vb.w}M0 ${vb.y}V${vb.y + vb.h}`}
        stroke="#cbd5e1"
        strokeWidth={unitsPerPx * 1.2}
      />
    </g>
  );
}

function Overlay({
  hits,
  selection,
  pointOrder,
  unitsPerPx,
  moveMode,
  doc,
}: {
  hits: Hit[];
  selection: Id[];
  pointOrder: Id[];
  unitsPerPx: number;
  moveMode: boolean;
  doc: FigureDoc;
}) {
  const selected = new Set(selection);
  const hidden = new Set(
    doc.elements.filter((e) => e.type === "point" && e.shape === "none").map((e) => e.id),
  );
  const px = unitsPerPx;
  return (
    <g>
      {hits.map((h) => {
        const isSel = selected.has(h.owner);
        if (h.type === "point") {
          const r = Math.max(h.r, 7 * px);
          return (
            <g key={h.owner} data-owner={h.owner} className={moveMode ? "cursor-move" : "cursor-pointer"}>
              {hidden.has(h.owner) && (
                <circle cx={h.x} cy={h.y} r={3 * px} fill="none" stroke="#94a3b8" strokeWidth={px} strokeDasharray={`${2 * px} ${2 * px}`} />
              )}
              {isSel && (
                <circle cx={h.x} cy={h.y} r={Math.max(h.r + 3 * px, 6 * px)} fill={PRIMARY} fillOpacity={0.25} stroke={PRIMARY} strokeWidth={1.5 * px} />
              )}
              <circle cx={h.x} cy={h.y} r={r} fill="transparent" />
            </g>
          );
        }
        return (
          <g key={h.owner} data-owner={h.owner} className="cursor-pointer">
            {isSel && (
              <path
                d={h.d}
                fill={h.area ? PRIMARY : "none"}
                fillOpacity={0.15}
                stroke={PRIMARY}
                strokeOpacity={0.55}
                strokeWidth={5}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <path
              d={h.d}
              fill={h.area ? "transparent" : "none"}
              stroke="transparent"
              strokeWidth={14}
              vectorEffect="non-scaling-stroke"
              pointerEvents={h.area ? "all" : "stroke"}
            />
          </g>
        );
      })}
      {pointOrder.length >= 2 &&
        pointOrder.map((id, i) => {
          const h = hits.find((x) => x.type === "point" && x.owner === id);
          if (!h || h.type !== "point") return null;
          const cx = h.x + 9 * px;
          const cy = h.y - 9 * px;
          return (
            <g key={`badge-${id}`} pointerEvents="none">
              <circle cx={cx} cy={cy} r={7 * px} fill={PRIMARY} />
              <text x={cx} y={cy + 3.5 * px} fontSize={10 * px} textAnchor="middle" fill="white" fontFamily="Inter, system-ui, sans-serif" fontWeight={600}>
                {i + 1}
              </text>
            </g>
          );
        })}
    </g>
  );
}
