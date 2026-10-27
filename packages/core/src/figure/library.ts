import { emptyDoc } from "./defaults";
import { cleanFigureName, FIGURE_NAME_MAX } from "./file";
import { normalizeDoc } from "./normalize";
import type { FigureDoc } from "./types";

/** A figure in the library. Its doc is stored under its own key. */
export interface FigureMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface LibraryIndex {
  version: 1;
  /** The figure to open on the next start. */
  activeId: string;
  figures: FigureMeta[];
}

/** The part of localStorage the library uses, so tests can pass a Map. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const LIBRARY_KEY = "geosimples-library";
/** Where the editor kept its single figure before the library existed. */
export const LEGACY_FIGURE_KEY = "geosimples-v2";
export const figureKey = (id: string) => `geosimples-figure:${id}`;

const UNTITLED = "Figura";

/** "Figura 1", "Figura 2"…: the first one not taken. */
export function untitledName(names: string[]): string {
  const taken = new Set(names);
  for (let n = 1; ; n++) if (!taken.has(`${UNTITLED} ${n}`)) return `${UNTITLED} ${n}`;
}

/** The name itself, or "Name (2)", "Name (3)"… when it is taken. */
export function uniqueName(name: string, names: string[]): string {
  const taken = new Set(names);
  if (!taken.has(name)) return name;
  const base = name.slice(0, FIGURE_NAME_MAX - 6);
  for (let n = 2; ; n++) if (!taken.has(`${base} (${n})`)) return `${base} (${n})`;
}

/** "Name (cópia)", then "Name (cópia 2)"…; copying a copy doesn't stack suffixes. */
export function copyName(name: string, names: string[]): string {
  const base = name.replace(/ \(cópia(?: \d+)?\)$/, "").slice(0, FIGURE_NAME_MAX - 12);
  const taken = new Set(names);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${base} (cópia)` : `${base} (cópia ${n})`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** The most recently edited figure. */
export function latestFigure(figures: FigureMeta[]): FigureMeta | undefined {
  return figures.reduce<FigureMeta | undefined>((best, f) => (!best || f.updatedAt > best.updatedAt ? f : best), undefined);
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const time = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : 0);
const idOk = (x: unknown): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(x);

function parseJson(text: string | null): unknown {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The stored index, cleaned up, or null when there is none. */
export function readIndex(storage: KeyValueStorage): LibraryIndex | null {
  const raw = parseJson(storage.getItem(LIBRARY_KEY));
  if (!isObj(raw) || !Array.isArray(raw.figures)) return null;
  const seen = new Set<string>();
  const figures: FigureMeta[] = [];
  for (const f of raw.figures) {
    if (!isObj(f) || !idOk(f.id) || seen.has(f.id)) continue;
    seen.add(f.id);
    const createdAt = time(f.createdAt);
    figures.push({
      id: f.id,
      name: cleanFigureName(f.name, untitledName(figures.map((x) => x.name))),
      createdAt,
      updatedAt: Math.max(createdAt, time(f.updatedAt)),
    });
  }
  return { version: 1, activeId: idOk(raw.activeId) ? raw.activeId : "", figures };
}

export interface FigureLibrary {
  /**
   * Reads the library for a start of the editor: creates it if missing, moves
   * the old single figure into it, and returns the figure to open.
   */
  open(): { index: LibraryIndex; doc: FigureDoc };
  /** The current index. Read from storage each time, so other tabs' changes count. */
  index(): LibraryIndex;
  /** A figure's doc, or null when it isn't stored. */
  load(id: string): FigureDoc | null;
  /** Stores the doc and marks the figure as just edited. */
  save(id: string, doc: FigureDoc): LibraryIndex;
  /** Adds a figure and makes it the active one. */
  create(name: string, doc: FigureDoc): { meta: FigureMeta; index: LibraryIndex };
  rename(id: string, name: string): LibraryIndex;
  remove(id: string): LibraryIndex;
  setActive(id: string): LibraryIndex;
}

/**
 * The figures saved on this machine. Writes can throw (storage full); a failed
 * create leaves nothing behind.
 */
export function createLibrary(storage: KeyValueStorage, env: { now: () => number; newId: () => string }): FigureLibrary {
  let last: LibraryIndex = { version: 1, activeId: "", figures: [] };

  const current = () => readIndex(storage) ?? last;
  const write = (index: LibraryIndex) => {
    storage.setItem(LIBRARY_KEY, JSON.stringify(index));
    last = index;
    return index;
  };
  const freshMeta = (name: string): FigureMeta => {
    const t = env.now();
    return { id: env.newId(), name, createdAt: t, updatedAt: t };
  };
  const names = (index: LibraryIndex) => index.figures.map((f) => f.name);

  const load = (id: string): FigureDoc | null => {
    const raw = storage.getItem(figureKey(id));
    return raw === null ? null : normalizeDoc(parseJson(raw));
  };

  return {
    open() {
      const stored = readIndex(storage);
      let index = stored ?? last;
      const legacyText = storage.getItem(LEGACY_FIGURE_KEY);
      if (legacyText !== null) {
        const persisted = parseJson(legacyText);
        const legacy = normalizeDoc(isObj(persisted) && isObj(persisted.state) ? persisted.state.doc : null);
        // A figure left by an older open tab is kept too, unless it's empty.
        if (!stored || legacy.elements.length > 0) {
          const meta = freshMeta(untitledName(names(index)));
          storage.setItem(figureKey(meta.id), JSON.stringify(legacy));
          index = { ...index, activeId: stored ? index.activeId : meta.id, figures: [...index.figures, meta] };
        }
      }
      if (index.figures.length === 0) {
        const meta = freshMeta(untitledName([]));
        storage.setItem(figureKey(meta.id), JSON.stringify(emptyDoc()));
        index = { ...index, figures: [meta] };
      }
      if (!index.figures.some((f) => f.id === index.activeId)) {
        index = { ...index, activeId: latestFigure(index.figures)!.id };
      }
      write(index);
      // Only once the figure is safely in the library.
      if (legacyText !== null) storage.removeItem(LEGACY_FIGURE_KEY);
      return { index, doc: load(index.activeId) ?? emptyDoc() };
    },

    index: current,
    load,

    save(id, doc) {
      storage.setItem(figureKey(id), JSON.stringify(doc));
      const index = current();
      const t = env.now();
      const known = index.figures.some((f) => f.id === id);
      // Deleted in another tab while open here: keep it rather than lose the edits.
      const figures = known
        ? index.figures.map((f) => (f.id === id ? { ...f, updatedAt: t } : f))
        : [...index.figures, { id, name: untitledName(names(index)), createdAt: t, updatedAt: t }];
      return write({ ...index, figures });
    },

    create(name, doc) {
      const index = current();
      const meta = freshMeta(cleanFigureName(name, untitledName(names(index))));
      storage.setItem(figureKey(meta.id), JSON.stringify(doc));
      try {
        return { meta, index: write({ ...index, activeId: meta.id, figures: [...index.figures, meta] }) };
      } catch (e) {
        storage.removeItem(figureKey(meta.id));
        throw e;
      }
    },

    rename(id, name) {
      const index = current();
      return write({
        ...index,
        figures: index.figures.map((f) => (f.id === id ? { ...f, name: cleanFigureName(name, f.name) } : f)),
      });
    },

    remove(id) {
      const index = current();
      const next = write({
        ...index,
        activeId: index.activeId === id ? "" : index.activeId,
        figures: index.figures.filter((f) => f.id !== id),
      });
      storage.removeItem(figureKey(id));
      return next;
    },

    setActive(id) {
      return write({ ...current(), activeId: id });
    },
  };
}
