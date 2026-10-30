import type { DockviewGroupPanel, IDockviewPanel } from "dockview-react";
import { DOCK_ITEM_TITLES, type DockItemId } from "@/store/workspaceStore";
import { canMinimize, dockApi, dockGroupAt, floatItem, isMinimized, isToolbarGroup, setMinimized } from "./dock";

export interface PanelMenuItem {
  label: string;
  onSelect: () => void;
  /** Draws a separator above the item. */
  group?: boolean;
}

const EDGES = [
  ["left", "à esquerda"],
  ["right", "à direita"],
  ["top", "em cima"],
  ["bottom", "embaixo"],
] as const;

/**
 * What can be done to a panel group (or toolbar), for its tab's right-click
 * menu and its "more" button: the same list, so neither hides an option.
 * `panel` is the tab the menu was opened on, if any.
 */
export function panelMenuItems(group: DockviewGroupPanel, panel?: IDockviewPanel): PanelMenuItem[] {
  const api = dockApi();
  if (!api) return [];
  const floating = group.api.location.type === "floating";
  const toolbar = isToolbarGroup(group);
  const items: PanelMenuItem[] = [];
  if (!toolbar && canMinimize(group)) {
    const minimized = isMinimized(group);
    items.push({ label: minimized ? "Expandir" : "Minimizar", onSelect: () => setMinimized(group, !minimized) });
  }
  if (!toolbar && !floating) {
    const maximized = group.api.isMaximized();
    items.push({
      label: maximized ? "Restaurar tamanho" : "Maximizar",
      onSelect: () => (maximized ? group.api.exitMaximized() : group.api.maximize()),
    });
  }
  if (!floating) items.push({ label: "Soltar sobre a prévia", onSelect: () => floatItem(group), group: items.length > 0 });
  EDGES.forEach(([edge, name], i) =>
    items.push({
      label: `Encaixar ${name}`,
      onSelect: () => dockGroupAt(group, edge),
      // A floating group has no "Soltar" item to start this group.
      group: i === 0 && floating && items.length > 0,
    }),
  );
  const target = panel ?? group.activePanel;
  if (target) {
    const title = DOCK_ITEM_TITLES[target.id as DockItemId] ?? target.title ?? "";
    items.push({ label: group.panels.length > 1 ? `Fechar ${title}` : "Fechar", onSelect: () => target.api.close(), group: true });
  }
  return items;
}
