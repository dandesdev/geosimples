import type { DockviewApi, DockviewGroupPanel, IDockviewPanel } from "dockview-react";
import {
  DOCK_ITEM_IDS,
  DOCK_ITEM_TITLES,
  isToolbar,
  PANEL_IDS,
  useWorkspaceStore,
  type DockItemId,
} from "@/store/workspaceStore";

/**
 * The pro layout's dock: where the panels and toolbars are, and what the
 * menus do to them. The dock itself (dockview) keeps the arrangement; this
 * module holds its api so menus outside it can open, close and move things.
 */

export const PREVIEW_ID = "preview";
/** A toolbar is this many px across: one button plus its margins. */
export const TOOLBAR_SIZE = 48;
/** The grip that drags a toolbar is this many px tall (or wide, beside a horizontal toolbar). */
export const GRIP_SIZE = 12;
/** A panel's tab strip is this many px tall; a minimized panel keeps only it. */
export const TAB_STRIP = 30;
const RIGHT_COLUMN = 340;
/** A panel dropped on an edge of the window takes this many px across, as its overlay shows. */
export const EDGE_PANEL = 300;
/** How close (px) to an edge of the window a drag must come to dock on it. */
export const EDGE_REACH = 24;

/** The overlay for an edge of the window, as big as what is dragged will be once dropped. */
export const edgeOverlay = (toolbar: boolean) => ({
  activationSize: { type: "pixels" as const, value: EDGE_REACH },
  size: { type: "pixels" as const, value: toolbar ? TOOLBAR_SIZE : EDGE_PANEL },
});

type Sizes = Map<string, { width: number; height: number }>;

/** How big each group in the grid is, to put them back after a drop moves them. */
export function gridSizes(target: DockviewApi): Sizes {
  return new Map(
    target.groups
      .filter((g) => g.api.location.type === "grid")
      .map((g) => [g.id, { width: g.api.width, height: g.api.height }]),
  );
}

/**
 * Gives a group dropped on an edge of the window the size its overlay showed,
 * and puts the others back as they were (`before`): the preview gives up the room.
 */
export function sizeEdgeDrop(target: DockviewApi, group: DockviewGroupPanel, edge: string, before: Sizes) {
  const across = edge === "left" || edge === "right" ? "width" : "height";
  if (!isToolbarGroup(group)) group.api.setSize({ [across]: EDGE_PANEL });
  for (const g of target.groups) {
    const was = before.get(g.id);
    if (!was || g === group || isPreviewGroup(g) || g.api.location.type !== "grid") continue;
    if (Math.abs(g.api[across] - was[across]) > 1) g.api.setSize({ [across]: was[across] });
  }
}

/** Figura is one row of buttons: stacked with other panels, it keeps just that height. */
export function fitFigure(target: DockviewApi) {
  const figure = target.getPanel("figure");
  if (!figure || figure.group.panels.length !== 1 || figure.group.api.location.type !== "grid") return;
  const others = stackedWith(figure.group);
  // Alone in its column, or beside a minimized panel that must keep its strip, Figura takes what is left.
  if (others.length === 0 || others.some(isMinimized) || isMinimized(figure.group)) return;
  const height = TAB_STRIP + 52;
  const now = Math.round(figure.group.api.height);
  // One try per height: a column that can't give Figura exactly this height must not loop.
  if (Math.abs(now - height) <= 1 || figureTried === now) return;
  figureTried = now;
  figure.group.api.setSize({ height });
}

let figureTried = -1;

let api: DockviewApi | null = null;

export const dockApi = () => api;

export function setDockApi(next: DockviewApi | null) {
  api = next;
}

/** Tells the store which panels are open and in view, for the Janelas menus and Formatação's header. */
export function syncDockState() {
  if (!api) return;
  const open = DOCK_ITEM_IDS.filter((id) => api!.getPanel(id));
  const visible = open.filter((id) => api!.getPanel(id)!.api.isVisible);
  const s = useWorkspaceStore.getState();
  if (open.join() !== s.open.join() || visible.join() !== s.visible.join()) s.setDockState(open, visible);
}

export function saveLayout() {
  if (!api) return;
  useWorkspaceStore.getState().setDock(api.toJSON());
}

const panelOptions = (id: DockItemId) =>
  isToolbar(id)
    ? { id, component: "toolbar", tabComponent: "grip", title: DOCK_ITEM_TITLES[id], params: { toolbar: id } }
    : // Down to the tab strip, so a panel can be minimized; Figura is one row.
      { id, component: id, tabComponent: "panel", title: DOCK_ITEM_TITLES[id], minimumHeight: TAB_STRIP, minimumWidth: 200 };

/**
 * The default arrangement: the toolbars down the left, the preview in the
 * middle, and down the right Figura, Propriedades, then Formatação with
 * Rótulos e textos as a second tab.
 */
export function buildDefaultLayout(target: DockviewApi) {
  target.clear();
  target.addPanel({ id: PREVIEW_ID, component: PREVIEW_ID, title: "Prévia" });
  target.addPanel({ ...panelOptions("tools-file"), position: { referencePanel: PREVIEW_ID, direction: "left" }, initialWidth: TOOLBAR_SIZE });
  target.addPanel({ ...panelOptions("tools-build"), position: { referencePanel: "tools-file", direction: "below" } });
  target.addPanel({ ...panelOptions("tools-app"), position: { referencePanel: "tools-build", direction: "below" } });
  target.addPanel({ ...panelOptions("figure"), position: { referencePanel: PREVIEW_ID, direction: "right" }, initialWidth: RIGHT_COLUMN });
  target.addPanel({ ...panelOptions("properties"), position: { referencePanel: "figure", direction: "below" } });
  target.addPanel({ ...panelOptions("formatting"), position: { referencePanel: "properties", direction: "below" } });
  target.addPanel({ ...panelOptions("labels"), position: { referencePanel: "formatting", direction: "within" }, inactive: true });
  prepareGroups(target);
  // Figura is one row of buttons. The toolbars fit their buttons once they are drawn; the last takes the rest.
  fitFigure(target);
  requestAnimationFrame(() => requestAnimationFrame(() => fitToolbars(target)));
}

/** Restores the saved arrangement, or builds the default one if there is none or it can't be read. */
export function restoreLayout(target: DockviewApi) {
  const saved = useWorkspaceStore.getState().dock;
  if (saved) {
    try {
      target.fromJSON(saved as Parameters<DockviewApi["fromJSON"]>[0]);
      if (target.getPanel(PREVIEW_ID)) {
        prepareGroups(target);
        return;
      }
    } catch {
      // An arrangement from another version: start over.
    }
  }
  buildDefaultLayout(target);
}

/** The preview's group has no tabs; toolbar groups get a grip instead of tabs and fit their buttons. */
export function prepareGroups(target: DockviewApi) {
  const preview = target.getPanel(PREVIEW_ID);
  if (preview) preview.group.header.hidden = true;
  orientToolbars(target);
}

export const isPreviewGroup = (group: DockviewGroupPanel | undefined) =>
  !!group?.panels.some((p) => p.id === PREVIEW_ID);

export const isToolbarGroup = (group: DockviewGroupPanel | undefined) =>
  !!group && group.panels.length > 0 && group.panels.every((p) => isToolbar(p.id));

/** A toolbar lies across when it is wider than tall: then its grip goes on the left, not on top. */
export function toolbarIsRow(group: DockviewGroupPanel) {
  return group.api.width > group.api.height;
}

/** How each toolbar group was last shaped, so a layout change that doesn't move it leaves it alone. */
const shaped = new Map<string, string>();

/** Puts a toolbar's grip on the side it reads from, and holds it to one button across. */
export function orientToolbar(group: DockviewGroupPanel) {
  const row = toolbarIsRow(group);
  const where = group.api.location.type;
  const key = `${row ? "row" : "column"} ${where}`;
  if (shaped.get(group.id) === key) return;
  shaped.set(group.id, key);
  if (group.api.getHeaderPosition() !== (row ? "left" : "top")) group.api.setHeaderPosition(row ? "left" : "top");
  if (where !== "grid") return;
  group.api.setConstraints(
    row
      ? { minimumHeight: TOOLBAR_SIZE, maximumHeight: TOOLBAR_SIZE, minimumWidth: GRIP_SIZE + TOOLBAR_SIZE }
      : { minimumWidth: TOOLBAR_SIZE, maximumWidth: TOOLBAR_SIZE, minimumHeight: GRIP_SIZE + TOOLBAR_SIZE },
  );
}

export function orientToolbars(target: DockviewApi) {
  for (const group of target.groups) if (isToolbarGroup(group)) orientToolbar(group);
}

/** How long a toolbar's buttons are, grip included, along the way it lies. */
function toolbarLength(group: DockviewGroupPanel, row: boolean) {
  const body = document.querySelector<HTMLElement>(`[data-toolbar="${group.activePanel?.id}"]`);
  if (!body) return null;
  return (row ? body.scrollWidth : body.scrollHeight) + GRIP_SIZE;
}

/** The last size each toolbar was fitted from, so a line that can't take the fit isn't tried again and again. */
const fitted = new Map<string, string>();

/**
 * Toolbars that share a column (or a row) with only other toolbars take the
 * length of their buttons; the last one takes what is left. Run after every
 * change, so a column refits when one of its toolbars leaves or arrives.
 */
export function fitToolbars(target: DockviewApi) {
  for (const group of target.groups) {
    if (!isToolbarGroup(group) || group.api.location.type !== "grid") continue;
    const row = toolbarIsRow(group);
    const line = [group, ...inLineWith(group, row)];
    if (line.length < 2 || !line.every(isToolbarGroup)) continue;
    const start = (g: DockviewGroupPanel) => g.element.getBoundingClientRect()[row ? "left" : "top"];
    line.sort((a, b) => start(a) - start(b));
    if (line.at(-1) === group) continue;
    const want = toolbarLength(group, row);
    const now = Math.round(row ? group.api.width : group.api.height);
    if (want === null || Math.abs(now - want) <= 1) continue;
    const key = `${now}>${want}`;
    if (fitted.get(group.id) === key) continue;
    fitted.set(group.id, key);
    group.api.setSize(row ? { width: want } : { height: want });
  }
}

/** Opens a closed panel or toolbar where it starts out, or brings an open one to the front. */
export function openItem(id: DockItemId) {
  if (!api) return;
  const open = api.getPanel(id);
  if (open) {
    open.api.setActive();
    return;
  }
  if (isToolbar(id)) {
    const toolbar = api.panels.find((p) => isToolbar(p.id) && p.group.api.location.type === "grid");
    api.addPanel({
      ...panelOptions(id),
      position: toolbar
        ? { referenceGroup: toolbar.group, direction: toolbarIsRow(toolbar.group) ? "right" : "below" }
        : { referencePanel: PREVIEW_ID, direction: "left" },
      initialWidth: TOOLBAR_SIZE,
    });
    orientToolbar(api.getPanel(id)!.group);
    return;
  }
  // A panel joins another open panel as a tab (the tall ones first: Figura is one row), or starts the right column again.
  const neighbour = [...PANEL_IDS]
    .reverse()
    .map((p) => api!.getPanel(p))
    .find((p): p is IDockviewPanel => !!p && p.group.api.location.type === "grid");
  api.addPanel({
    ...panelOptions(id),
    position: neighbour
      ? { referenceGroup: neighbour.group, direction: "within" }
      : { referencePanel: PREVIEW_ID, direction: "right" },
    initialWidth: RIGHT_COLUMN,
  });
}

export function closeItem(id: DockItemId) {
  api?.getPanel(id)?.api.close();
}

export function setItemOpen(id: DockItemId, open: boolean) {
  if (open) openItem(id);
  else closeItem(id);
}

/** Puts every panel and toolbar back where it starts out. */
export function resetLayout() {
  if (api) buildDefaultLayout(api);
  else useWorkspaceStore.getState().setDock(null);
}

/**
 * Floats a panel (alone, out of its tabs) or a whole group over the preview,
 * with its top left near `at` (px in the dock), or near the preview's top right.
 */
export function floatItem(item: IDockviewPanel | DockviewGroupPanel, at?: { x: number; y: number }) {
  if (!api) return;
  const group = "group" in item ? item.group : item;
  const toolbar = isToolbarGroup(group);
  const body = toolbar ? document.querySelector<HTMLElement>(`[data-toolbar="${group.activePanel?.id}"]`) : null;
  // A toolbar floats down, as long as its buttons; a panel keeps a readable size.
  const width = toolbar ? TOOLBAR_SIZE + 2 : Math.min(Math.max(group.api.width, 260), 340);
  const height = toolbar
    ? Math.min((body?.scrollHeight ?? 300) + GRIP_SIZE + 2, api.height - 40)
    : Math.min(Math.max(group.api.height, 220), 460);
  const x = at ? at.x - 40 : api.width - RIGHT_COLUMN - width - 24;
  const y = at ? at.y - 12 : 24;
  // The whole window stays inside the dock.
  const box = {
    x: Math.round(Math.max(0, Math.min(x, api.width - width))),
    y: Math.round(Math.max(0, Math.min(y, api.height - height))),
    width,
    height,
  };
  // A floating group that is moved again keeps its tabs: it is the one moving.
  const whole = "group" in item && group.panels.length === 1 ? group : item;
  api.addFloatingGroup(whole, box);
}

/** Moves a panel or a whole group to an edge of the dock. */
export function dockGroupAt(group: DockviewGroupPanel, edge: "left" | "right" | "top" | "bottom") {
  group.api.moveTo({ position: edge });
}

/** A minimized panel group keeps only its tab strip. It remembers how tall it was. */
const heights = new Map<string, number>();

/** A floating group's height is its window's: the dock doesn't keep the group's own size up to date. */
const heightOf = (group: DockviewGroupPanel) =>
  group.api.location.type === "floating"
    ? (group.element.closest<HTMLElement>(".dv-resize-container")?.offsetHeight ?? group.api.height)
    : group.api.height;

// A few px over the strip: a floating window's border counts too.
export const isMinimized = (group: DockviewGroupPanel) => heightOf(group) <= TAB_STRIP + 6;

/** The other groups in the same column as `group` (or the same row, with `row`). */
function inLineWith(group: DockviewGroupPanel, row = false) {
  const r = group.element.getBoundingClientRect();
  const groups = api?.groups ?? [];
  return groups.filter((g) => {
    if (g === group || g.api.location.type !== "grid") return false;
    const b = g.element.getBoundingClientRect();
    return row
      ? Math.abs(b.top - r.top) < 2 && Math.abs(b.height - r.height) < 2
      : Math.abs(b.left - r.left) < 2 && Math.abs(b.width - r.width) < 2;
  });
}

/** The other groups stacked in the same column as `group`, above and below it. */
const stackedWith = (group: DockviewGroupPanel) => inLineWith(group);

const isFigureAlone = (group: DockviewGroupPanel) => group.panels.length === 1 && group.panels[0].id === "figure";

/**
 * Whether minimizing makes sense: floating, or stacked with another panel that
 * can take the height (not Figura, which keeps one row).
 */
export function canMinimize(group: DockviewGroupPanel) {
  const where = group.api.location.type;
  if (where === "floating") return true;
  if (where !== "grid" || isToolbarGroup(group)) return false;
  if (isMinimized(group)) return true;
  return stackedWith(group).some((g) => !isMinimized(g) && !isFigureAlone(g) && !isToolbarGroup(g));
}

/** Called after a group is minimized or expanded: a floating one tells the dock nothing. */
const minimizeListeners = new Set<() => void>();

export function onMinimizedChange(listener: () => void) {
  minimizeListeners.add(listener);
  return () => void minimizeListeners.delete(listener);
}

export function setMinimized(group: DockviewGroupPanel, minimized: boolean) {
  resize(group, minimized);
  minimizeListeners.forEach((listener) => listener());
}

function resize(group: DockviewGroupPanel, minimized: boolean) {
  if (minimized) heights.set(group.id, heightOf(group));
  const height = minimized ? TAB_STRIP : Math.max(heights.get(group.id) ?? 0, 240);
  if (group.api.location.type !== "floating") {
    group.api.setSize({ height });
    return;
  }
  // A floating window floats again where it is, only shorter or taller.
  const overlay = group.element.closest<HTMLElement>(".dv-resize-container");
  if (!api || !overlay) return;
  api.addFloatingGroup(group, { x: overlay.offsetLeft, y: overlay.offsetTop, width: overlay.offsetWidth, height: height + 2 });
}

