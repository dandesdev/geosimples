import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** "classic" is the default page; "pro" fills the window with panels that dock, tab and float. */
export type Layout = "classic" | "pro";
export type Theme = "light" | "dark" | "system";
/** Colors of PNG and SVG exports: as printed, or as the theme shows the figure. */
export type ExportColors = "print" | "theme";

/** The pro layout's panels, in their default order down the right side. */
export const PANEL_IDS = ["tools", "figure", "ready", "properties", "formatting", "labels"] as const;
export type PanelId = (typeof PANEL_IDS)[number];

export const PANEL_TITLES: Record<PanelId, string> = {
  tools: "Ferramentas",
  figure: "Figura",
  ready: "Prontos",
  properties: "Propriedades",
  formatting: "Formatação",
  labels: "Rótulos",
};

/**
 * The pro layout's toolbars: the tool column, in pieces that dock and float on
 * their own. Each is one kind of button, so none needs a divider inside.
 */
export const TOOLBAR_IDS = ["tools-file", "tools-mode", "tools-app"] as const;
export type ToolbarId = (typeof TOOLBAR_IDS)[number];

export const TOOLBAR_TITLES: Record<ToolbarId, string> = {
  "tools-file": "Arquivo e histórico",
  "tools-mode": "Modo",
  "tools-app": "Janelas e ajuda",
};

/** Everything the Janelas menu opens and closes. */
export type DockItemId = PanelId | ToolbarId;
export const DOCK_ITEM_IDS: DockItemId[] = [...PANEL_IDS, ...TOOLBAR_IDS];
export const DOCK_ITEM_TITLES: Record<DockItemId, string> = { ...PANEL_TITLES, ...TOOLBAR_TITLES };

export const isToolbar = (id: string): id is ToolbarId => (TOOLBAR_IDS as readonly string[]).includes(id);

interface WorkspaceState {
  layout: Layout;
  theme: Theme;
  exportColors: ExportColors;
  /** In the pro layout, the point input slides away until the pointer nears the bottom or it gets focus. */
  inputAutoHide: boolean;
  /** The pro layout's arrangement, as the dock saves it. Null means the default arrangement. */
  dock: object | null;
  /** In the pro layout, Ferramentas is a bar of icons in a column of its own instead of a panel of tiles. */
  toolsBar: boolean;
  /** Panels and toolbars open in the pro layout right now, and those in view (not a hidden tab). Not saved: the dock reports them. */
  open: DockItemId[];
  visible: DockItemId[];
  setLayout: (layout: Layout) => void;
  setTheme: (theme: Theme) => void;
  setExportColors: (colors: ExportColors) => void;
  setInputAutoHide: (on: boolean) => void;
  setDock: (dock: object | null) => void;
  setToolsBar: (on: boolean) => void;
  setDockState: (open: DockItemId[], visible: DockItemId[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      layout: "classic",
      theme: "light",
      exportColors: "print",
      inputAutoHide: true,
      dock: null,
      toolsBar: true,
      open: [],
      visible: [],
      setLayout: (layout) => set({ layout }),
      setTheme: (theme) => set({ theme }),
      setExportColors: (exportColors) => set({ exportColors }),
      setInputAutoHide: (inputAutoHide) => set({ inputAutoHide }),
      setDock: (dock) => set({ dock }),
      setToolsBar: (toolsBar) => set({ toolsBar }),
      setDockState: (open, visible) => set({ open, visible }),
    }),
    {
      name: "geosimples-workspace",
      storage: createJSONStorage(() => localStorage),
      version: 4,
      partialize: ({ layout, theme, exportColors, inputAutoHide, dock, toolsBar }) => ({ layout, theme, exportColors, inputAutoHide, dock, toolsBar }),
      // Version 1 kept its own window positions, versions 2 and 3 had other toolbars and panels: the dock starts from its default arrangement.
      migrate: (saved) => {
        const { layout, theme, inputAutoHide } = (saved ?? {}) as Partial<WorkspaceState>;
        const kept = Object.entries({ layout, theme, inputAutoHide }).filter(([, v]) => v !== undefined);
        return { ...Object.fromEntries(kept), dock: null } as WorkspaceState;
      },
    },
  ),
);
