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
/** How close (px) to an edge of the window a drag must come to dock on it: less than a tab strip, so tabs at the top still take drops. */
export const EDGE_REACH = 12;

/** The overlay for an edge of the window, as big as what is dragged will be once dropped. */
export const edgeOverlay = (toolbar: boolean) => ({
  activationSize: { type: "pixels" as const, value: EDGE_REACH },
  size: { type: "pixels" as const, value: toolbar ? TOOLBAR_SIZE : EDGE_PANEL },
});

/**
 * Panel widths are the user's: a panel column keeps the width it was given
 * (by its splitter, or by the drop that made it) whatever else moves, and the
 * preview takes the difference. Left alone, the dock hands any freed or
 * clamped width to the last column, so the right panels grew when a toolbar moved.
 */
const widths = new Map<string, number>();
/** While a drop or a splitter drag is settling, widths are recorded, not restored. */
let settling = false;
const widthTried = new Map<string, string>();

/**
 * A panel group whose width is kept: in the grid, not the preview nor a
 * toolbar, not spanning the window, and not stacked with the preview (its
 * width is the preview's then).
 */
function keepsWidth(target: DockviewApi, group: DockviewGroupPanel) {
  return (
    group.api.location.type === "grid" &&
    !isPreviewGroup(group) &&
    !isToolbarGroup(group) &&
    group.api.width < target.width * 0.9 &&
    !inLineWith(group).some(isPreviewGroup)
  );
}

/** Takes the current widths as the ones to keep, for `groups` or for every panel. */
export function recordWidths(target: DockviewApi, groups: DockviewGroupPanel[] = target.groups) {
  for (const g of groups) if (keepsWidth(target, g)) widths.set(g.id, g.api.width);
}

/** Puts panel columns back to the widths they were given. Runs after every layout change. */
export function keepWidths(target: DockviewApi) {
  if (settling || target.hasMaximizedGroup()) return;
  for (const g of target.groups) {
    if (!keepsWidth(target, g)) continue;
    const now = Math.round(g.api.width);
    // A group new to a column (a tab group, one dropped above or below) takes the column's width.
    const mate = inLineWith(g).find((m) => widths.has(m.id));
    const was = widths.get(g.id) ?? (mate ? widths.get(mate.id) : undefined);
    if (was === undefined) {
      widths.set(g.id, now);
      continue;
    }
    widths.set(g.id, was);
    if (Math.abs(now - was) <= 1) {
      widthTried.delete(g.id);
      continue;
    }
    // One try per width: a window too narrow to give it back must not loop.
    const key = `${now}>${Math.round(was)}`;
    if (widthTried.get(g.id) === key) continue;
    widthTried.set(g.id, key);
    g.api.setSize({ width: was });
  }
}

/**
 * Lets a drop (or a splitter drag) settle, then keeps what it changed on
 * purpose (`changed`: the group dropped and the one it split) and puts every
 * other panel column back. `edge` is the window edge a group was dropped on:
 * it then takes the size its overlay showed.
 */
export function settle(target: DockviewApi, changed: () => (DockviewGroupPanel | undefined)[], edge?: string) {
  settling = true;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const groups = changed().filter((g): g is DockviewGroupPanel => !!g);
      if (edge) {
        const across = edge === "left" || edge === "right" ? "width" : "height";
        for (const g of groups) if (!isToolbarGroup(g)) g.api.setSize({ [across]: EDGE_PANEL });
      }
      recordWidths(target, groups);
      settling = false;
      keepWidths(target);
    }),
  );
}

/** Splitters change widths on purpose: while one is dragged, widths are taken, not restored. */
export function settleSplitter(target: DockviewApi) {
  settling = true;
  const done = () => {
    window.removeEventListener("pointerup", done);
    window.removeEventListener("pointercancel", done);
    recordWidths(target);
    settling = false;
  };
  window.addEventListener("pointerup", done);
  window.addEventListener("pointercancel", done);
}

/**
 * Whether dropping on `position` of `group` would put two panels side by side
 * inside one column (or one over the other inside one row). Panels dock on any
 * edge of the window, as tabs, or above and below each other, but a column
 * never splits into narrower columns.
 */
export function splitsLine(group: DockviewGroupPanel | undefined, position: string) {
  if (!group || group.api.location.type !== "grid" || isPreviewGroup(group)) return false;
  // A group as tall as the dock is a column of its own: it splits freely.
  const fullHeight = !!api && group.api.height >= api.height - 2;
  if (position === "left" || position === "right") return !fullHeight && inLineWith(group).length > 0;
  // A row is panels side by side, touching; the preview, toolbars, or a panel across the window don't make one.
  if (position === "top" || position === "bottom") {
    const r = group.element.getBoundingClientRect();
    return (
      !fullHeight &&
      inLineWith(group, true).some((g) => {
        const b = g.element.getBoundingClientRect();
        const touches = Math.abs(b.left - r.right) < 2 || Math.abs(b.right - r.left) < 2;
        return touches && !isPreviewGroup(g) && !isToolbarGroup(g);
      })
    );
  }
  return false;
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
  if (Math.abs(now - height) <= 1) {
    figureTried = -1;
    return;
  }
  if (figureTried === now) return;
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
  target.addPanel({ ...panelOptions("tools-mode"), position: { referencePanel: "tools-build", direction: "below" } });
  target.addPanel({ ...panelOptions("figure"), position: { referencePanel: PREVIEW_ID, direction: "right" }, initialWidth: RIGHT_COLUMN });
  target.addPanel({ ...panelOptions("properties"), position: { referencePanel: "figure", direction: "below" } });
  target.addPanel({ ...panelOptions("formatting"), position: { referencePanel: "properties", direction: "below" } });
  target.addPanel({ ...panelOptions("labels"), position: { referencePanel: "formatting", direction: "within" }, inactive: true });
  prepareGroups(target);
  // Figura is one row of buttons. The toolbars fit their buttons once they are drawn; the last takes the rest.
  fitFigure(target);
  widths.clear();
  recordWidths(target);
  requestAnimationFrame(() => requestAnimationFrame(() => fitToolbars(target)));
}

/** Restores the saved arrangement, or builds the default one if there is none or it can't be read. */
export function restoreLayout(target: DockviewApi) {
  const saved = useWorkspaceStore.getState().dock;
  if (saved) {
    try {
      target.fromJSON(saved as Parameters<DockviewApi["fromJSON"]>[0]);
      const known = target.panels.every((p) => p.id === PREVIEW_ID || (DOCK_ITEM_IDS as string[]).includes(p.id));
      if (target.getPanel(PREVIEW_ID) && known) {
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

/**
 * A toolbar lies across when it is wider than tall: then its grip goes on the
 * left, not on top. Floating, it always lies down (and the dock doesn't keep a
 * floating group's size up to date anyway).
 */
export function toolbarIsRow(group: DockviewGroupPanel) {
  return group.api.location.type !== "floating" && group.api.width > group.api.height;
}

/** How each toolbar group was last shaped, so a layout change that doesn't move it leaves it alone. */
const shaped = new Map<string, string>();

/** Puts a toolbar's grip on the side it reads from, and holds it to one button across. */
export function orientToolbar(group: DockviewGroupPanel) {
  const row = toolbarIsRow(group);
  const where = group.api.location.type;
  const key = `${row ? "row" : "column"} ${where}`;
  if (shaped.get(group.id) === key) return false;
  shaped.set(group.id, key);
  // Its length limits were for the other way: they are measured again.
  limited.delete(group.id);
  if (group.api.getHeaderPosition() !== (row ? "left" : "top")) group.api.setHeaderPosition(row ? "left" : "top");
  if (where !== "grid") return true;
  group.api.setConstraints(
    // Every limit is set: a toolbar that turned must lose the ones it had the other way.
    row
      ? { minimumHeight: TOOLBAR_SIZE, maximumHeight: TOOLBAR_SIZE, minimumWidth: GRIP_SIZE + TOOLBAR_SIZE, maximumWidth: Number.MAX_SAFE_INTEGER }
      : { minimumWidth: TOOLBAR_SIZE, maximumWidth: TOOLBAR_SIZE, minimumHeight: GRIP_SIZE + TOOLBAR_SIZE, maximumHeight: Number.MAX_SAFE_INTEGER },
  );
  return true;
}

/**
 * A toolbar being dropped lets go of the limits its old place gave it, so its
 * new place decides its shape: kept 48 px wide and as tall as its buttons, a
 * toolbar dropped into a row would never turn to lie across.
 */
export function releaseToolbar(group: DockviewGroupPanel) {
  shaped.delete(group.id);
  limited.delete(group.id);
  group.api.setConstraints({
    minimumWidth: TOOLBAR_SIZE,
    maximumWidth: Number.MAX_SAFE_INTEGER,
    minimumHeight: TOOLBAR_SIZE,
    maximumHeight: Number.MAX_SAFE_INTEGER,
  });
}

export function orientToolbars(target: DockviewApi) {
  let turned = false;
  for (const group of target.groups) if (isToolbarGroup(group) && orientToolbar(group)) turned = true;
  // A toolbar that turned held its old size limits until now: widths it blocked can be put back again.
  if (turned) widthTried.clear();
}

/** How long a toolbar's buttons are, grip included, along the way it lies. */
function toolbarLength(group: DockviewGroupPanel, row: boolean) {
  const body = document.querySelector<HTMLElement>(`[data-toolbar="${group.activePanel?.id}"]`);
  if (!body) return null;
  return (row ? body.scrollWidth : body.scrollHeight) + GRIP_SIZE;
}

/** The length limits each toolbar was last given, so a change that keeps them doesn't set them again. */
const limited = new Map<string, string>();

/**
 * Every button of a toolbar is always in view: a toolbar is never shorter than
 * its buttons. Toolbars that share a column (or a row) with only other
 * toolbars are exactly that long, and the last one takes what is left, so
 * dragging between them can't push one out of the window. Run after every
 * change, so a line refits when a toolbar leaves, arrives or turns.
 */
export function fitToolbars(target: DockviewApi) {
  for (const group of target.groups) {
    if (!isToolbarGroup(group)) continue;
    if (group.api.location.type === "floating") {
      fitFloatingToolbar(group);
      continue;
    }
    if (group.api.location.type !== "grid") continue;
    const row = toolbarIsRow(group);
    const want = toolbarLength(group, row);
    if (want === null) continue;
    const line = [group, ...inLineWith(group, row)];
    const start = (g: DockviewGroupPanel) => g.element.getBoundingClientRect()[row ? "left" : "top"];
    line.sort((a, b) => start(a) - start(b));
    const exact = line.length > 1 && line.every(isToolbarGroup) && line.at(-1) !== group;
    const max = exact ? want : Number.MAX_SAFE_INTEGER;
    const key = `${want} ${max}`;
    if (limited.get(group.id) === key) continue;
    limited.set(group.id, key);
    group.api.setConstraints(row ? { minimumWidth: want, maximumWidth: max } : { minimumHeight: want, maximumHeight: max });
    const now = Math.round(row ? group.api.width : group.api.height);
    if (now < want || now > max) group.api.setSize(row ? { width: want } : { height: want });
  }
}

/** A floating toolbar is as long as its buttons, and not resized by hand (dock.css hides its handles). */
function fitFloatingToolbar(group: DockviewGroupPanel) {
  const overlay = group.element.closest<HTMLElement>(".dv-resize-container");
  const height = floatingToolbarHeight(group);
  if (!api || !overlay || height === null || Math.abs(overlay.offsetHeight - height) <= 1) return;
  api.addFloatingGroup(group, { x: overlay.offsetLeft, y: overlay.offsetTop, width: TOOLBAR_SIZE + 2, height });
}

/** A floating toolbar lies down, as long as its buttons and grip, plus its window's border. */
function floatingToolbarHeight(group: DockviewGroupPanel) {
  const body = document.querySelector<HTMLElement>(`[data-toolbar="${group.activePanel?.id}"]`);
  return body ? Math.min(body.scrollHeight + GRIP_SIZE + 2, (api?.height ?? Infinity) - 40) : null;
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
  // A toolbar floats down, as long as its buttons; a panel keeps a readable size.
  const width = toolbar ? TOOLBAR_SIZE + 2 : Math.min(Math.max(group.api.width, 260), 340);
  const height = toolbar ? (floatingToolbarHeight(group) ?? 300) : Math.min(Math.max(group.api.height, 220), 460);
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

