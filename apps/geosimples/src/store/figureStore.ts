import { create, type StateCreator } from "zustand";
import { toast } from "sonner";
import {
  copyName,
  createLibrary,
  emptyDoc,
  latestFigure,
  LIBRARY_KEY,
  uniqueName,
  untitledName,
  type FigureDoc,
  type FigureFile,
  type FigureMeta,
  type Id,
  type KeyValueStorage,
  type OpResult,
} from "@geosimples/core/figure";

export interface Settings {
  /** cm per world unit in every export. */
  scale: number;
  /** Decimal places for measures in automatic labels. */
  decimals: number;
  pngDpi: number;
  pngBackground: "white" | "transparent";
  /** 1 cm grid behind the preview. Never exported. */
  showGrid: boolean;
  /** Keep the whole figure in view as it changes. Zooming or panning turns it off. */
  autoFit: boolean;
}

/** A figure an action would produce, and the elements it adds or changes. */
export interface ActionPreview {
  doc: FigureDoc;
  ids: Id[];
}

/** What dragging in the preview does. Clicking an object always selects it. */
/** What a press or drag in the preview does. "add" puts a point where you click. */
export type CanvasMode = "select" | "pan" | "move" | "add";

const DEFAULT_SETTINGS: Settings = {
  scale: 1,
  decimals: 2,
  pngDpi: 300,
  pngBackground: "white",
  showGrid: true,
  autoFit: true,
};

const HISTORY_LIMIT = 100;
/** Edits with the same key within this window merge into one undo step. */
const COALESCE_MS = 1000;

interface FigureState extends LibrarySlice {
  doc: FigureDoc;
  /** Selected ids in the order they were picked. Order matters for connect and angles. */
  selection: Id[];
  past: FigureDoc[];
  future: FigureDoc[];
  mode: CanvasMode;
  /** Text in the point input. The preview draws what it would create. */
  inputDraft: string;
  /** What an action would produce, shown while its button is hovered. */
  actionPreview: ActionPreview | null;
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
  setMode: (mode: CanvasMode) => void;
  setInputDraft: (text: string) => void;
  setActionPreview: (preview: ActionPreview | null) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

/** The figures on this machine and the actions that switch between them. */
interface LibrarySlice {
  /** The open figure in the library. */
  figureId: string;
  /** Every figure saved on this machine. */
  figures: FigureMeta[];
  newFigure: () => void;
  openFigure: (id: string) => void;
  /** Copies a figure and opens the copy. */
  duplicateFigure: (id: string) => void;
  renameFigure: (id: string, name: string) => void;
  deleteFigure: (id: string) => void;
  /** Adds a figure from a file or link as a new entry and opens it. */
  importFigure: (file: FigureFile) => void;
}

let lastCommit: { key: string; at: number } | null = null;
let transientBase: FigureDoc | null = null;

const pruneSelection = (doc: FigureDoc, selection: Id[]) => {
  const ids = new Set(doc.elements.map((e) => e.id));
  const kept = selection.filter((id) => ids.has(id));
  return kept.length === selection.length ? selection : kept;
};

// --- Library persistence ---------------------------------------------------

/** localStorage, or memory when the browser blocks it (some private modes). */
function browserStorage(): KeyValueStorage {
  try {
    const probe = "geosimples-probe";
    localStorage.setItem(probe, probe);
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    const data = new Map<string, string>();
    return {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
  }
}

const newFigureId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const library = createLibrary(browserStorage(), { now: Date.now, newId: newFigureId });

let storageWarned = false;
/** Runs a library write. A full storage shows one warning instead of breaking the editor. */
function tryWrite<T>(write: () => T): T | null {
  try {
    const result = write();
    storageWarned = false;
    return result;
  } catch {
    if (!storageWarned) {
      storageWarned = true;
      toast.error("Não foi possível salvar neste navegador: o espaço acabou.", {
        description: "Baixe o arquivo da figura ou exclua figuras antigas.",
        duration: 10000,
      });
    }
    return null;
  }
}

function openLibrary() {
  const opened = tryWrite(() => library.open());
  if (opened) return opened;
  // Storage is full or broken: edit in memory. An old single figure stays where it was.
  const now = Date.now();
  const meta: FigureMeta = { id: newFigureId(), name: untitledName([]), createdAt: now, updatedAt: now };
  return { index: { version: 1 as const, activeId: meta.id, figures: [meta], lastUntitled: 1 }, doc: emptyDoc() };
}

const opened = openLibrary();

/** The doc last written for the open figure. Saving skips it. */
let savedDoc: FigureDoc = opened.doc;
let saveTimer: number | undefined;
/** Saves wait for a pause, so a drag doesn't write on every frame. */
const SAVE_DELAY_MS = 300;

function flushSave() {
  window.clearTimeout(saveTimer);
  saveTimer = undefined;
  const { doc, figureId } = useFigureStore.getState();
  if (doc === savedDoc) return;
  savedDoc = doc;
  const index = tryWrite(() => library.save(figureId, doc));
  if (index) useFigureStore.setState({ figures: index.figures });
}

/** A stored figure's doc, for thumbnails and downloads. The open one comes from the store. */
export function loadFigureDoc(id: string): FigureDoc {
  const state = useFigureStore.getState();
  return id === state.figureId ? state.doc : (library.load(id) ?? emptyDoc());
}

/**
 * Adds the library to the store: the open figure comes from it, with an
 * empty undo history, and the library actions switch figures.
 */
function withLibrary(
  init: StateCreator<FigureState, [], [], Omit<FigureState, keyof LibrarySlice>>,
): StateCreator<FigureState> {
  return (set, get, api) => {
    /** Shows another figure. Its undo history starts from it. */
    const show = (figureId: string, doc: FigureDoc, figures: FigureMeta[]) => {
      lastCommit = null;
      transientBase = null;
      savedDoc = doc;
      set((s) => ({
        figureId,
        figures,
        doc,
        past: [],
        future: [],
        selection: [],
        inputDraft: "",
        actionPreview: null,
        // A camera placed for the previous figure means nothing for this one.
        settings: { ...s.settings, autoFit: true },
      }));
    };

    /** Adds a figure and opens it. When it can't be stored it isn't opened, so nothing is lost silently. */
    const addAndOpen = (name: string, doc: FigureDoc) => {
      flushSave();
      const created = tryWrite(() => library.create(name, doc));
      if (created) show(created.meta.id, doc, created.index.figures);
      return created !== null;
    };

    const names = () => get().figures.map((f) => f.name);

    return {
      ...init(set, get, api),
      figureId: opened.index.activeId,
      figures: opened.index.figures,
      // The loaded figure is the starting point of the undo history.
      doc: opened.doc,

      newFigure: () => {
        addAndOpen(library.untitled(), emptyDoc());
      },
      openFigure: (id) => {
        if (id === get().figureId) return;
        flushSave();
        const doc = library.load(id);
        if (!doc) {
          toast.error("Essa figura não está mais salva neste navegador.");
          set({ figures: library.index().figures });
          return;
        }
        const index = tryWrite(() => library.setActive(id));
        show(id, doc, index?.figures ?? get().figures);
      },
      duplicateFigure: (id) => {
        const source = get().figures.find((f) => f.id === id);
        if (!source) return;
        if (addAndOpen(copyName(source.name, names()), loadFigureDoc(id))) toast.success("Cópia criada e aberta");
      },
      renameFigure: (id, name) => {
        const index = tryWrite(() => library.rename(id, name));
        if (index) set({ figures: index.figures });
      },
      deleteFigure: (id) => {
        const index = tryWrite(() => library.remove(id));
        if (!index) return;
        if (id !== get().figureId) {
          set({ figures: index.figures });
          return;
        }
        // The open figure is gone, so its pending save must not bring it back.
        window.clearTimeout(saveTimer);
        savedDoc = get().doc;
        const next = latestFigure(index.figures);
        const doc = next && library.load(next.id);
        if (next && doc) {
          tryWrite(() => library.setActive(next.id));
          show(next.id, doc, index.figures);
        } else {
          set({ figures: index.figures });
          addAndOpen(library.untitled(), emptyDoc());
        }
      },
      importFigure: (file) => {
        addAndOpen(uniqueName(file.name, names()), file.doc);
      },
    };
  };
}

export const useFigureStore = create<FigureState>()(
  withLibrary(
    (set, get) => ({
      doc: emptyDoc(),
      selection: [],
      past: [],
      future: [],
      mode: "select",
      inputDraft: "",
      actionPreview: null,
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
        const picked = result.selected ?? result.created;
        if (select === "created" && picked.length > 0) set({ selection: picked });
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
      setMode: (mode) => set({ mode }),
      setInputDraft: (inputDraft) => set({ inputDraft }),
      setActionPreview: (actionPreview) => set({ actionPreview }),
      setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
    }),
  ),
);

useFigureStore.subscribe((state, prev) => {
  if (state.doc === prev.doc || state.doc === savedDoc) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushSave, SAVE_DELAY_MS);
});

// Closing or hiding the tab must not lose the last edit.
window.addEventListener("pagehide", flushSave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushSave();
});

// Figures added, renamed or deleted in another tab.
window.addEventListener("storage", (e) => {
  if (e.key === LIBRARY_KEY) useFigureStore.setState({ figures: library.index().figures });
});
