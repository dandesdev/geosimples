import { useEffect, useRef, useState } from "react";
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type DockviewTheme,
  type DockviewWillDropEvent,
  type DockviewWillShowOverlayLocationEvent,
} from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import "./dock.css";
import { useDarkTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { isToolbar } from "@/store/workspaceStore";
import {
  edgeOverlay,
  fitFigure,
  fitToolbars,
  floatItem,
  isPreviewGroup,
  isToolbarGroup,
  orientToolbars,
  restoreLayout,
  saveLayout,
  setDockApi,
  keepWidths,
  recordWidths,
  settle,
  settleSplitter,
  splitsLine,
  syncDockState,
} from "./dock";
import { FigurePane, FormattingPane, LabelsPane, PreviewPane, PropertiesPane, ToolbarPane } from "./DockPanes";
import { GripTab, GroupActions, PanelTab } from "./DockParts";

const components = {
  preview: PreviewPane,
  toolbar: ToolbarPane,
  figure: FigurePane,
  properties: PropertiesPane,
  formatting: FormattingPane,
  labels: LabelsPane,
};

const tabComponents = { panel: PanelTab, grip: GripTab };

const theme = (dark: boolean): DockviewTheme => ({
  name: "geosimples",
  className: "dockview-theme-geosimples",
  colorScheme: dark ? "dark" : "light",
  gap: 0,
  // The drop overlay covers exactly the part of the panel it would take.
  dndOverlayMounting: "absolute",
  dndPanelOverlay: "group",
  dndTabIndicator: "line",
});

/** Whether what is being dragged is a toolbar, which never joins a group as a tab. */
function draggingToolbar(api: DockviewApi, e: DockviewWillShowOverlayLocationEvent | DockviewWillDropEvent) {
  const data = e.getData();
  if (!data) return false;
  if (data.panelId) return isToolbar(data.panelId);
  const group = api.groups.find((g) => g.id === data.groupId);
  return isToolbarGroup(group);
}

/**
 * The pro layout: panels and toolbars in a dock that fills the window, around
 * the preview. Panels are dragged by their tabs: onto another panel's edge
 * they split it, onto its tabs they join it, onto the preview they float.
 * Toolbars are dragged by their grips and dock on any edge, across or down.
 */
export function ProWorkspace() {
  const dark = useDarkTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  /** A drag is over the preview: dropping floats the panel there. */
  const [floatHere, setFloatHere] = useState(false);
  const apiRef = useRef<DockviewApi | null>(null);

  useEffect(() => {
    // Mounting again (as React's strict mode does) keeps the dock it already has.
    if (apiRef.current) setDockApi(apiRef.current);
    const clear = () => setFloatHere(false);
    // A resized window changes the dock's size without a layout event: the preview takes the difference.
    let frame = 0;
    const resized = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => apiRef.current && keepWidths(apiRef.current));
    });
    if (rootRef.current) resized.observe(rootRef.current);
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    window.addEventListener("pointerup", clear);
    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
      window.removeEventListener("pointerup", clear);
      setDockApi(null);
    };
  }, []);

  const onReady = ({ api }: DockviewReadyEvent) => {
    apiRef.current = api;
    setDockApi(api);
    restoreLayout(api);
    recordWidths(api);
    syncDockState();
    api.onDidLayoutChange(() => {
      orientToolbars(api);
      fitFigure(api);
      keepWidths(api);
      // Toolbars measure their buttons once they are drawn in their new place.
      requestAnimationFrame(() => fitToolbars(api));
      saveLayout();
      syncDockState();
    });
    api.onDidActivePanelChange(syncDockState);
    // The overlay on a window edge is as big as what is dragged will be there.
    api.onWillDragPanel((e) => api.updateOptions({ dndEdges: edgeOverlay(isToolbar(e.panel.id)) }));
    api.onWillDragGroup((e) => api.updateOptions({ dndEdges: edgeOverlay(isToolbarGroup(e.group)) }));
    api.onWillShowOverlay((e) => {
      const toPreview = isPreviewGroup(e.group);
      const into = e.kind === "tab" || e.kind === "header_space" || (e.kind === "content" && e.position === "center");
      setFloatHere(toPreview && into);
      // Never two panels side by side inside one column: no overlay, so no drop. Toolbars line up freely.
      const panels = !draggingToolbar(api, e) && !isToolbarGroup(e.group);
      if (e.kind === "content" && panels && splitsLine(e.group, e.position)) e.preventDefault();
      if (toPreview || !into) return;
      // Toolbars and panels don't share a group: a toolbar can't become a tab, nor take one.
      if (draggingToolbar(api, e) || isToolbarGroup(e.group)) e.preventDefault();
    });
  };

  const onWillDrop = (e: DockviewWillDropEvent) => {
    const data = e.getData();
    const dropped = () =>
      data?.panelId ? e.api.getPanel(data.panelId)?.group : e.api.groups.find((g) => g.id === data?.groupId);
    // Dropped on a window edge or beside a group, the dropped group (and the one it split) keep their new
    // widths; every other drop, and every other panel column, keeps the widths there were.
    // Dropped on an edge of the window, it takes the size the overlay showed.
    const sets = e.kind === "edge" || (e.kind === "content" && (e.position === "left" || e.position === "right"));
    settle(e.api, () => (sets ? [dropped(), e.group] : []), e.kind === "edge" ? e.position : undefined);
    if (!isPreviewGroup(e.group) || e.position !== "center") return;
    // Dropped on the preview, a panel or toolbar floats where it was let go.
    e.preventDefault();
    setFloatHere(false);
    if (!data) return;
    const item = data.panelId ? e.api.getPanel(data.panelId) : e.api.groups.find((g) => g.id === data.groupId);
    if (!item) return;
    const r = rootRef.current!.getBoundingClientRect();
    floatItem(item, { x: e.nativeEvent.clientX - r.left, y: e.nativeEvent.clientY - r.top });
  };

  return (
    <div
      ref={rootRef}
      data-float-here={floatHere || undefined}
      onPointerDownCapture={(e) => {
        // Only a splitter between columns (taller than wide) sets widths.
        const sash = (e.target as Element).closest(".dv-sash");
        if (sash && sash.clientHeight > sash.clientWidth && apiRef.current) settleSplitter(apiRef.current);
      }}
      className={cn("h-dvh overflow-hidden bg-background", floatHere && "geo-float-here")}
    >
      <DockviewReact
        className="h-full"
        theme={theme(dark)}
        components={components}
        tabComponents={tabComponents}
        rightHeaderActionsComponent={GroupActions}
        // A panel that leaves a column gives its height to the last one, not to all: Figura keeps its size.
        proportionalLayout={false}
        floatingGroupDragHandle="tabbar"
        floatingGroupBounds={{ minimumHeightWithinViewport: 40, minimumWidthWithinViewport: 80 }}
        dndEdges={edgeOverlay(false)}
        onReady={onReady}
        onWillDrop={onWillDrop}
      />
    </div>
  );
}
