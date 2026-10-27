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
  type ParsedInput,
  type Point,
  type Prim,
} from "@geosimples/core/figure";
import { useFigureStore } from "@/store/figureStore";
import { ActionBar } from "./ActionBar";
import { ZoomBar } from "./ZoomBar";
import { EmptyState } from "./EmptyState";
import { SelectionSummary } from "./SelectionSummary";
import { boxFrom, elementsInBox } from "@/lib/boxSelect";
import { cn } from "@/lib/utils";
import { parseDraft } from "@/lib/inputContext";
import { useCommand } from "@/lib/commands";

const PRIMARY = "#10b981";
/** View shown for an empty figure: about x ∈ [-1, 6], y ∈ [-1, 4]. */
const EMPTY_WORLD = { minX: -1, minY: -1, maxX: 6, maxY: 4 };

type View = { x: number; y: number; w: number; h: number };

type Gesture =
  | { kind: "none" }
  | { kind: "press"; owner: Id | null; x: number; y: number; shift: boolean }
  | { kind: "drag"; owner: Id; ids: Id[]; base: FigureDoc; start: { x: number; y: number }; moved: boolean }
  | { kind: "pan"; x: number; y: number; view: View }
  | { kind: "box"; start: { x: number; y: number }; end: { x: number; y: number }; shift: boolean };

function fitView(box: Box | null, k: number): View {
  const b =
    box ??
    { minX: EMPTY_WORLD.minX * k, minY: -EMPTY_WORLD.maxY * k, maxX: EMPTY_WORLD.maxX * k, maxY: -EMPTY_WORLD.minY * k };
  const size = Math.max(b.maxX - b.minX, b.maxY - b.minY, k);
  const p = paddedBox(b, Math.max(14, size * 0.08));
  return { x: p.minX, y: p.minY, w: p.maxX - p.minX, h: p.maxY - p.minY };
}

/** The view a reload starts from when auto-fit is off: the figure as it was saved. */
function initialView(): View | null {
  const { doc, settings } = useFigureStore.getState();
  if (settings.autoFit) return null;
  const scene = buildScene(doc, { scale: settings.scale });
  return fitView(scene.box, scene.k);
}

export function PreviewPanel() {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const mode = useFigureStore((s) => s.mode);
  const scale = useFigureStore((s) => s.settings.scale);
  const showGrid = useFigureStore((s) => s.settings.showGrid);
  const autoFit = useFigureStore((s) => s.settings.autoFit);
  const setSetting = useFigureStore((s) => s.setSetting);

  const scene = useMemo(() => buildScene(doc, { scale }), [doc, scale]);
  const markup = useMemo(() => sceneMarkup(scene), [scene]);
  const actionPreview = useFigureStore((s) => s.actionPreview);
  const actionMarkup = useMemo(() => {
    if (!actionPreview || actionPreview.ids.length === 0) return null;
    const result = buildScene(actionPreview.doc, { scale });
    const ids = new Set(actionPreview.ids);
    return sceneMarkup({ ...result, prims: result.prims.filter((p) => ids.has(p.owner)).map(tint) });
  }, [actionPreview, scale]);
  const k = scene.k;

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  /** The camera when auto-fit is off. */
  const [view, setView] = useState<View | null>(initialView);
  /** Holds the camera still while a point is dragged. */
  const [frozen, setFrozen] = useState<View | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const gesture = useRef<Gesture>({ kind: "none" });

  const draft = useFigureStore((s) => s.inputDraft);
  const ghost = useMemo(() => {
    if (draft.trim() === "") return null;
    const parsed = parseDraft(draft, doc, selection);
    // Parts typed correctly show even while a later part is unfinished.
    return parsed.nodes.length > 0 ? parsed : null;
  }, [draft, doc, selection]);

  const fitted = useMemo(() => fitView(unionBox(scene.box, ghost && ghostBox(ghost, k)), k), [scene.box, ghost, k]);
  const vb = frozen ?? (autoFit ? fitted : (view ?? fitted));
  const unitsPerPx = Math.max(vb.w / Math.max(size.w, 1), vb.h / Math.max(size.h, 1));
  const vbRef = useRef(vb);
  useEffect(() => {
    vbRef.current = vb;
  });

  /** Moves the camera by hand, which turns auto-fit off. */
  const placeCamera = (next: View) => {
    setView(next);
    if (useFigureStore.getState().settings.autoFit) setSetting("autoFit", false);
  };

  const toggleAutoFit = () => {
    if (autoFit) placeCamera(vb);
    else setSetting("autoFit", true);
  };

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
      setView(zoomView(vbRef.current, factor, p));
      const store = useFigureStore.getState();
      if (store.settings.autoFit) store.setSetting("autoFit", false);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    placeCamera(zoomView(vb, factor, { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 }));
  };
  useCommand("zoomIn", () => zoomBy(1 / 1.25));
  useCommand("zoomOut", () => zoomBy(1.25));
  useCommand("toggleAutoFit", toggleAutoFit);

  const ownerAt = (target: EventTarget | null): Id | null =>
    (target instanceof Element && target.closest("[data-owner]")?.getAttribute("data-owner")) || null;

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current!;
    // The middle button always moves the view, whatever the mode.
    if (e.button === 1) {
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      gesture.current = { kind: "pan", x: e.clientX, y: e.clientY, view: vb };
      return;
    }
    if (e.button !== 0) return;
    svg.setPointerCapture(e.pointerId);
    const owner = ownerAt(e.target);
    const store = useFigureStore.getState();
    const pts = pointMap(store.doc);
    if (mode === "move" && owner && pts.has(owner)) {
      const selectedPoints = store.selection.filter((id) => pts.has(id));
      const ids = store.selection.includes(owner) ? selectedPoints : [owner];
      store.beginTransient();
      setFrozen(vb);
      gesture.current = { kind: "drag", owner, ids, base: store.doc, start: toUser(svg, e.clientX, e.clientY), moved: false };
      return;
    }
    gesture.current = { kind: "press", owner, x: e.clientX, y: e.clientY, shift: e.shiftKey };
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
      if (mode === "pan") {
        gesture.current = { kind: "pan", x: g.x, y: g.y, view: vb };
      } else {
        const start = toUser(svg, g.x, g.y);
        const end = toUser(svg, e.clientX, e.clientY);
        gesture.current = { kind: "box", start, end, shift: g.shift };
        setBox(boxFrom(start, end));
      }
    } else if (g.kind === "pan") {
      const dx = (e.clientX - g.x) * unitsPerPx;
      const dy = (e.clientY - g.y) * unitsPerPx;
      placeCamera({ ...g.view, x: g.view.x - dx, y: g.view.y - dy });
    } else if (g.kind === "box") {
      g.end = toUser(svg, e.clientX, e.clientY);
      setBox(boxFrom(g.start, g.end));
    }
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = { kind: "none" };
    const store = useFigureStore.getState();
    if (g.kind === "press") {
      if (g.owner) store.toggleSelect(g.owner);
      else if (!g.shift) store.clearSelection();
    } else if (g.kind === "drag") {
      store.endTransient();
      setFrozen(null);
      if (!g.moved) store.toggleSelect(g.owner);
    } else if (g.kind === "box") {
      setBox(null);
      const found = elementsInBox(store.doc, k, boxFrom(g.start, g.end));
      if (g.shift) {
        const kept = new Set(store.selection);
        store.select([...store.selection, ...found.filter((id) => !kept.has(id))]);
      } else {
        store.select(found);
      }
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
          className={cn(
            "absolute inset-0 h-full w-full touch-none select-none bg-white",
            mode === "pan" && "cursor-grab active:cursor-grabbing",
            mode === "select" && "cursor-crosshair",
          )}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          // Stops the browser's autoscroll from starting on a middle click.
          onMouseDown={(e) => e.button === 1 && e.preventDefault()}
          onAuxClick={(e) => e.preventDefault()}
        >
          {showGrid && <Grid k={k} vb={vb} unitsPerPx={unitsPerPx} />}
          <g dangerouslySetInnerHTML={{ __html: markup }} />
          {actionMarkup && <g pointerEvents="none" dangerouslySetInnerHTML={{ __html: actionMarkup }} />}
          <Overlay
            hits={scene.hits}
            selection={selection}
            pointOrder={pointOrder}
            unitsPerPx={unitsPerPx}
            moveMode={mode === "move"}
            doc={doc}
          />
          {ghost && <DraftGhost parsed={ghost} k={k} px={unitsPerPx} />}
          {box && (
            <rect
              x={box.minX}
              y={box.minY}
              width={box.maxX - box.minX}
              height={box.maxY - box.minY}
              fill={PRIMARY}
              fillOpacity={0.08}
              stroke={PRIMARY}
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
        </svg>
        {doc.elements.length === 0 && draft.trim() === "" && <EmptyState />}
        <ZoomBar
          onZoomIn={() => zoomBy(1 / 1.25)}
          onZoomOut={() => zoomBy(1.25)}
          autoFit={autoFit}
          onToggleAutoFit={toggleAutoFit}
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

function ghostBox(parsed: ParsedInput, k: number): Box | null {
  if (parsed.nodes.length === 0) return null;
  const xs = parsed.nodes.map((n) => n.x * k);
  const ys = parsed.nodes.map((n) => -n.y * k);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function unionBox(a: Box | null, b: Box | null): Box | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** Dashed preview of what the point input would add. */
function DraftGhost({ parsed, k, px }: { parsed: ParsedInput; k: number; px: number }) {
  const at = (i: number) => ({ x: parsed.nodes[i].x * k, y: -parsed.nodes[i].y * k });
  return (
    <g pointerEvents="none">
      {parsed.segments.map(([p, q], i) => {
        const a = at(p);
        const b = at(q);
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={PRIMARY}
            strokeWidth={2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {parsed.nodes.map((n, i) => {
        if (n.kind !== "new") return null;
        const c = at(i);
        return (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={4 * px} fill="white" stroke={PRIMARY} strokeWidth={1.5 * px} />
            {n.label && (
              <text x={c.x + 7 * px} y={c.y - 7 * px} fontSize={12 * px} fill={PRIMARY} fontFamily="Inter, system-ui, sans-serif">
                {n.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Draws what an action would add in the accent color, so it reads as a preview. */
function tint(p: Prim): Prim {
  if (p.kind === "text") return { ...p, color: PRIMARY };
  return {
    ...p,
    stroke: p.stroke && { ...p.stroke, color: PRIMARY, opacity: Math.max(p.stroke.opacity, 0.8) },
    fill: p.fill && { ...p.fill, color: PRIMARY, opacity: Math.min(Math.max(p.fill.opacity, 0.2), 0.45) },
  };
}
