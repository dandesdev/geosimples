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
  | "modeAdd"
  | "modeFigure"
  | "toggleMultiSelect"
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
  | "toggleSnap"
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
  modeMove: "Modo mover",
  modeAdd: "Modo adicionar pontos",
  modeFigure: "Modo figura rápida",
  toggleMultiSelect: "Seleção múltipla",
  connect: "Ligar pontos em sequência",
  closeContour: "Ligar fechando o contorno",
  angle: "Marcar ângulo",
  polygon: "Polígono / preencher",
  export: "Exportar",
  focusInput: "Ir para a barra de entrada",
  zoomIn: "Aproximar",
  zoomOut: "Afastar",
  toggleAutoFit: "Enquadrar automaticamente",
  toggleGrid: "Mostrar ou esconder a grade",
  toggleSnap: "Encaixar na grade",
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
  modeAdd: ["P"],
  modeFigure: ["Shift+P"],
  toggleMultiSelect: ["S"],
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
  toggleSnap: ["Shift+S"],
  help: ["?"],
  settings: ["Ctrl+,"],
};

/** What the Rotular automaticamente tool can label, each opted in on its own. */
export type AutoLabelKind = "point" | "segment" | "angle" | "radius" | "area" | "perimeter";
export const AUTO_LABEL_KINDS: AutoLabelKind[] = ["point", "segment", "angle", "radius", "area", "perimeter"];

export interface Prefs {
  styles: StyleDefaults;
  behavior: {
    /** Name new unnamed points A, B, C… */
    autoName: boolean;
    mode: CanvasMode;
    autoFit: boolean;
    showGrid: boolean;
    decimals: number;
    /** Kinds Rotular automaticamente starts with checked. */
    autoLabel: Record<AutoLabelKind, boolean>;
    /** Points added by clicking the preview join the selection. */
    selectAdded: boolean;
    /** Starts the session's Encaixar na grade: points added or moved in the preview land on a grid crossing when near one. */
    snapToGrid: boolean;
    /** Shows the Figura rápida mode in the toolbar. Holding Adicionar pontos opens it either way. */
    quickFigure: boolean;
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
  behavior: {
    autoName: false,
    mode: "select",
    autoFit: true,
    showGrid: true,
    decimals: 2,
    autoLabel: { point: true, segment: false, angle: false, radius: false, area: false, perimeter: false },
    selectAdded: false,
    snapToGrid: true,
    quickFigure: false,
  },
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
  /**
   * Unsaved changes made while "Padrão" is active. "Padrão" itself never
   * changes; the draft is used in its place until saved or discarded.
   */
  draft: Prefs | null;
  setActive: (id: string) => void;
  /** Copies the active profile (or the draft) into a new one and switches to it. */
  createProfile: (name: string) => string;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
  /** Changes the active profile, or the draft while "Padrão" is active. */
  updatePrefs: (change: (prefs: Prefs) => Prefs) => void;
  /** Drops the draft: "Padrão" is used as is again. */
  discardDraft: () => void;
}

type ActiveState = Pick<PrefsState, "profiles" | "activeId" | "draft">;

export function activePrefs(state: ActiveState = usePrefsStore.getState()): Prefs {
  if (state.activeId === DEFAULT_PROFILE_ID) return state.draft ?? DEFAULT_PREFS;
  return state.profiles.find((p) => p.id === state.activeId)?.prefs ?? DEFAULT_PREFS;
}

/** True while "Padrão" is active with unsaved changes. */
export function hasDraft(state: ActiveState = usePrefsStore.getState()): boolean {
  return state.activeId === DEFAULT_PROFILE_ID && state.draft !== null;
}

export const DRAFT_NAME = "Padrão (alterada, não salva)";

/** Name of the profile in use, as shown to the teacher. */
export function activeProfileName(state: ActiveState = usePrefsStore.getState()): string {
  if (state.activeId === DEFAULT_PROFILE_ID) return state.draft ? DRAFT_NAME : "Padrão";
  return state.profiles.find((p) => p.id === state.activeId)?.name ?? "Padrão";
}

/** A free "Configuração N" name for a new profile. */
export function nextProfileName(profiles: Profile[]): string {
  const names = new Set(profiles.map((p) => p.name));
  let n = profiles.length + 1;
  while (names.has(`Configuração ${n}`)) n++;
  return `Configuração ${n}`;
}

// Used by the persist merge, which runs while the store is created: keep these above it.
type Raw = Record<string, unknown>;
const isObj = (x: unknown): x is Raw => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, min: number, max: number, fallback: number) =>
  typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fallback;
const bool = (x: unknown, fallback: boolean) => (typeof x === "boolean" ? x : fallback);

/** Reads the auto-label opt-ins; an area and a perimeter can't share a polygon's one label. */
function autoLabelKinds(raw: unknown, d: Record<AutoLabelKind, boolean>): Record<AutoLabelKind, boolean> {
  const r = isObj(raw) ? raw : {};
  const out = Object.fromEntries(AUTO_LABEL_KINDS.map((k) => [k, bool(r[k], d[k])])) as Record<AutoLabelKind, boolean>;
  if (out.area && out.perimeter) out.perimeter = false;
  return out;
}

const color = (x: unknown, fallback: string) => (typeof x === "string" && isValidColor(x) ? x : fallback);

/** Deep equality for plain JSON data, ignoring key order. */
function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).filter((k) => (a as Raw)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Raw)[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => sameData((a as Raw)[k], (b as Raw)[k]));
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
      snapToGrid: prefs.behavior.snapToGrid,
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
      draft: null,

      setActive: (id) => {
        const exists = id === DEFAULT_PROFILE_ID || get().profiles.some((p) => p.id === id);
        const activeId = exists ? id : DEFAULT_PROFILE_ID;
        set({ activeId });
        applyPrefsToSession(activePrefs({ ...get(), activeId }));
      },

      createProfile: (name) => {
        const id = `p${Date.now().toString(36)}`;
        const state = get();
        const prefs = structuredClone(activePrefs(state));
        // Copying "Padrão" with changes saves the draft: it moves into the new profile.
        const draft = hasDraft(state) ? null : state.draft;
        set((s) => ({
          profiles: [...s.profiles, { id, name: name.trim().slice(0, 60) || "Minha configuração", prefs }],
          activeId: id,
          draft,
        }));
        return id;
      },

      renameProfile: (id, name) =>
        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === id ? { ...p, name: name.trim().slice(0, 60) || p.name } : p)),
        })),

      deleteProfile: (id) => {
        const wasActive = get().activeId === id;
        set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }));
        if (wasActive) get().setActive(DEFAULT_PROFILE_ID);
      },

      updatePrefs: (change) => {
        const { activeId, profiles, draft } = get();
        if (activeId === DEFAULT_PROFILE_ID) {
          const next = change(draft ?? DEFAULT_PREFS);
          // Changing everything back leaves nothing to save.
          set({ draft: sameData(next, DEFAULT_PREFS) ? null : next });
          return;
        }
        set({ profiles: profiles.map((p) => (p.id === activeId ? { ...p, prefs: change(p.prefs) } : p)) });
      },

      discardDraft: () => {
        set({ draft: null });
        if (get().activeId === DEFAULT_PROFILE_ID) applyPrefsToSession(DEFAULT_PREFS);
      },
    }),
    {
      name: "geosimples-prefs",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profiles: s.profiles, activeId: s.activeId, draft: s.draft }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { profiles?: unknown; activeId?: unknown; draft?: unknown };
        const profiles = Array.isArray(p.profiles) ? p.profiles.flatMap(sanitizeProfile) : [];
        const activeId =
          typeof p.activeId === "string" && profiles.some((x) => x.id === p.activeId) ? p.activeId : DEFAULT_PROFILE_ID;
        const draft = isObj(p.draft) ? sanitizePrefs(p.draft) : null;
        return { ...current, profiles, activeId, draft: draft && !sameData(draft, DEFAULT_PREFS) ? draft : null };
      },
    },
  ),
);

/** Stored profiles may come from an older version: fill gaps with defaults and drop bad values. */
function sanitizeProfile(raw: unknown): Profile[] {
  if (!isObj(raw) || typeof raw.id !== "string" || typeof raw.name !== "string") return [];
  return [{ id: raw.id, name: raw.name.slice(0, 60), prefs: sanitizePrefs(raw.prefs) }];
}

/** Stored prefs (a profile's or the draft): fill gaps with defaults and drop bad values. */
function sanitizePrefs(raw: unknown): Prefs {
  const r = isObj(raw) ? raw : {};
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
  return {
    styles,
    behavior: {
      autoName: bool(b.autoName, d.behavior.autoName),
      mode: b.mode === "pan" || b.mode === "move" || b.mode === "add" ? b.mode : "select",
      autoFit: bool(b.autoFit, d.behavior.autoFit),
      showGrid: bool(b.showGrid, d.behavior.showGrid),
      decimals: Math.round(num(b.decimals, 0, 4, d.behavior.decimals)),
      autoLabel: autoLabelKinds(b.autoLabel, d.behavior.autoLabel),
      selectAdded: bool(b.selectAdded, d.behavior.selectAdded),
      snapToGrid: bool(b.snapToGrid, d.behavior.snapToGrid),
      quickFigure: bool(b.quickFigure, d.behavior.quickFigure),
    },
    export: {
      scale: num(e.scale, 0.1, 10, d.export.scale),
      dpi: num(e.dpi, 72, 1200, d.export.dpi),
      background: e.background === "transparent" ? "transparent" : "white",
    },
    shortcuts,
  };
}
