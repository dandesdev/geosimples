import { useEffect, useRef, useState } from "react";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { cn } from "@/lib/utils";
import {
  docked,
  DOCKS,
  useWorkspaceStore,
  WINDOW_IDS,
  type Dock,
  type Rect,
  type WindowId,
} from "@/store/workspaceStore";
import { AutoHideInput } from "./AutoHideInput";
import { LeftBar } from "./LeftBar";
import { PanelWindow, type ResizeEdge } from "./PanelWindow";
import { WINDOW_CONTENT } from "./windowContent";

/** How close (px) to an edge of the work area a dragged window must be to dock there. */
const DOCK_REACH = 48;
const MIN_FLOAT = { w: 240, h: 140 };
/** A floating window keeps at least this much (px) inside the work area, so it can always be grabbed back. */
const KEEP_VISIBLE = 80;

/** A window being dragged or resized: its rect follows the pointer until it is dropped. */
interface Live {
  kind: "drag" | "resize";
  id: WindowId;
  rect: Rect;
  /** The dock it would join if dropped now, and where in it. */
  target: { dock: Dock; index: number } | null;
}

function body(id: WindowId) {
  const { Body } = WINDOW_CONTENT[id];
  return <Body />;
}

const isColumn = (dock: Dock) => dock === "left" || dock === "right";

function clampRect(r: Rect, area: { w: number; h: number }): Rect {
  return {
    ...r,
    x: Math.round(Math.min(Math.max(r.x, KEEP_VISIBLE - r.w), area.w - KEEP_VISIBLE)),
    y: Math.round(Math.min(Math.max(r.y, 0), area.h - 32)),
  };
}

/**
 * The pro layout: a tool column on the left and the preview filling the rest,
 * with windows docked on its edges or floating over it. Windows are dragged by
 * their title bars: dropped near an edge they dock there, anywhere else they float.
 */
export function ProWorkspace() {
  const windows = useWorkspaceStore((s) => s.windows);
  const docks = useWorkspaceStore((s) => s.docks);
  const maximized = useWorkspaceStore((s) => s.maximized);
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 1200, h: 800 });
  const [live, setLive] = useState<Live | null>(null);
  /** The pointer is near the bottom of the preview, where the point input waits. */
  const [nearBottom, setNearBottom] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setArea({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** The dock a window dropped at `p` would join, and its place among the windows already there. */
  const dropTarget = (id: WindowId, p: { x: number; y: number }): Live["target"] => {
    const reach: [Dock, number][] = [
      ["left", p.x],
      ["right", area.w - p.x],
      ["top", p.y],
      ["bottom", area.h - p.y],
    ];
    const [dock, dist] = reach.sort((a, b) => a[1] - b[1])[0];
    if (dist > DOCK_REACH) return null;
    const r = areaRef.current!.getBoundingClientRect();
    const others = [...areaRef.current!.querySelectorAll<HTMLElement>(`[data-dock="${dock}"] [data-window]`)].filter(
      (el) => el.dataset.window !== id,
    );
    const index = others.filter((el) => {
      const b = el.getBoundingClientRect();
      return isColumn(dock) ? b.top + b.height / 2 - r.top < p.y : b.left + b.width / 2 - r.left < p.x;
    }).length;
    return { dock, index };
  };

  /** Follows the pointer until it is released; `move` gets the offset from where it went down. */
  const track = (start: PointerEvent | React.PointerEvent, move: (e: PointerEvent, dx: number, dy: number) => void, end: () => void) => {
    const x0 = start.clientX;
    const y0 = start.clientY;
    const onMove = (e: PointerEvent) => move(e, e.clientX - x0, e.clientY - y0);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      end();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  /** Starts dragging a window by its title bar. A docked window comes out of its dock once the pointer moves. */
  const startDrag = (id: WindowId, e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as Element).closest("button")) return;
    const section = e.currentTarget.closest<HTMLElement>("[data-window]");
    if (!section) return;
    e.preventDefault();
    const box = section.getBoundingClientRect();
    const areaBox = areaRef.current!.getBoundingClientRect();
    const w = windows[id];
    // Out of a dock, a window keeps its last floating size, but no wider than it was in the dock.
    const width = w.place === "float" ? box.width : Math.min(Math.max(box.width, MIN_FLOAT.w), w.rect.w);
    const grab = { x: Math.min(e.clientX - box.left, width - 40), y: e.clientY - box.top };
    let current: Live | null = null;
    track(
      e,
      (ev, dx, dy) => {
        if (!current && Math.hypot(dx, dy) < 4) return;
        const p = { x: ev.clientX - areaBox.left, y: ev.clientY - areaBox.top };
        current = {
          kind: "drag",
          id,
          rect: { x: p.x - grab.x, y: p.y - grab.y, w: width, h: w.place === "float" ? box.height : w.rect.h },
          target: dropTarget(id, p),
        };
        setLive(current);
      },
      () => {
        setLive(null);
        if (!current) return;
        const ws = useWorkspaceStore.getState();
        if (current.target) ws.place(id, current.target.dock, { index: current.target.index });
        else ws.place(id, "float", { rect: clampRect(current.rect, area) });
      },
    );
  };

  const startResize = (id: WindowId, e: React.PointerEvent<HTMLElement>, edge: ResizeEdge) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const r0 = windows[id].rect;
    let current: Live | null = null;
    track(
      e,
      (_ev, dx, dy) => {
        const rect = { ...r0 };
        if (edge.includes("e")) rect.w = Math.max(MIN_FLOAT.w, r0.w + dx);
        if (edge.includes("w")) {
          rect.w = Math.max(MIN_FLOAT.w, r0.w - dx);
          rect.x = r0.x + r0.w - rect.w;
        }
        if (edge.includes("s")) rect.h = Math.max(MIN_FLOAT.h, r0.h + dy);
        current = { kind: "resize", id, rect, target: null };
        setLive(current);
      },
      () => {
        setLive(null);
        if (current) useWorkspaceStore.getState().setRect(id, current.rect);
      },
    );
  };

  /** Floats a docked window near the top right of the preview, from its menu. */
  const floatOut = (id: WindowId) => {
    const r = windows[id].rect;
    useWorkspaceStore.getState().place(id, "float", { rect: clampRect(r, area) });
  };

  const startDockResize = (dock: Dock, e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const size0 = docks[dock];
    // Dragging toward the preview makes the dock bigger.
    const sign = dock === "left" || dock === "top" ? 1 : -1;
    track(
      e,
      (_ev, dx, dy) => useWorkspaceStore.getState().setDockSize(dock, size0 + sign * (isColumn(dock) ? dx : dy)),
      () => {},
    );
  };

  const renderDock = (dock: Dock) => {
    const ids = docked(windows, dock).filter((id) => id !== maximized && id !== live?.id);
    if (ids.length === 0) return null;
    const column = isColumn(dock);
    const splitter = (
      <div
        role="separator"
        aria-orientation={column ? "vertical" : "horizontal"}
        aria-label="Redimensionar"
        onPointerDown={(e) => startDockResize(dock, e)}
        className={cn(
          "relative z-10 shrink-0 touch-none bg-border transition-colors hover:bg-primary/60",
          column ? "w-px cursor-ew-resize before:absolute before:inset-y-0 before:-left-1 before:w-2" : "h-px cursor-ns-resize before:absolute before:inset-x-0 before:-top-1 before:h-2",
          "before:content-['']",
        )}
      />
    );
    return (
      <>
        {(dock === "right" || dock === "bottom") && splitter}
        <div
          data-dock={dock}
          className={cn("flex shrink-0 overflow-hidden bg-card", column ? "flex-col divide-y" : "flex-row divide-x")}
          // The dock's size is the user's, dragged with the splitter.
          style={column ? { width: docks[dock] } : { height: docks[dock] }}
        >
          {ids.map((id) => (
            <PanelWindow
              key={id}
              id={id}
              variant={column ? "column" : "row"}
              fit={WINDOW_CONTENT[id].fit}
              onTitlePointerDown={(e) => startDrag(id, e)}
              onFloat={() => floatOut(id)}
            >
              {body(id)}
            </PanelWindow>
          ))}
        </div>
        {(dock === "left" || dock === "top") && splitter}
      </>
    );
  };

  const floating = WINDOW_IDS.filter(
    (id) => !windows[id].closed && id !== maximized && (windows[id].place === "float" || id === live?.id),
  ).sort((a, b) => windows[a].z - windows[b].z);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <LeftBar />
      <div ref={areaRef} className="relative flex min-w-0 flex-1 flex-col">
        {renderDock("top")}
        <div className="flex min-h-0 flex-1">
          {renderDock("left")}
          <div
            ref={stageRef}
            className="relative min-w-0 flex-1 overflow-hidden"
            onPointerMove={(e) => {
              const r = stageRef.current!.getBoundingClientRect();
              setNearBottom(e.clientY > r.bottom - 56);
            }}
            onPointerLeave={() => setNearBottom(false)}
          >
            <PreviewPanel pro />
            <AutoHideInput near={nearBottom} />
          </div>
          {renderDock("right")}
        </div>
        {renderDock("bottom")}

        {floating.map((id) => {
          const dragged = live?.id === id;
          const rect = dragged ? live.rect : clampRect(windows[id].rect, area);
          return (
            <PanelWindow
              key={id}
              id={id}
              variant="float"
              rect={rect}
              dragging={dragged}
              onTitlePointerDown={(e) => startDrag(id, e)}
              onResizePointerDown={(e, edge) => startResize(id, e, edge)}
              onFloat={() => floatOut(id)}
            >
              {body(id)}
            </PanelWindow>
          );
        })}
        {maximized && !windows[maximized].closed && (
          <PanelWindow
            id={maximized}
            variant="max"
            onTitlePointerDown={() => {}}
            onFloat={() => floatOut(maximized)}
          >
            {body(maximized)}
          </PanelWindow>
        )}
        {live?.target && <DropHint dock={live.target.dock} size={docks[live.target.dock]} />}
        {live?.kind === "drag" && !live.target && <EdgeHints />}
      </div>
    </div>
  );
}

/** Faint marks on the four edges while a window is dragged, so docking can be found. */
function EdgeHints() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-50">
      {DOCKS.map((dock) => (
        <div
          key={dock}
          className={cn(
            "absolute rounded-full bg-primary/30",
            dock === "left" && "inset-y-1/4 left-1 w-1",
            dock === "right" && "inset-y-1/4 right-1 w-1",
            dock === "top" && "inset-x-1/4 top-1 h-1",
            dock === "bottom" && "inset-x-1/4 bottom-1 h-1",
          )}
        />
      ))}
    </div>
  );
}

/** Where the dragged window would dock if dropped now. */
function DropHint({ dock, size }: { dock: Dock; size: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-50 rounded-md border-2 border-primary bg-primary/15",
        dock === "left" && "inset-y-1 left-1",
        dock === "right" && "inset-y-1 right-1",
        dock === "top" && "inset-x-1 top-1",
        dock === "bottom" && "inset-x-1 bottom-1",
      )}
      // As wide (or tall) as the dock it would join.
      style={isColumn(dock) ? { width: size } : { height: size }}
    />
  );
}
