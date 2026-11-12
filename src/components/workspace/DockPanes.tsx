import { useEffect, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { FigureBar } from "@/components/figures/FigureBar";
import { OpenFigureSnapshot } from "@/components/figures/OpenFigureSnapshot";
import { Formatting } from "@/components/panel/Formatting";
import { LabelTools } from "@/components/panel/LabelTools";
import { Properties } from "@/components/panel/Properties";
import { SelectionHeader } from "@/components/panel/SelectionHeader";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import type { MenuSide } from "@/components/preview/ActionBar";
import { TooltipSide } from "@/components/tooltipSide";
import { PANEL_TITLES, useWorkspaceStore, type PanelId, type ToolbarId } from "@/store/workspaceStore";
import { AutoHideInput } from "./AutoHideInput";
import { dockApi, fitToolbars } from "./dock";
import { Toolbar } from "./Toolbars";
import { InsertCatalog } from "@/components/preview/InsertCatalog";
import { AreaTools } from "@/components/tools/AreaTools";
import { ToolsStrip } from "@/components/tools/ToolsStrip";
import { ReadyFigures } from "@/components/panel/ReadyFigures";
import { cn } from "@/lib/utils";

/** The preview, edge to edge, with the point input waiting at its bottom. */
export function PreviewPane() {
  const ref = useRef<HTMLDivElement>(null);
  /** The pointer is near the bottom of the preview, where the point input waits. */
  const [nearBottom, setNearBottom] = useState(false);
  return (
    <div
      ref={ref}
      className="relative h-full overflow-hidden"
      onPointerMove={(e) => setNearBottom(e.clientY > ref.current!.getBoundingClientRect().bottom - 56)}
      onPointerLeave={() => setNearBottom(false)}
      // Focus reaching the slid-away input (Tab) would scroll the preview up to it.
      onScroll={(e) => {
        e.currentTarget.scrollTop = 0;
      }}
    >
      <PreviewPanel pro />
      {/* Inserir, the first thing to do, floats on the preview's corner. */}
      <div className="absolute right-3 top-3 z-10">
        <InsertCatalog variant="floating" side="bottom" />
      </div>
      <AutoHideInput near={nearBottom} />
    </div>
  );
}

/**
 * A toolbar in the dock. It lies across when its place is wider than tall,
 * and opens its menus and tooltips away from the edge it sits on.
 */
export function ToolbarPane(props: IDockviewPanelProps<{ toolbar: ToolbarId }>) {
  const ref = useRef<HTMLDivElement>(null);
  const [shape, setShape] = useState<{ row: boolean; side: MenuSide }>({ row: false, side: "right" });
  useEffect(() => {
    const measure = () => {
      const el = ref.current?.closest(".dv-groupview");
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const row = props.api.location.type !== "floating" && r.width > r.height;
      const side: MenuSide = row
        ? r.top + r.height / 2 > window.innerHeight / 2 ? "top" : "bottom"
        : r.left + r.width / 2 > window.innerWidth / 2 ? "left" : "right";
      setShape((s) => (s.row === row && s.side === side ? s : { row, side }));
    };
    measure();
    const subs = [props.api.onDidDimensionsChange(measure), props.api.onDidLocationChange(measure)];
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    // A button that comes or goes (Figura rápida) changes the toolbar's length: its line refits.
    let frame = 0;
    const buttons = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const dock = dockApi();
        if (dock) fitToolbars(dock);
      });
    });
    if (ref.current?.firstElementChild) buttons.observe(ref.current.firstElementChild);
    return () => {
      subs.forEach((s) => s.dispose());
      ro.disconnect();
      cancelAnimationFrame(frame);
      buttons.disconnect();
    };
  }, [props.api]);
  useEffect(() => {
    // Turned, the toolbar has a new length: its line refits once it is drawn.
    const frame = requestAnimationFrame(() => {
      const dock = dockApi();
      if (dock) fitToolbars(dock);
    });
    return () => cancelAnimationFrame(frame);
  }, [shape.row]);
  return (
    <TooltipSide.Provider value={shape.side}>
      <div
        ref={ref}
        className={cn(
          "h-full w-full overflow-auto bg-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // Janelas and help sit at the far end of their line: at the bottom of the column.
          props.params.toolbar === "tools-app" && "flex justify-end",
          props.params.toolbar === "tools-app" && !shape.row && "flex-col",
        )}
      >
        <Toolbar id={props.params.toolbar} row={shape.row} side={shape.side} />
      </div>
    </TooltipSide.Provider>
  );
}

/** A panel's body, named for screen readers and tests. */
function Pane({ id, className, children }: { id: PanelId; className?: string; children: React.ReactNode }) {
  return (
    <section aria-label={PANEL_TITLES[id]} data-panel={id} className={className ?? "h-full overflow-y-auto bg-card"}>
      {children}
    </section>
  );
}

/** The tools by kind of figure, in tabs: as a panel of named tiles, or as a bar of icons. */
export function ToolsPane() {
  const bar = useWorkspaceStore((s) => s.toolsBar);
  return (
    <Pane id="tools" className="flex h-full flex-col overflow-hidden bg-card">
      {bar ? <ToolsStrip /> : <AreaTools className="h-full px-2 pt-2" />}
    </Pane>
  );
}

/** Figures ready to use, as the second tab of Figura. */
export function ReadyPane() {
  return (
    <Pane id="ready">
      <ReadyFigures />
    </Pane>
  );
}

export function FigurePane() {
  return (
    <Pane id="figure">
      <FigureBar bordered={false} />
      <OpenFigureSnapshot />
    </Pane>
  );
}

export function PropertiesPane() {
  return (
    <Pane id="properties">
      <div className="px-3 pb-3">
        <SelectionHeader />
        <div className="pt-2">
          <Properties />
        </div>
      </div>
    </Pane>
  );
}

export function FormattingPane() {
  // Formatação names the selection itself unless Propriedades is in view to do it.
  const header = useWorkspaceStore((s) => !s.visible.includes("properties"));
  return (
    <Pane id="formatting">
      <div className="px-3 pb-3">
        {header && <SelectionHeader />}
        <div className="pt-2">
          <Formatting />
        </div>
      </div>
    </Pane>
  );
}

export function LabelsPane() {
  return (
    <Pane id="labels">
      <div className="px-3 py-3">
        <LabelTools />
      </div>
    </Pane>
  );
}
