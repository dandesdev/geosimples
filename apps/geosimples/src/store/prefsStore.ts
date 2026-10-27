import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_STYLES, isValidColor, type OpOptions, type StyleDefaults } from "@geosimples/core/figure";
import { useFigureStore, type CanvasMode } from "@/store/figureStore";

/** Everything a shortcut can trigger. */
export type ActionId =
  | "undo"
  | "redo"
  | "delete"
  | "selectAll"
  | "clearSelection"
  | "modeSelect"
  | "modePan"
  | "modeMove"
  | "connect"
  | "closeContour"
  | "angle"
  | "polygon"
  | "export"
  | "focusInput"
  | "zoomIn"
  | "zoomOut"
  | "toggleAutoFit"
  | "toggleGrid"
  | "help"
  | "settings";

export const ACTION_LABELS: Record<ActionId, string> = {
  undo: "Desfazer",
  redo: "Refazer",
  delete: "Apagar seleção",
  selectAll: "Selecionar tudo",
  clearSelection: "Limpar seleção",
  modeSelect: "Modo selecionar",
  modePan: "Modo mover a vista",
  modeMove: "Modo mover pontos",
  connect: "Ligar pontos em sequência",
  closeContour: "Ligar fechando o contorno",
  angle: "Marcar ângulo",
  polygon: "Polígono / preencher",
  export: "Exportar",
  focusInput: "Ir para a barra de pontos",
  zoomIn: "Aproximar",
  zoomOut: "Afastar",
  toggleAutoFit: "Enquadrar automaticamente",
  toggleGrid: "Mostrar ou esconder a grade",
  help: "Como usar",
  settings: "Configurações",
};

export const DEFAULT_SHORTCUTS: Record<ActionId, string[]> = {
  undo: ["Ctrl+Z"],
  redo: ["Ctrl+Y", "Ctrl+Shift+Z"],
  delete: ["Delete", "Backspace"],
  selectAll: ["Ctrl+A"],
  clearSelection: ["Escape"],
  modeSelect: ["V"],
  modePan: ["H"],
  modeMove: ["M"],
  connect: ["L"],
  closeContour: ["Shift+L"],
  angle: ["A"],
  polygon: ["G"],
  export: ["E"],
  focusInput: ["/"],
  zoomIn: ["+", "="],
  zoomOut: ["-"],
  toggleAutoFit: ["F"],
  toggleGrid: ["Shift+G"],
  help: ["?"],
  settings: ["Ctrl+,"],
};

export interface Prefs {
  styles: StyleDefaults;
  behavior: {
    /** Name new unnamed points A, B, C… */
    autoName: boolean;
    mode: CanvasMode;
    autoFit: boolean;
    showGrid: boolean;
    decimals: number;
  };
  export: {
    scale: number;
    dpi: number;
    background: "white" | "transparent";
  };
  shortcuts: Record<ActionId, string[]>;
}

export const DEFAULT_PREFS: Prefs = {
  styles: DEFAULT_STYLES,
  behavior: { autoName: false, mode: "select", autoFit: true, showGrid: true, decimals: 2 },
  export: { scale: 1, dpi: 300, background: "white" },
  shortcuts: DEFAULT_SHORTCUTS,
};

export const DEFAULT_PROFILE_ID = "default";

export interface Profile {
  id: string;
  name: string;
  prefs: Prefs;
}

interface PrefsState {
  /** The teacher's own profiles. "Padrão" is built in and not stored. */
  profiles: Profile[];
  activeId: string;
  setActive: (id: string) => void;
  /** Copies the active profile into a new one and switches to it. */
  createProfile: (name: string) => string;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
  /** Changes the active profile. Ignored while "Padrão" is active. */
  updatePrefs: (change: (prefs: Prefs) => Prefs) => void;
}

export function activePrefs(state: Pick<PrefsState, "profiles" | "activeId"> = usePrefsStore.getState()): Prefs {
  return state.profiles.find((p) => p.id === state.activeId)?.prefs ?? DEFAULT_PREFS;
}

/** Applies a profile's view and export defaults to the editor. */
export function applyPrefsToSession(prefs: Prefs) {
  const figure = useFigureStore.getState();
  useFigureStore.setState({
    mode: prefs.behavior.mode,
    settings: {
      ...figure.settings,
      scale: prefs.export.scale,
      pngDpi: prefs.export.dpi,
      pngBackground: prefs.export.background,
      decimals: prefs.behavior.decimals,
      showGrid: prefs.behavior.showGrid,
      autoFit: prefs.behavior.autoFit,
    },
  });
}

/** Options for core operations from the active profile. */
export function opOptions(): OpOptions {
  const prefs = activePrefs();
  return { styles: prefs.styles, autoName: prefs.behavior.autoName };
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeId: DEFAULT_PROFILE_ID,

      setActive: (id) => {
        const exists = id === DEFAULT_PROFILE_ID || get().profiles.some((p) => p.id === id);
        const activeId = exists ? id : DEFAULT_PROFILE_ID;
        set({ activeId });
        applyPrefsToSession(activePrefs({ ...get(), activeId }));
      },

      createProfile: (name) => {
        const id = `p${Date.now().toString(36)}`;
        const prefs = structuredClone(activePrefs(get()));
        set((s) => ({ profiles: [...s.profiles, { id, name: name.trim() || "Minha configuração", prefs }], activeId: id }));
        return id;
      },

      renameProfile: (id, name) =>
        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
        })),

      deleteProfile: (id) => {
        const wasActive = get().activeId === id;
        set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }));
        if (wasActive) get().setActive(DEFAULT_PROFILE_ID);
      },

      updatePrefs: (change) => {
        const { activeId, profiles } = get();
        if (activeId === DEFAULT_PROFILE_ID) return;
        set({ profiles: profiles.map((p) => (p.id === activeId ? { ...p, prefs: change(p.prefs) } : p)) });
      },
    }),
    {
      name: "geosimples-prefs",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profiles: s.profiles, activeId: s.activeId }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { profiles?: unknown; activeId?: unknown };
        const profiles = Array.isArray(p.profiles) ? p.profiles.flatMap(sanitizeProfile) : [];
        const activeId =
          typeof p.activeId === "string" && profiles.some((x) => x.id === p.activeId) ? p.activeId : DEFAULT_PROFILE_ID;
        return { ...current, profiles, activeId };
      },
    },
  ),
);

type Raw = Record<string, unknown>;
const isObj = (x: unknown): x is Raw => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, min: number, max: number, fallback: number) =>
  typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fallback;
const bool = (x: unknown, fallback: boolean) => (typeof x === "boolean" ? x : fallback);
const color = (x: unknown, fallback: string) => (typeof x === "string" && isValidColor(x) ? x : fallback);

/** Stored profiles may come from an older version: fill gaps with defaults and drop bad values. */
function sanitizeProfile(raw: unknown): Profile[] {
  if (!isObj(raw) || typeof raw.id !== "string" || typeof raw.name !== "string") return [];
  const r = isObj(raw.prefs) ? raw.prefs : {};
  const d = DEFAULT_PREFS;
  const st = isObj(r.styles) ? r.styles : {};
  const sub = (key: string) => (isObj(st[key]) ? (st[key] as Raw) : {});
  const point = sub("point");
  const stroke = sub("stroke");
  const fill = sub("fill");
  const angle = sub("angle");
  const label = sub("label");
  const angleFill = isObj(angle.fill) ? angle.fill : null;
  const fillOf = (f: Raw) => ({
    color: color(f.color, d.styles.fill.color),
    opacity: num(f.opacity, 0.05, 1, d.styles.fill.opacity),
    pattern: (["solid", "hatch", "crosshatch", "dots"] as const).find((x) => x === f.pattern) ?? "solid",
    angle: num(f.angle, -360, 360, d.styles.fill.angle),
  });
  const styles: StyleDefaults = {
    point: {
      shape: point.shape === "ring" || point.shape === "none" ? point.shape : "dot",
      size: num(point.size, 0.6, 5, d.styles.point.size),
      color: color(point.color, d.styles.point.color),
    },
    stroke: {
      color: color(stroke.color, d.styles.stroke.color),
      width: num(stroke.width, 0.2, 4, d.styles.stroke.width),
      dash: stroke.dash === "dashed" || stroke.dash === "dotted" ? stroke.dash : "solid",
      opacity: num(stroke.opacity, 0.1, 1, 1),
    },
    fill: fillOf(fill),
    polygonFilled: bool(st.polygonFilled, d.styles.polygonFilled),
    angle: {
      radius: num(angle.radius, 6, 40, d.styles.angle.radius),
      arcs: angle.arcs === 2 || angle.arcs === 3 ? angle.arcs : 1,
      rightMark: bool(angle.rightMark, true),
      fill: angleFill ? fillOf(angleFill) : null,
    },
    label: {
      angle: null,
      distance: num(label.distance, 0, 40, d.styles.label.distance),
      size: num(label.size, 6, 24, d.styles.label.size),
      color: color(label.color, d.styles.label.color),
      font: label.font === "sans" ? "sans" : "serif",
    },
    circleRadius: num(st.circleRadius, 0.01, 1e5, d.styles.circleRadius),
  };
  const b = isObj(r.behavior) ? r.behavior : {};
  const e = isObj(r.export) ? r.export : {};
  const sc = isObj(r.shortcuts) ? r.shortcuts : {};
  const shortcuts = Object.fromEntries(
    (Object.keys(DEFAULT_SHORTCUTS) as ActionId[]).map((id) => {
      const list = sc[id];
      return [id, Array.isArray(list) ? list.filter((x): x is string => typeof x === "string").slice(0, 4) : DEFAULT_SHORTCUTS[id]];
    }),
  ) as Record<ActionId, string[]>;
  return [
    {
      id: raw.id,
      name: raw.name.slice(0, 60),
      prefs: {
        styles,
        behavior: {
          autoName: bool(b.autoName, d.behavior.autoName),
          mode: b.mode === "pan" || b.mode === "move" ? b.mode : "select",
          autoFit: bool(b.autoFit, d.behavior.autoFit),
          showGrid: bool(b.showGrid, d.behavior.showGrid),
          decimals: Math.round(num(b.decimals, 0, 4, d.behavior.decimals)),
        },
        export: {
          scale: num(e.scale, 0.1, 10, d.export.scale),
          dpi: num(e.dpi, 72, 1200, d.export.dpi),
          background: e.background === "transparent" ? "transparent" : "white",
        },
        shortcuts,
      },
    },
  ];
}
