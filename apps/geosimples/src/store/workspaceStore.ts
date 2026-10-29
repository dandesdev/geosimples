import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** "classic" is the default page; "pro" fills the window with a tool column and movable windows. */
export type Layout = "classic" | "pro";
export type Theme = "light" | "dark" | "system";

/** The windows of the pro layout, in their default order. */
export const WINDOW_IDS = ["figure", "properties", "formatting", "labels"] as const;
export type WindowId = (typeof WINDOW_IDS)[number];

export const WINDOW_TITLES: Record<WindowId, string> = {
  figure: "Figura",
  properties: "Propriedades",
  formatting: "Formatação",
  labels: "Rótulos e textos",
};

export const DOCK_NAMES: Record<Dock, string> = {
  left: "à esquerda",
  right: "à direita",
  top: "em cima",
  bottom: "embaixo",
};

/** A window docked on an edge of the work area, or floating over the preview. */
export type Dock = "left" | "right" | "top" | "bottom";
export type Place = Dock | "float";
export const DOCKS: Dock[] = ["left", "right", "top", "bottom"];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WindowState {
  place: Place;
  /** Position in its dock. */
  order: number;
  /** Only the title bar shows. */
  collapsed: boolean;
  /** Hidden; the Janelas menu opens it again. */
  closed: boolean;
  /** Where it floats, in px from the work area's top left. Kept while docked, for the next time it floats. */
  rect: Rect;
  /** Stacking among floating windows: the higher, the more in front. */
  z: number;
}

/** Docks are this many px across: width for left and right, height for top and bottom. */
export type DockSizes = Record<Dock, number>;

export const DOCK_LIMITS = { min: 200, max: 640 };

const DEFAULT_DOCK_SIZES: DockSizes = { left: 320, right: 340, top: 240, bottom: 240 };

function defaultWindows(): Record<WindowId, WindowState> {
  return Object.fromEntries(
    WINDOW_IDS.map((id, i) => [
      id,
      {
        place: "right",
        order: i,
        collapsed: false,
        closed: false,
        rect: { x: 80 + i * 32, y: 60 + i * 32, w: 320, h: 420 },
        z: i,
      },
    ]),
  ) as Record<WindowId, WindowState>;
}

interface WorkspaceState {
  layout: Layout;
  theme: Theme;
  /** In the pro layout, the point input slides away until the pointer nears the bottom or it gets focus. */
  inputAutoHide: boolean;
  windows: Record<WindowId, WindowState>;
  docks: DockSizes;
  /** The window filling the work area, if any. */
  maximized: WindowId | null;
  setLayout: (layout: Layout) => void;
  setTheme: (theme: Theme) => void;
  setInputAutoHide: (on: boolean) => void;
  /** Docks a window at `index` in a dock (the end by default), or floats it at `rect`. */
  place: (id: WindowId, place: Place, opts?: { index?: number; rect?: Rect }) => void;
  setRect: (id: WindowId, rect: Rect) => void;
  setCollapsed: (id: WindowId, collapsed: boolean) => void;
  setClosed: (id: WindowId, closed: boolean) => void;
  setMaximized: (id: WindowId | null) => void;
  /** Brings a floating window to the front. */
  focus: (id: WindowId) => void;
  setDockSize: (dock: Dock, size: number) => void;
  resetWindows: () => void;
}

/** Windows in a dock, top to bottom or left to right. */
export function docked(windows: Record<WindowId, WindowState>, dock: Dock): WindowId[] {
  return WINDOW_IDS.filter((id) => windows[id].place === dock && !windows[id].closed).sort(
    (a, b) => windows[a].order - windows[b].order,
  );
}

const clampDock = (size: number) => Math.round(Math.min(DOCK_LIMITS.max, Math.max(DOCK_LIMITS.min, size)));

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      layout: "classic",
      theme: "light",
      inputAutoHide: true,
      windows: defaultWindows(),
      docks: DEFAULT_DOCK_SIZES,
      maximized: null,
      setLayout: (layout) => set({ layout }),
      setTheme: (theme) => set({ theme }),
      setInputAutoHide: (inputAutoHide) => set({ inputAutoHide }),
      place: (id, place, opts = {}) =>
        set((s) => {
          const windows = { ...s.windows };
          const top = Math.max(...WINDOW_IDS.map((w) => windows[w].z)) + 1;
          const current = windows[id];
          if (place === "float") {
            windows[id] = { ...current, place, closed: false, rect: opts.rect ?? current.rect, z: top };
          } else {
            // Renumber the dock with the window inserted, so orders stay 0, 1, 2…
            const others = docked(windows, place).filter((w) => w !== id);
            const index = Math.min(Math.max(opts.index ?? others.length, 0), others.length);
            others.splice(index, 0, id);
            others.forEach((w, order) => {
              windows[w] = { ...windows[w], order };
            });
            windows[id] = { ...windows[id], place, closed: false };
          }
          return { windows, maximized: s.maximized === id ? null : s.maximized };
        }),
      setRect: (id, rect) => set((s) => ({ windows: { ...s.windows, [id]: { ...s.windows[id], rect } } })),
      setCollapsed: (id, collapsed) =>
        set((s) => ({
          windows: { ...s.windows, [id]: { ...s.windows[id], collapsed } },
          maximized: collapsed && s.maximized === id ? null : s.maximized,
        })),
      setClosed: (id, closed) =>
        set((s) => ({
          windows: { ...s.windows, [id]: { ...s.windows[id], closed, collapsed: closed ? s.windows[id].collapsed : false } },
          maximized: closed && s.maximized === id ? null : s.maximized,
        })),
      setMaximized: (maximized) =>
        set((s) => ({
          maximized,
          windows: maximized ? { ...s.windows, [maximized]: { ...s.windows[maximized], collapsed: false } } : s.windows,
        })),
      focus: (id) =>
        set((s) => {
          const top = Math.max(...WINDOW_IDS.map((w) => s.windows[w].z));
          if (s.windows[id].z === top) return s;
          return { windows: { ...s.windows, [id]: { ...s.windows[id], z: top + 1 } } };
        }),
      setDockSize: (dock, size) => set((s) => ({ docks: { ...s.docks, [dock]: clampDock(size) } })),
      resetWindows: () => set({ windows: defaultWindows(), docks: DEFAULT_DOCK_SIZES, maximized: null }),
    }),
    {
      name: "geosimples-workspace",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Saved data from an older build may miss windows added since.
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<WorkspaceState>;
        const windows = { ...current.windows };
        for (const id of WINDOW_IDS) if (s.windows?.[id]) windows[id] = { ...windows[id], ...s.windows[id] };
        return { ...current, ...s, windows, docks: { ...current.docks, ...s.docks } };
      },
    },
  ),
);
