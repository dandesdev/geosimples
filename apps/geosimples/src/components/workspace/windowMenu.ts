import { DOCK_NAMES, DOCKS, useWorkspaceStore, type WindowId } from "@/store/workspaceStore";

export interface WindowMenuItem {
  label: string;
  onSelect: () => void;
  /** Draws a separator above the item. */
  group?: boolean;
}

/**
 * What can be done to a window, for both its title bar's right-click menu and
 * its "more" button: the same list, so neither hides an option.
 * `float` places the window when it leaves its dock.
 */
export function windowMenuItems(id: WindowId, float: () => void): WindowMenuItem[] {
  const ws = useWorkspaceStore.getState();
  const w = ws.windows[id];
  const maximized = ws.maximized === id;
  const items: WindowMenuItem[] = [
    { label: w.collapsed ? "Expandir" : "Minimizar", onSelect: () => ws.setCollapsed(id, !w.collapsed) },
    { label: maximized ? "Restaurar tamanho" : "Maximizar", onSelect: () => ws.setMaximized(maximized ? null : id) },
  ];
  if (w.place !== "float") items.push({ label: "Soltar sobre a prévia", onSelect: float, group: true });
  DOCKS.filter((dock) => dock !== w.place).forEach((dock, i) =>
    items.push({
      label: `Encaixar ${DOCK_NAMES[dock]}`,
      onSelect: () => ws.place(id, dock),
      // A floating window has no "Soltar" item to start this group.
      group: i === 0 && w.place === "float",
    }),
  );
  items.push({ label: "Fechar", onSelect: () => ws.setClosed(id, true), group: true });
  return items;
}
