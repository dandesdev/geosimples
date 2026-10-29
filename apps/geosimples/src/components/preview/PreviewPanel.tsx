import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildScene,
  formatNumber,
  movePoints,
  paddedBox,
  pointMap,
  sceneMarkup,
  type Box,
  type FigureDoc,
  type Hit,
  type Id,
  type ParsedInput,
  type Prim,
  type Vec,
} from "@geosimples/core/figure";
import { actions } from "@/lib/actions";
import { useFigureStore } from "@/store/figureStore";
import { useActivePrefs } from "@/store/useActivePrefs";
import { ActionBar } from "./ActionBar";
import { ZoomBar } from "./ZoomBar";
import { EmptyState } from "./EmptyState";
import { SelectionSummary } from "./SelectionSummary";
import { PreviewMenu } from "./PreviewMenu";
import { boxFrom, elementsInBox } from "@/lib/boxSelect";
import { cn } from "@/lib/utils";
import { parseDraft } from "@/lib/inputContext";
import { useCommand } from "@/lib/commands";
import { pinchOf, pinchView, zoomView, type Pinch, type View } from "@/lib/camera";
import { useCoarsePointer, useRoomyPreview } from "@/lib/useMediaQuery";

const PRIMARY = "#10b981";
/** View shown for an empty figure: about x ∈ [-1, 6], y ∈ [-1, 4]. */
const EMPTY_WORLD = { minX: -1, minY: -1, maxX: 6, maxY: 4 };

/** Hit target sizes in screen px: a finger needs more room than a mouse. */
const HIT_FINE = { point: 7, stroke: 14 };
const HIT_COARSE = { point: 16, stroke: 28 };

type Gesture =
  | { kind: "none" }
  /**
   * `slop` is how far (px) the pointer may wander before a press becomes a drag.
   * `additive`: the click adds to the selection (Shift, Ctrl or Seleção múltipla);
   * `keys`: Shift, Ctrl or Cmd was held, so a click on nothing keeps the selection.
   */
  | { kind: "press"; owner: Id | null; x: number; y: number; additive: boolean; keys: boolean; slop: number }
  | {
      kind: "drag";
      owner: Id;
      ids: Id[];
      base: FigureDoc;
      start: { x: number; y: number };
      moved: boolean;
      slop: number;
      additive: boolean;
    }
  | { kind: "pan"; x: number; y: number; view: View }
  | { kind: "box"; start: { x: number; y: number }; end: { x: number; y: number }; additive: boolean }
  /** Two fingers: pinch to zoom and drag to pan, in any mode. */
  | { kind: "pinch"; ids: [number, number]; from: Pinch; at: { x: number; y: number }; view: View; unitsPerPx: number }
  /** A finger left a pinch: the rest are ignored until all are up, so nothing gets selected by accident. */
  | { kind: "spent" };

/** Elements that "Mover pontos" drags: points and free texts. */
function movables(doc: FigureDoc): Map<Id, { id: Id; x: number; y: number }> {
  const map = new Map<Id, { id: Id; x: number; y: number }>();
  for (const el of doc.elements) if (el.type === "point" || el.type === "text") map.set(el.id, el);
  return map;
}

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

/**
 * The figure, its view controls and the hint line. `pro` is the pro layout:
 * edge to edge, with the tools in the side column instead of a bar on top.
 */
export function PreviewPanel({ pro = false }: { pro?: boolean }) {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const mode = useFigureStore((s) => s.mode);
  const scale = useFigureStore((s) => s.settings.scale);
  const showGrid = useFigureStore((s) => s.settings.showGrid);
  const autoFit = useFigureStore((s) => s.settings.autoFit);
  const setSetting = useFigureStore((s) => s.setSetting);
  const quickFigure = useFigureStore((s) => s.quickFigure);
  const snap = useActivePrefs().behavior.snapToGrid;
  /** Modes where a click puts a point down. */
  const placing = mode === "add" || mode === "figure";

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
  /** Where a click would put a point in add mode, under the mouse. */
  const [addAt, setAddAt] = useState<Vec | null>(null);
  /** Where the preview was right-clicked, for the menu's "Adicionar ponto aqui". */
  const [menuAt, setMenuAt] = useState<Vec | null>(null);
  const gesture = useRef<Gesture>({ kind: "none" });
  /** Pointers down on the preview, by id, at their last client position. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const coarse = useCoarsePointer();

  const draft = useFigureStore((s) => s.inputDraft);
  const ghost = useMemo(() => {
    if (draft.trim() === "") return null;
    const parsed = parseDraft(draft, doc, selection);
    // Parts typed correctly show even while a later part is unfinished.
    return parsed.nodes.length > 0 || parsed.texts.length > 0 ? parsed : null;
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

  /** The grid crossing near `at` (world units), when snapping is on and one is in reach. */
  const crossingNear = (at: Vec): Vec | null => {
    if (!snap) return null;
    const reach = ((coarse ? 14 : 8) * unitsPerPx) / k;
    const g = { x: Math.round(at.x) || 0, y: Math.round(at.y) || 0 };
    return Math.hypot(at.x - g.x, at.y - g.y) <= reach ? g : null;
  };

  /** The world position for a new point under the pointer: a grid crossing in reach, or rounded to tenths. */
  const pointAt = (clientX: number, clientY: number): Vec => {
    const p = toUser(svgRef.current!, clientX, clientY);
    const at = { x: p.x / k, y: -p.y / k };
    return crossingNear(at) ?? { x: Math.round(at.x * 10) / 10 || 0, y: Math.round(at.y * 10) / 10 || 0 };
  };

  const ownerAt = (target: EventTarget | null): Id | null =>
    (target instanceof Element && target.closest("[data-owner]")?.getAttribute("data-owner")) || null;

  /** A right click: an object under the pointer becomes the selection, unless it is already part of it. */
  const onContextMenu = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    const onFigure = !!svg && e.target instanceof Node && svg.contains(e.target);
    const owner = onFigure ? ownerAt(e.target) : null;
    setMenuAt(onFigure && !owner ? pointAt(e.clientX, e.clientY) : null);
    const store = useFigureStore.getState();
    if (owner && !store.selection.includes(owner)) store.pick(owner, false);
  };

  /** Drops the gesture in progress without selecting or moving anything. */
  const abortGesture = () => {
    const g = gesture.current;
    gesture.current = { kind: "none" };
    if (g.kind === "box") setBox(null);
    else if (g.kind === "drag") {
      const store = useFigureStore.getState();
      if (g.moved) store.setTransient(g.base);
      // The doc is the base again, so this adds no undo step.
      store.endTransient();
      setFrozen(null);
    }
  };

  const startPinch = (svg: SVGSVGElement) => {
    abortGesture();
    const [[idA, a], [idB, b]] = [...pointers.current];
    const from = pinchOf(a, b);
    gesture.current = { kind: "pinch", ids: [idA, idB], from, at: toUser(svg, from.x, from.y), view: vb, unitsPerPx };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current!;
    if (e.button !== 0 && e.button !== 1) return;
    // A primary pointer starts a fresh touch sequence: anything still tracked lost its pointerup.
    if (e.isPrimary && pointers.current.size > 0) {
      pointers.current.clear();
      abortGesture();
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    capture(svg, e.pointerId);
    // A second finger turns whatever the first one started into a pinch; more fingers are ignored.
    if (pointers.current.size === 2) {
      startPinch(svg);
      return;
    }
    if (pointers.current.size > 2 || gesture.current.kind === "spent") return;
    // The middle button always moves the view, whatever the mode.
    if (e.button === 1) {
      e.preventDefault();
      gesture.current = { kind: "pan", x: e.clientX, y: e.clientY, view: vb };
      return;
    }
    const slop = e.pointerType === "touch" ? 10 : 4;
    const owner = ownerAt(e.target);
    const store = useFigureStore.getState();
    const keys = e.shiftKey || e.ctrlKey || e.metaKey;
    const additive = keys || store.multiSelect;
    const movable = movables(store.doc);
    if (mode === "move" && owner && movable.has(owner)) {
      const selectedMovable = store.selection.filter((id) => movable.has(id));
      const ids = store.selection.includes(owner) ? selectedMovable : [owner];
      store.beginTransient();
      setFrozen(vb);
      gesture.current = {
        kind: "drag",
        owner,
        ids,
        base: store.doc,
        start: toUser(svg, e.clientX, e.clientY),
        moved: false,
        slop: slop / 2,
        additive,
      };
      return;
    }
    gesture.current = { kind: "press", owner, x: e.clientX, y: e.clientY, additive, keys, slop };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const tracked = pointers.current.get(e.pointerId);
    if (tracked) {
      tracked.x = e.clientX;
      tracked.y = e.clientY;
    }
    const g = gesture.current;
    const svg = svgRef.current!;
    if (placing && e.pointerType === "mouse") setAddAt(g.kind === "none" ? pointAt(e.clientX, e.clientY) : null);
    if (g.kind === "pinch") {
      const a = pointers.current.get(g.ids[0]);
      const b = pointers.current.get(g.ids[1]);
      if (tracked && a && b) placeCamera(pinchView(g.view, g.unitsPerPx, g.at, g.from, pinchOf(a, b)));
    } else if (g.kind === "drag") {
      const p = toUser(svg, e.clientX, e.clientY);
      let dx = (p.x - g.start.x) / k;
      let dy = -(p.y - g.start.y) / k;
      if (!g.moved && Math.hypot(dx, dy) * k < g.slop * unitsPerPx) return;
      g.moved = true;
      const movable = movables(g.base);
      // The point under the pointer lands on a crossing in reach; the others keep their offsets.
      const held = pointMap(g.base).get(g.owner);
      const crossing = held && crossingNear({ x: held.x + dx, y: held.y + dy });
      if (held && crossing) {
        dx = crossing.x - held.x;
        dy = crossing.y - held.y;
      }
      const moves = g.ids
        .map((id) => movable.get(id))
        .filter((m) => m !== undefined)
        .map((m) => ({ id: m.id, x: round2(m.x + dx), y: round2(m.y + dy) }));
      useFigureStore.getState().setTransient(movePoints(g.base, moves));
    } else if (g.kind === "press" && Math.hypot(e.clientX - g.x, e.clientY - g.y) > g.slop) {
      // Adding points needs no box: a drag moves the view, as fingers expect.
      if (mode === "pan" || placing) {
        gesture.current = { kind: "pan", x: g.x, y: g.y, view: vb };
      } else {
        const start = toUser(svg, g.x, g.y);
        const end = toUser(svg, e.clientX, e.clientY);
        gesture.current = { kind: "box", start, end, additive: g.additive };
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

  /** Handles a pointer leaving a pinch. True when the pointer was part of one, or of what is left of it. */
  const releaseFromPinch = (pointerId: number) => {
    const g = gesture.current;
    if (g.kind === "spent" || (g.kind === "pinch" && g.ids.includes(pointerId))) {
      gesture.current = pointers.current.size === 0 ? { kind: "none" } : { kind: "spent" };
      return true;
    }
    return g.kind === "pinch";
  };

  const onPointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (!releaseFromPinch(e.pointerId)) abortGesture();
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (releaseFromPinch(e.pointerId)) return;
    const g = gesture.current;
    gesture.current = { kind: "none" };
    const store = useFigureStore.getState();
    const point = g.kind === "press" && g.owner && pointMap(store.doc).has(g.owner) ? g.owner : null;
    if (g.kind === "press" && placing && !(mode === "add" && point)) {
      // Keep the view still, so the next point lands where the next click is.
      if (autoFit) placeCamera(vb);
      if (mode === "figure") actions.quickFigureAt(point ?? pointAt(g.x, g.y));
      else actions.addPointAt(pointAt(g.x, g.y));
    } else if (g.kind === "press") {
      if (g.owner) store.pick(g.owner, g.additive);
      else if (!g.keys) store.clearSelection();
    } else if (g.kind === "drag") {
      store.endTransient();
      setFrozen(null);
      if (!g.moved) store.pick(g.owner, g.additive);
    } else if (g.kind === "box") {
      setBox(null);
      const found = elementsInBox(store.doc, k, boxFrom(g.start, g.end));
      if (g.additive) {
        const kept = new Set(store.selection);
        store.select([...store.selection, ...found.filter((id) => !kept.has(id))]);
      } else {
        store.select(found);
      }
    }
  };

  const pointOrder = selection.filter((id) => scene.hits.some((h) => h.type === "point" && h.owner === id));

  const empty = doc.elements.length === 0 && draft.trim() === "";
  const roomy = useRoomyPreview();
  // Nothing to zoom yet, and on phones the bar would cover the welcome card.
  const zoom = empty
    ? null
    : { onZoomIn: () => zoomBy(1 / 1.25), onZoomOut: () => zoomBy(1.25), autoFit, onToggleAutoFit: toggleAutoFit };

  return (
    <>
      <section
        aria-label="Prévia da figura"
        // A sideways phone is short: the 18rem floor keeps the figure readable, and the page scrolls.
        className={cn(
          "relative flex flex-1 flex-col overflow-hidden bg-card",
          pro ? "h-full min-h-0" : "min-h-[max(55dvh,18rem)] rounded-lg border lg:min-h-0",
        )}
      >
        {!pro && <ActionBar layout={roomy ? "row" : "strip"} zoom={roomy ? null : zoom} />}
        <PreviewMenu enabled={pro} at={menuAt} zoom={zoom}>
          <div ref={containerRef} className="relative min-h-0 flex-1" onContextMenu={pro ? onContextMenu : undefined}>
            <svg
              ref={svgRef}
              className={cn(
                // touch-none keeps the browser from scrolling or zooming the page under the fingers.
                "absolute inset-0 h-full w-full touch-none select-none bg-white [-webkit-touch-callout:none]",
                mode === "pan" && "cursor-grab active:cursor-grabbing",
                mode === "select" && "cursor-crosshair",
                placing && "cursor-copy",
              )}
              viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
              preserveAspectRatio="xMidYMid meet"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onPointerLeave={() => setAddAt(null)}
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
                hit={coarse ? HIT_COARSE : HIT_FINE}
              />
              {ghost && <DraftGhost parsed={ghost} k={k} px={unitsPerPx} />}
              {placing && addAt && (
                <AddMarker at={addAt} k={k} px={unitsPerPx} joins={mode === "figure" ? quickEnds(doc, quickFigure.points) : []} />
              )}
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
            {/* In add mode the whole preview is for clicking, and the hint below says how. */}
            {empty && !placing && <EmptyState pro={pro} />}
            {roomy && zoom && <ZoomBar {...zoom} placement="overlay" />}
            {roomy && <SelectionSummary placement={pro ? "overlay-top" : "overlay"} />}
          </div>
        </PreviewMenu>
      </section>
      {/* Phones have no room to float the hint over the figure, so it goes below the preview. */}
      {!roomy && <SelectionSummary placement="below" />}
    </>
  );
}

/** The vertices a Figura rápida click joins: the last one, and the first once there is a side. */
function quickEnds(doc: FigureDoc, points: Id[]): Vec[] {
  const pts = pointMap(doc);
  const ends = points.length >= 2 ? [points[points.length - 1], points[0]] : points;
  return ends.flatMap((id) => pts.get(id) ?? []);
}

/** Where the next click puts a point, with its coordinates, and the sides it would draw to `joins`. */
function AddMarker({ at, k, px, joins }: { at: Vec; k: number; px: number; joins: Vec[] }) {
  const cx = at.x * k;
  const cy = -at.y * k;
  return (
    <g pointerEvents="none">
      {joins.map((p, i) => (
        <line
          key={i}
          x1={p.x * k}
          y1={-p.y * k}
          x2={cx}
          y2={cy}
          stroke={PRIMARY}
          strokeWidth={1.5}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <circle cx={cx} cy={cy} r={4 * px} fill="none" stroke={PRIMARY} strokeWidth={1.5 * px} />
      <text x={cx + 8 * px} y={cy - 8 * px} fontSize={11 * px} fill={PRIMARY} fontFamily="ui-sans-serif, system-ui">
        ({formatNumber(at.x, 1)}; {formatNumber(at.y, 1)})
      </text>
    </g>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Synthetic or already-released pointers can't be captured; the gesture still works without it. */
function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // Moves still arrive while the pointer stays over the preview.
  }
}

function toUser(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
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
  hit,
}: {
  hits: Hit[];
  selection: Id[];
  pointOrder: Id[];
  unitsPerPx: number;
  moveMode: boolean;
  doc: FigureDoc;
  /** Hit target sizes in screen px. They only change the preview, never the export. */
  hit: { point: number; stroke: number };
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
          const r = Math.max(h.r, hit.point * px);
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
          <g key={h.owner} data-owner={h.owner} className={moveMode && h.type === "text" ? "cursor-move" : "cursor-pointer"}>
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
              strokeWidth={hit.stroke}
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
  const spots = [...parsed.nodes, ...parsed.texts];
  if (spots.length === 0) return null;
  const xs = spots.map((n) => n.x * k);
  const ys = spots.map((n) => -n.y * k);
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
      {parsed.texts.map((t, i) => (
        <text
          key={`text-${i}`}
          x={t.x * k}
          y={-t.y * k + 4 * px}
          fontSize={12 * px}
          textAnchor="middle"
          fill={PRIMARY}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {t.text}
        </text>
      ))}
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
