import { describe, expect, it } from "vitest";
import {
  addPoints,
  base64UrlToBytes,
  bytesToBase64Url,
  cleanFigureName,
  connectPoints,
  copyName,
  createLibrary,
  decodeShareToken,
  emptyDoc,
  encodeShareToken,
  figureFileName,
  figureFileText,
  figureKey,
  LEGACY_FIGURE_KEY,
  LIBRARY_KEY,
  nameFromFileName,
  parseFigureFile,
  readIndex,
  shareTokenFromHash,
  shareUrl,
  uniqueName,
  untitledName,
  type FigureDoc,
  type KeyValueStorage,
} from "./index";

function triangle(): FigureDoc {
  const points = addPoints(emptyDoc(), [
    { label: "A", x: 0, y: 0 },
    { label: "B", x: 4, y: 0 },
    { label: "C", x: 0, y: 3 },
  ]);
  return connectPoints(points.doc, points.created, true).doc;
}

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

// Shared, so libraries opened on the same storage never reuse an id.
let n = 0;

function setup(storage = new MemoryStorage()) {
  let clock = 1000;
  const library = createLibrary(storage, { now: () => ++clock, newId: () => `f${++n}` });
  return { storage, library };
}

describe("figure files", () => {
  it("round-trips a figure with its name", () => {
    const doc = triangle();
    const parsed = parseFigureFile(figureFileText({ name: "Triângulo", doc }), "x");
    expect(parsed).toEqual({ ok: true, file: { name: "Triângulo", doc }, dropped: 0 });
  });

  it("opens a bare FigureDoc with the fallback name", () => {
    const parsed = parseFigureFile(JSON.stringify(triangle()), "Do arquivo");
    expect(parsed.ok && parsed.file.name).toBe("Do arquivo");
    expect(parsed.ok && parsed.file.doc.elements.length).toBe(triangle().elements.length);
  });

  it("drops invalid elements and counts them", () => {
    const doc = triangle();
    const raw = { ...doc, elements: [...doc.elements, { type: "segment", id: "s9", a: doc.elements[0].id, b: "Z" }, 42] };
    const parsed = parseFigureFile(JSON.stringify({ kind: "geosimples-figure", version: 1, name: "T", doc: raw }), "x");
    expect(parsed.ok && parsed.dropped).toBe(2);
    expect(parsed.ok && parsed.file.doc).toEqual(doc);
  });

  it("rejects text that isn't a figure", () => {
    expect(parseFigureFile("not json", "x").ok).toBe(false);
    expect(parseFigureFile("[1,2]", "x").ok).toBe(false);
    expect(parseFigureFile('{"kind":"geosimples-figure","name":"x"}', "x").ok).toBe(false);
  });

  it("cleans names and file names", () => {
    expect(cleanFigureName("  Questão\n 3 ", "x")).toBe("Questão 3");
    expect(cleanFigureName("   ", "Figura 1")).toBe("Figura 1");
    expect(cleanFigureName(5, "Figura 1")).toBe("Figura 1");
    expect(cleanFigureName("a".repeat(200), "x")).toHaveLength(80);
    expect(figureFileName('Prova 2: "ângulos"/B')).toBe("Prova 2 ângulosB.geosimples.json");
    expect(figureFileName("...")).toBe("figura.geosimples.json");
    expect(nameFromFileName("Triângulo.geosimples.json")).toBe("Triângulo");
    expect(nameFromFileName("old.JSON")).toBe("old");
  });
});

describe("share links", () => {
  it("encodes bytes as base64url and back", () => {
    for (let len = 0; len < 10; len++) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 97 + 251) % 256);
      const text = bytesToBase64Url(bytes);
      expect(text).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(base64UrlToBytes(text)).toEqual(bytes);
    }
    expect(bytesToBase64Url(Uint8Array.from([251, 255]))).toBe("-_8");
    expect(base64UrlToBytes("ab+c")).toBeNull();
    expect(base64UrlToBytes("abcde")).toBeNull();
  });

  it("round-trips a figure through a share token", async () => {
    const doc = triangle();
    const token = await encodeShareToken({ name: "Ângulo reto", doc });
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    // Deflate keeps links short: much smaller than the JSON.
    expect(token.length).toBeLessThan(JSON.stringify(doc).length / 2);
    const decoded = await decodeShareToken(token, "x");
    expect(decoded).toEqual({ ok: true, file: { name: "Ângulo reto", doc }, dropped: 0 });
  });

  it("reports damaged tokens instead of throwing", async () => {
    const token = await encodeShareToken({ name: "T", doc: triangle() });
    expect((await decodeShareToken(token.slice(0, token.length / 2), "x")).ok).toBe(false);
    expect((await decodeShareToken("!!!", "x")).ok).toBe(false);
    expect((await decodeShareToken("", "x")).ok).toBe(false);
    expect((await decodeShareToken(bytesToBase64Url(Uint8Array.from([1, 2, 3, 4])), "x")).ok).toBe(false);
  });

  it("finds the token in the hash and builds the link", () => {
    expect(shareTokenFromHash("#figura=abc-_")).toBe("abc-_");
    expect(shareTokenFromHash("#x=1&figura=abc")).toBe("abc");
    expect(shareTokenFromHash("#figura=")).toBeNull();
    expect(shareTokenFromHash("")).toBeNull();
    expect(shareUrl("https://geo.app/?a=1#old", "tok")).toBe("https://geo.app/?a=1#figura=tok");
  });
});

describe("figure library", () => {
  it("names new figures and copies", () => {
    expect(untitledName([])).toBe("Figura 1");
    expect(untitledName(["Figura 1", "Figura 3"])).toBe("Figura 2");
    expect(uniqueName("T", ["T", "T (2)"])).toBe("T (3)");
    expect(uniqueName("T", [])).toBe("T");
    expect(copyName("T", ["T"])).toBe("T (cópia)");
    expect(copyName("T (cópia)", ["T", "T (cópia)"])).toBe("T (cópia 2)");
  });

  it("starts with one empty figure", () => {
    const { library, storage } = setup();
    const { index, doc } = library.open();
    expect(index.figures).toHaveLength(1);
    expect(index.figures[0].name).toBe("Figura 1");
    expect(index.activeId).toBe(index.figures[0].id);
    expect(doc).toEqual(emptyDoc());
    expect(storage.getItem(figureKey(index.activeId))).not.toBeNull();
  });

  it("moves the old single figure into the library", () => {
    const storage = new MemoryStorage();
    const doc = triangle();
    storage.setItem(LEGACY_FIGURE_KEY, JSON.stringify({ state: { doc }, version: 1 }));
    const { library } = setup(storage);
    const opened = library.open();
    expect(opened.doc).toEqual(doc);
    expect(opened.index.figures.map((f) => f.name)).toEqual(["Figura 1"]);
    expect(storage.getItem(LEGACY_FIGURE_KEY)).toBeNull();
    // Opening again doesn't add anything.
    const again = setup(storage).library.open();
    expect(again.index.figures).toHaveLength(1);
    expect(again.doc).toEqual(doc);
  });

  it("keeps a figure an older tab wrote after the move", () => {
    const { library, storage } = setup();
    const first = library.open();
    storage.setItem(LEGACY_FIGURE_KEY, JSON.stringify({ state: { doc: triangle() }, version: 1 }));
    const second = setup(storage).library.open();
    expect(second.index.figures).toHaveLength(2);
    expect(second.index.activeId).toBe(first.index.activeId);
    // An empty leftover is just dropped.
    storage.setItem(LEGACY_FIGURE_KEY, JSON.stringify({ state: { doc: emptyDoc() }, version: 1 }));
    expect(setup(storage).library.open().index.figures).toHaveLength(2);
    expect(storage.getItem(LEGACY_FIGURE_KEY)).toBeNull();
  });

  it("keeps the old figure when the library can't be written", () => {
    const storage = new MemoryStorage();
    const legacy = JSON.stringify({ state: { doc: triangle() }, version: 1 });
    storage.setItem(LEGACY_FIGURE_KEY, legacy);
    storage.failWrites = true;
    expect(() => setup(storage).library.open()).toThrow();
    expect(storage.getItem(LEGACY_FIGURE_KEY)).toBe(legacy);
  });

  it("creates, saves, renames and removes figures", () => {
    const { library, storage } = setup();
    const start = library.open().index;
    const { meta, index } = library.create("Questão 2", triangle());
    expect(index.activeId).toBe(meta.id);
    expect(index.figures.map((f) => f.name)).toEqual(["Figura 1", "Questão 2"]);
    expect(library.load(meta.id)).toEqual(triangle());

    const before = library.index().figures.find((f) => f.id === start.activeId)!.updatedAt;
    const saved = library.save(start.activeId, triangle());
    expect(saved.figures.find((f) => f.id === start.activeId)!.updatedAt).toBeGreaterThan(before);

    expect(library.rename(meta.id, "  Nova  ").figures[1].name).toBe("Nova");
    expect(library.rename(meta.id, "   ").figures[1].name).toBe("Nova");

    const removed = library.remove(meta.id);
    expect(removed.figures).toHaveLength(1);
    expect(removed.activeId).toBe("");
    expect(storage.getItem(figureKey(meta.id))).toBeNull();
    expect(library.load(meta.id)).toBeNull();
  });

  it("leaves nothing behind when a create fails", () => {
    const { library, storage } = setup();
    library.open();
    const keys = [...storage.data.keys()];
    const realSet = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      if (key === LIBRARY_KEY) throw new Error("QuotaExceededError");
      realSet(key, value);
    };
    expect(() => library.create("X", triangle())).toThrow();
    expect([...storage.data.keys()]).toEqual(keys);
  });

  it("sees changes made by another tab", () => {
    const storage = new MemoryStorage();
    const a = setup(storage).library;
    a.open();
    const b = createLibrary(storage, { now: () => 5000, newId: () => "other" });
    b.create("De outra aba", emptyDoc());
    // Saving in tab A must not drop the figure tab B added.
    const index = a.save(a.index().figures[0].id, triangle());
    expect(index.figures.map((f) => f.name)).toEqual(["Figura 1", "De outra aba"]);
  });

  it("repairs a damaged index", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LIBRARY_KEY,
      JSON.stringify({
        activeId: "nope",
        figures: [{ id: "a", name: "A", createdAt: 1, updatedAt: 2 }, { id: "a", name: "dup" }, { id: "../x" }, null],
      }),
    );
    expect(readIndex(storage)?.figures.map((f) => f.id)).toEqual(["a"]);
    const { index, doc } = setup(storage).library.open();
    expect(index.activeId).toBe("a");
    // The figure's doc is missing: it opens empty.
    expect(doc).toEqual(emptyDoc());
  });
});
