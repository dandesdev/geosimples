import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { emptyDoc, normalizeDoc, type FigureDoc, type Id, type OpResult } from "@geosimples/core/figure";

export interface Settings {
  /** cm per world unit in every export. */
  scale: number;
  /** Decimal places for measures in automatic labels. */
  decimals: number;
  pngDpi: number;
  pngBackground: "white" | "transparent";
  /** 1 cm grid behind the preview. Never exported. */
  showGrid: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  scale: 1,
  decimals: 2,
  pngDpi: 300,
  pngBackground: "white",
  showGrid: true,
};

function sanitizeSettings(raw: Partial<Settings> | undefined): Settings {
  const r = raw ?? {};
  const num = (x: unknown, min: number, max: number, fallback: number) =>
    typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fallback;
  return {
    scale: num(r.scale, 0.1, 10, DEFAULT_SETTINGS.scale),
    decimals: Math.round(num(r.decimals, 0, 4, DEFAULT_SETTINGS.decimals)),
    pngDpi: num(r.pngDpi, 72, 1200, DEFAULT_SETTINGS.pngDpi),
    pngBackground: r.pngBackground === "transparent" ? "transparent" : "white",
    showGrid: typeof r.showGrid === "boolean" ? r.showGrid : DEFAULT_SETTINGS.showGrid,
  };
}

const HISTORY_LIMIT = 100;
/** Edits with the same key within this window merge into one undo step. */
const COALESCE_MS = 1000;

interface FigureState {
  doc: FigureDoc;
  /** Selected ids in the order they were picked. Order matters for connect and angles. */
  selection: Id[];
  past: FigureDoc[];
  future: FigureDoc[];
  moveMode: boolean;
  settings: Settings;

  commit: (doc: FigureDoc, coalesceKey?: string) => void;
  /** Runs an operation on the current figure and selects what it created. */
  run: (op: (doc: FigureDoc, selection: Id[]) => OpResult, select?: "created" | "keep" | "none") => OpResult;
  /** Starts a drag: changes until endTransient are one undo step. */
  beginTransient: () => void;
  setTransient: (doc: FigureDoc) => void;
  endTransient: () => void;

  toggleSelect: (id: Id) => void;
  select: (ids: Id[]) => void;
  clearSelection: () => void;
  selectAll: () => void;

  undo: () => void;
  redo: () => void;
  clear: () => void;
  setMoveMode: (on: boolean) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

let lastCommit: { key: string; at: number } | null = null;
let transientBase: FigureDoc | null = null;

const pruneSelection = (doc: FigureDoc, selection: Id[]) => {
  const ids = new Set(doc.elements.map((e) => e.id));
  const kept = selection.filter((id) => ids.has(id));
  return kept.length === selection.length ? selection : kept;
};

export const useFigureStore = create<FigureState>()(
  persist(
    (set, get) => ({
      doc: emptyDoc(),
      selection: [],
      past: [],
      future: [],
      moveMode: false,
      settings: DEFAULT_SETTINGS,

      commit: (doc, coalesceKey) => {
        const state = get();
        if (doc === state.doc) return;
        const now = Date.now();
        const merge =
          coalesceKey !== undefined &&
          lastCommit?.key === coalesceKey &&
          now - lastCommit.at < COALESCE_MS &&
          state.past.length > 0;
        lastCommit = coalesceKey === undefined ? null : { key: coalesceKey, at: now };
        set({
          doc,
          past: merge ? state.past : [...state.past, state.doc].slice(-HISTORY_LIMIT),
          future: [],
          selection: pruneSelection(doc, state.selection),
        });
      },

      run: (op, select = "created") => {
        const { doc, selection, commit } = get();
        const result = op(doc, selection);
        if (result.error) return result;
        commit(result.doc);
        if (select === "created" && result.created.length > 0) set({ selection: result.created });
        else if (select === "none") set({ selection: [] });
        return result;
      },

      beginTransient: () => {
        transientBase = get().doc;
      },
      setTransient: (doc) => set({ doc }),
      endTransient: () => {
        const base = transientBase;
        transientBase = null;
        lastCommit = null;
        const { doc, past } = get();
        if (!base || base === doc) return;
        set({ past: [...past, base].slice(-HISTORY_LIMIT), future: [] });
      },

      toggleSelect: (id) =>
        set((s) => ({
          selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id],
        })),
      select: (ids) => set({ selection: ids }),
      clearSelection: () => set({ selection: [] }),
      selectAll: () => set((s) => ({ selection: s.doc.elements.map((e) => e.id) })),

      undo: () => {
        const { past, future, doc, selection } = get();
        if (past.length === 0) return;
        const prev = past[past.length - 1];
        lastCommit = null;
        set({
          doc: prev,
          past: past.slice(0, -1),
          future: [doc, ...future],
          selection: pruneSelection(prev, selection),
        });
      },
      redo: () => {
        const { past, future, doc, selection } = get();
        if (future.length === 0) return;
        const next = future[0];
        lastCommit = null;
        set({
          doc: next,
          past: [...past, doc],
          future: future.slice(1),
          selection: pruneSelection(next, selection),
        });
      },
      clear: () => {
        get().commit(emptyDoc());
        set({ selection: [] });
      },
      setMoveMode: (on) => set({ moveMode: on }),
      setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
    }),
    {
      name: "geosimples-v2",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ doc: s.doc, settings: s.settings }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { doc?: unknown; settings?: Partial<Settings> };
        return {
          ...current,
          // The loaded figure is the starting point of the undo history.
          doc: normalizeDoc(p.doc),
          settings: sanitizeSettings(p.settings),
        };
      },
    },
  ),
);
