import { create, type StateCreator } from "zustand";
import { toast } from "sonner";
import {
  copyName,
  createLibrary,
  emptyDoc,
  latestFigure,
  LIBRARY_KEY,
  deleteElements,
  settleDoc,
  uniqueName,
  untitledName,
  type FigureDoc,
  type FigureFile,
  type FigureMeta,
  type Id,
  type KeyValueStorage,
  type OpResult,
  type QuickFigure,
  type Settled,
  NO_QUICK_FIGURE,
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

/**
 * What a press or drag in the preview does. "add" puts a point where you
 * click; "figure" (Figura rápida) also joins it to the previous one and closes a polygon.
 */
export type CanvasMode = "select" | "pan" | "move" | "add" | "figure";

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
  /** Clicks and taps add to the selection instead of replacing it, as Shift does. */
  multiSelect: boolean;
  /** The figure Figura rápida is drawing. Changing mode finishes it. */
  quickFigure: QuickFigure;

  commit: (doc: FigureDoc, coalesceKey?: string) => void;
  /** Runs an operation on the current figure and selects what it created. */
  run: (op: (doc: FigureDoc, selection: Id[]) => OpResult, select?: "created" | "keep" | "none") => OpResult;
  /** Starts a drag: changes until endTransient are one undo step. */
  beginTransient: () => void;
  /** Shows a drag's figure as a drop would leave it, without the points it would delete. */
  setTransient: (doc: FigureDoc) => void;
  endTransient: () => void;

  toggleSelect: (id: Id) => void;
  /** A click on an object: selects only it, or with `additive` adds or removes it. */
  pick: (id: Id, additive: boolean) => void;
  select: (ids: Id[]) => void;
  clearSelection: () => void;
  selectAll: () => void;

  undo: () => void;
  redo: () => void;
  clear: () => void;
  setMode: (mode: CanvasMode) => void;
  setMultiSelect: (on: boolean) => void;
  setQuickFigure: (figure: QuickFigure) => void;
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

/** "x₁, x₂ e V", or "2 pontos" when they have no names. */
function listNames(names: string[]): string {
  const named = names.filter(Boolean);
  if (named.length < names.length) return names.length === 1 ? "1 ponto" : `${names.length} pontos`;
  return named.length > 1 ? `${named.slice(0, -1).join(", ")} e ${named[named.length - 1]}` : named[0];
}

/**
 * Says which marks went away with what they marked, with a way back, and
 * what's left to mark. The way back only undoes while nothing else changed.
 */
function announce(settled: Settled, store: () => Pick<FigureState, "doc" | "undo">, reported: Id[] = []) {
  const names = settled.dropped.filter((_, i) => !reported.includes(settled.droppedIds[i]));
  const n = names.length;
  if (n > 0) {
    const undo = () => {
      if (store().doc === settled.doc) store().undo();
      else toast("A figura mudou depois disso. Use Desfazer na barra para voltar passo a passo.");
    };
    toast(`${listNames(names)} ${n === 1 ? "foi apagado" : "foram apagados"}: o que ${n === 1 ? "marcava" : "marcavam"} deixou de existir.`, {
      action: { label: "Desfazer", onClick: undo },
    });
  }
  for (const note of settled.notes) toast(note);
}

/** A typed edit waiting to be settled once the typing stops, and the figure it left. */
let pendingSettle: { timer: ReturnType<typeof setTimeout>; doc: FigureDoc } | null = null;

/**
 * Settles a typed edit now instead of when its timer fires: before any other
 * step, so past and future only ever hold settled figures. The deletion
 * joins the typed edit's undo step, which already holds the figure before it.
 */
function flushSettle(get: () => FigureState, set: (partial: Partial<FigureState>) => void): Id[] {
  const pending = pendingSettle;
  if (!pending) return [];
  clearTimeout(pending.timer);
  pendingSettle = null;
  const { doc, past, selection } = get();
  if (doc !== pending.doc) return [];
  const settled = settleDoc(past[past.length - 1] ?? doc, doc);
  if (settled.doc !== doc) set({ doc: settled.doc, selection: pruneSelection(settled.doc, selection) });
  announce(settled, get);
  return settled.droppedIds;
}

/** Forgets a pending settle without running it, for a figure that is going away. */
function dropPendingSettle() {
  if (pendingSettle) clearTimeout(pendingSettle.timer);
  pendingSettle = null;
}
let transientBase: FigureDoc | null = null;
/**
 * The drag's figure with everything in it. The store shows it as a drop there
 * would leave it, so a crossing dragged away hides instead of waiting where it
 * was, and comes back if the drag does.
 */
let transientDoc: FigureDoc | null = null;

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

/** Settles a pending typed edit, then saves: before switching figures or leaving the page. */
function flushSave() {
  flushSettle(useFigureStore.getState, useFigureStore.setState);
  saveNow();
}

/** Writes the open figure as it is. The autosave uses this: settling waits for the typing to stop. */
function saveNow() {
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
      // Callers settled the old figure through flushSave, or dropped it when deleting it.
      lastCommit = null;
      transientBase = null;
      transientDoc = null;
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
        quickFigure: NO_QUICK_FIGURE,
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
        // The open figure is gone, so its pending save (or settle, with its toast) must not bring it back.
        dropPendingSettle();
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
      multiSelect: false,
      quickFigure: NO_QUICK_FIGURE,

      commit: (next, coalesceKey) => {
        if (next === get().doc) return;
        const now = Date.now();
        const merge =
          coalesceKey !== undefined &&
          lastCommit?.key === coalesceKey &&
          now - lastCommit.at < COALESCE_MS &&
          get().past.length > 0;
        // Still typing in the same field: its settle waits for the end. Anything else settles it first.
        let reported: Id[] = [];
        if (merge) dropPendingSettle();
        else reported = flushSettle(get, set);
        const state = get();
        lastCommit = coalesceKey === undefined ? null : { key: coalesceKey, at: now };
        const past = merge ? state.past : [...state.past, state.doc].slice(-HISTORY_LIMIT);
        if (coalesceKey !== undefined) {
          // Fields commit on every keystroke: the "1" on the way to "10" mustn't delete marks for
          // good. Settle once the typing stops, in the same undo step (past already holds the start).
          // `next` may come from the figure before the settle just run, still holding what it deleted.
          const kept = new Set(next.elements.map((e) => e.id));
          const doc = reported.some((id) => kept.has(id)) ? deleteElements(next, reported.filter((id) => kept.has(id))).doc : next;
          set({ doc, past, future: [], selection: pruneSelection(doc, state.selection) });
          pendingSettle = { timer: setTimeout(() => flushSettle(get, set), COALESCE_MS), doc };
          return;
        }
        // Roots, crossings and points on graphs that no longer exist go in the same undo step.
        const settled = settleDoc(state.doc, next);
        const doc = settled.doc;
        set({ doc, past, future: [], selection: pruneSelection(doc, state.selection) });
        // `next` may come from the figure before that settle, holding the points it just reported.
        announce(settled, get, reported);
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
        flushSettle(get, set);
        transientBase = get().doc;
      },
      setTransient: (doc) => {
        transientDoc = doc;
        set({ doc: settleDoc(transientBase ?? doc, doc).doc });
      },
      endTransient: () => {
        const base = transientBase;
        const dragged = transientDoc ?? get().doc;
        transientBase = null;
        transientDoc = null;
        lastCommit = null;
        const { past, selection } = get();
        if (!base || base === dragged) return;
        // Deleted for good only at the drop: until then a lost crossing was just hidden, and could come back.
        const settled = settleDoc(base, dragged);
        const doc = settled.doc;
        set({ doc, past: [...past, base].slice(-HISTORY_LIMIT), future: [], selection: pruneSelection(doc, selection) });
        announce(settled, get);
      },

      toggleSelect: (id) =>
        set((s) => ({
          selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id],
        })),
      pick: (id, additive) => {
        if (additive) get().toggleSelect(id);
        else set({ selection: [id] });
      },
      select: (ids) => set({ selection: ids }),
      clearSelection: () => set({ selection: [] }),
      selectAll: () => set((s) => ({ selection: s.doc.elements.map((e) => e.id) })),

      undo: () => {
        flushSettle(get, set);
        const { past, future, doc, selection } = get();
        if (past.length === 0) return;
        const prev = past[past.length - 1];
        lastCommit = null;
        set({
          doc: prev,
          past: past.slice(0, -1),
          future: [doc, ...future],
          selection: pruneSelection(prev, selection),
          // The figure Figura rápida tracks no longer matches the doc.
          quickFigure: NO_QUICK_FIGURE,
        });
      },
      redo: () => {
        flushSettle(get, set);
        const { past, future, doc, selection } = get();
        if (future.length === 0) return;
        const next = future[0];
        lastCommit = null;
        set({
          doc: next,
          past: [...past, doc],
          future: future.slice(1),
          selection: pruneSelection(next, selection),
          quickFigure: NO_QUICK_FIGURE,
        });
      },
      clear: () => {
        get().commit(emptyDoc());
        set({ selection: [] });
      },
      setMode: (mode) => set({ mode, quickFigure: NO_QUICK_FIGURE }),
      setMultiSelect: (multiSelect) => set({ multiSelect }),
      setQuickFigure: (quickFigure) => set({ quickFigure }),
      setInputDraft: (inputDraft) => set({ inputDraft }),
      setActionPreview: (actionPreview) => set({ actionPreview }),
      setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
    }),
  ),
);

useFigureStore.subscribe((state, prev) => {
  if (state.doc === prev.doc || state.doc === savedDoc) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, SAVE_DELAY_MS);
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
