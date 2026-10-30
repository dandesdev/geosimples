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
  gridSizes,
  isPreviewGroup,
  isToolbarGroup,
  orientToolbars,
  restoreLayout,
  saveLayout,
  setDockApi,
  sizeEdgeDrop,
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
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    window.addEventListener("pointerup", clear);
    return () => {
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
    syncDockState();
    api.onDidLayoutChange(() => {
      orientToolbars(api);
      fitFigure(api);
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
      if (toPreview || !into) return;
      // Toolbars and panels don't share a group: a toolbar can't become a tab, nor take one.
      if (draggingToolbar(api, e) || isToolbarGroup(e.group)) e.preventDefault();
    });
  };

  const onWillDrop = (e: DockviewWillDropEvent) => {
    if (e.kind === "edge") {
      // Dropped on an edge of the window: once placed, it takes the size the overlay showed.
      const data = e.getData();
      const id = data?.panelId;
      const before = gridSizes(e.api);
      setTimeout(() => {
        const group = id ? e.api.getPanel(id)?.group : e.api.groups.find((g) => g.id === data?.groupId);
        if (group) sizeEdgeDrop(e.api, group, e.position, before);
      });
      return;
    }
    if (!isPreviewGroup(e.group) || e.position !== "center") return;
    // Dropped on the preview, a panel or toolbar floats where it was let go.
    e.preventDefault();
    setFloatHere(false);
    const data = e.getData();
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
