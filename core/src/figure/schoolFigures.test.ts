import { describe, expect, it } from "vitest";
import {
  addBasis,
  addBoard,
  addPoints,
  addRegion,
  addVennDiagram,
  applyInput,
  boardLayout,
  boardSlots,
  joinRelationSigns,
  setAllBoardGaps,
  toggleBoardGap,
  boardError,
  deleteElements,
  emptyDoc,
  layoutMath,
  makeVectors,
  markSetOperation,
  mathToLatex,
  movePoints,
  normalizeDoc,
  parseInput,
  parseBoard,
  parseSetExpr,
  pointMap,
  regionOutline,
  buildScene,
  setMembers,
  setRegionCount,
  toSvg,
  toTikz,
  vectorOp,
  vennItemSpots,
  type Board,
  type FigureDoc,
  type MathNode,
  type Region,
  type Vector,
  type VennItems,
} from "./index";

const flat = (n: MathNode): string => {
  if (typeof n === "string") return n;
  if ("word" in n) return n.word;
  if ("delim" in n) return n.delim;
  if ("row" in n) return n.row.map(flat).join("");
  if ("frac" in n) return `${flat(n.frac[0])}/${flat(n.frac[1])}`;
  if ("sqrt" in n) return `√${flat(n.sqrt)}`;
  return `${flat(n.sup[0])}^${flat(n.sup[1])}`;
};

const typed = (doc: FigureDoc, text: string) => {
  const r = applyInput(doc, parseInput(text, { points: [] }));
  expect(r.error).toBeUndefined();
  return r.doc;
};

const board = (source: string, patch: Partial<Board> = {}) => {
  const r = addBoard(emptyDoc(), source);
  expect(r.error).toBeUndefined();
  const el = { ...(r.doc.elements[0] as Board), ...patch };
  return { el, doc: { ...r.doc, elements: [el] } as FigureDoc };
};

const texts = (source: string, patch: Partial<Board> = {}) => {
  const { el, doc } = board(source, patch);
  return boardLayout(el, doc)!.marks.flatMap((m) => (m.kind === "text" ? [flat(m.node)] : []));
};

function twoVectors(a: [number, number], b: [number, number], sameTail = true) {
  let doc = addPoints(emptyDoc(), [
    { x: 0, y: 0, label: "O" },
    { x: a[0], y: a[1], label: "A" },
    ...(sameTail ? [] : [{ x: 5, y: 5, label: "P" }]),
    { x: (sameTail ? 0 : 5) + b[0], y: (sameTail ? 0 : 5) + b[1], label: "B" },
  ]).doc;
  const ids = doc.elements.map((e) => e.id);
  doc = makeVectors(doc, [ids[0], ids[1]]).doc;
  doc = makeVectors(doc, sameTail ? [ids[0], ids[2]] : [ids[2], ids[3]]).doc;
  const vectors = doc.elements.filter((e): e is Vector => e.type === "vector").map((v) => v.id);
  return { doc, u: vectors[0], v: vectors[1], ids };
}

const vectorsOf = (doc: FigureDoc) => doc.elements.filter((e): e is Vector => e.type === "vector");
const tip = (doc: FigureDoc, v: Vector) => pointMap(doc).get(v.b)!;
const tail = (doc: FigureDoc, v: Vector) => pointMap(doc).get(v.a)!;

describe("vectors", () => {
  it("names new vectors u, v and draws an arrowhead in SVG and TikZ", () => {
    const { doc } = twoVectors([3, 0], [0, 2]);
    expect(vectorsOf(doc).map((v) => v.label?.text)).toEqual(["u", "v"]);
    expect(buildScene(doc).prims.some((p) => p.kind === "path" && p.fill !== null)).toBe(true);
    const tikz = toTikz(doc);
    expect(tikz).toContain("\\vec{u}");
    expect(tikz).toContain("\\fill");
  });

  it("adds by the polygon rule and follows when a vector moves", () => {
    const { doc, u, v, ids } = twoVectors([3, 0], [0, 2], false);
    const r = vectorOp(doc, [u, v], "sum");
    expect(r.error).toBeUndefined();
    const result = vectorsOf(r.doc).find((x) => x.label?.text === "u + v")!;
    expect(tip(r.doc, result)).toMatchObject({ x: 3, y: 2 });
    const moved = movePoints(r.doc, [{ id: ids[3], x: 7, y: 5 }]);
    expect(tip(moved, vectorsOf(moved).find((x) => x.label?.text === "u + v")!)).toMatchObject({ x: 5, y: 0 });
  });

  it("closes a parallelogram from a shared tail", () => {
    const { doc, u, v } = twoVectors([3, 0], [1, 2]);
    const r = vectorOp(doc, [u, v], "parallelogram");
    const result = vectorsOf(r.doc).find((x) => x.label?.text === "u + v")!;
    expect(tip(r.doc, result)).toMatchObject({ x: 4, y: 2 });
    expect(r.doc.elements.filter((e) => e.type === "segment" && e.stroke.dash === "dashed")).toHaveLength(2);
  });

  it("refuses a parallelogram of parallel vectors", () => {
    const { doc, u, v } = twoVectors([2, 0], [4, 0]);
    expect(vectorOp(doc, [u, v], "parallelogram").error).toMatch(/paralelos/);
  });

  it("subtracts from the tip of the second to the tip of the first", () => {
    const { doc, u, v } = twoVectors([3, 0], [0, 2]);
    const r = vectorOp(doc, [u, v], "difference");
    const d = vectorsOf(r.doc).find((x) => x.label?.text === "u − v")!;
    expect(tail(r.doc, d)).toMatchObject({ x: 0, y: 2 });
    expect(tip(r.doc, d)).toMatchObject({ x: 3, y: 0 });
  });

  it("projects on the direction of another, with a right-angle mark", () => {
    const { doc, u, v } = twoVectors([3, 4], [5, 0]);
    const r = vectorOp(doc, [u, v], "projection");
    const p = vectorsOf(r.doc).find((x) => x.label?.text === "u′")!;
    expect(tip(r.doc, p)).toMatchObject({ x: 3, y: 0 });
    expect(r.doc.elements.some((e) => e.type === "angle" && e.rightMark)).toBe(true);
  });

  it("says when the projection is null", () => {
    const { doc, u, v } = twoVectors([0, 3], [5, 0]);
    expect(vectorOp(doc, [u, v], "projection").error).toMatch(/perpendiculares/);
  });

  it("makes a versor of length 1 that keeps its direction", () => {
    const { doc, u } = twoVectors([3, 4], [5, 0]);
    const r = vectorOp(doc, [u], "unit");
    const hat = vectorsOf(r.doc).find((x) => x.notation === "hat")!;
    expect(tip(r.doc, hat).x).toBeCloseTo(0.6);
    expect(tip(r.doc, hat).y).toBeCloseTo(0.8);
    expect(toTikz(r.doc)).toContain("\\hat{u}");
  });

  it("splits into components", () => {
    const { doc, u } = twoVectors([3, 4], [5, 0]);
    const r = vectorOp(doc, [u], "components");
    const names = vectorsOf(r.doc).map((v) => v.label?.text);
    expect(names).toEqual(expect.arrayContaining(["u_x", "u_y"]));
    expect(tip(r.doc, vectorsOf(r.doc).find((v) => v.label?.text === "u_x")!)).toMatchObject({ x: 3, y: 0 });
    expect(toSvg(r.doc)).toContain('dy="');
  });

  it("scales by k", () => {
    const { doc, u } = twoVectors([1, 2], [5, 0]);
    const r = vectorOp(doc, [u], "scale", {}, 3);
    expect(tip(r.doc, vectorsOf(r.doc).find((v) => v.label?.text === "3u")!)).toMatchObject({ x: 3, y: 6 });
  });

  it("types vectors in the input bar, also in polar form", () => {
    const doc = typed(emptyDoc(), "vetor F=(5:90)");
    const [f] = vectorsOf(doc);
    expect(f.label?.text).toBe("F");
    expect(tip(doc, f).y).toBeCloseTo(5);
    expect(tip(typed(emptyDoc(), "vetor u=(1;1)@(2;3)"), vectorsOf(typed(emptyDoc(), "vetor u=(1;1)@(2;3)"))[0])).toMatchObject({ x: 3, y: 4 });
  });

  it("draws i and j from the origin", () => {
    const r = addBasis(emptyDoc());
    expect(vectorsOf(r.doc).map((v) => [v.label?.text, v.notation])).toEqual([["i", "hat"], ["j", "hat"]]);
  });

  it("survives saving", () => {
    const { doc, u, v } = twoVectors([3, 4], [5, 0]);
    const built = vectorOp(doc, [u, v], "projection").doc;
    const again = normalizeDoc(JSON.parse(JSON.stringify(built)));
    expect(again.elements).toEqual(built.elements);
  });

  it("deletes with its points", () => {
    const { doc, ids } = twoVectors([3, 4], [5, 0]);
    expect(vectorsOf(deleteElements(doc, [ids[1]]).doc)).toHaveLength(1);
  });
});

describe("set expressions", () => {
  it("reads operators, words and complements", () => {
    for (const t of ["A∪B", "A ∩ B'", "(A−B)'∩C", "A uniao B", "A interseção B", "A^c", "U-A", "A\\B"]) {
      expect(parseSetExpr(t).ok, t).toBe(true);
    }
  });

  it("takes letters for ∪ and ∩, which keyboards don't have", () => {
    const named = (t: string) => {
      const r = parseSetExpr(t);
      return r.ok ? r.expr.k : r.error;
    };
    expect(named("A U B")).toBe("union");
    expect(named("A u B")).toBe("union");
    expect(named("AUB")).toBe("union");
    expect(named("A n B")).toBe("inter");
    expect(named("A N B")).toBe("inter");
    // Where a set can go, U is still the universe.
    expect(named("U-A")).toBe("diff");
    expect(named("A n U")).toBe("inter");
    expect(parseSetExpr("A U").ok).toBe(false);
  });

  it("binds ∩ before ∪", () => {
    const r = parseSetExpr("A∪B∩C");
    expect(r.ok && r.expr.k).toBe("union");
  });

  it("explains bad expressions", () => {
    expect(parseSetExpr("A B").ok).toBe(false);
    expect(parseSetExpr("(A∪B").ok).toBe(false);
    expect(parseSetExpr("").ok).toBe(false);
  });
});

const venn = (n: number) => addVennDiagram(emptyDoc(), n).doc;
const regionAt = (doc: FigureDoc) => doc.elements.find((e): e is Region => e.type === "region")!;

/** Area of a region's outline: shoelace over its pieces, arcs adding their circular part. */
function loopArea(doc: FigureDoc): number {
  let area = 0;
  for (const loop of regionOutline(doc, regionAt(doc))) {
    for (const e of loop) {
      if (e.kind === "line") area += (e.from.x * e.to.y - e.to.x * e.from.y) / 2;
      else {
        const s = (e.start * Math.PI) / 180;
        const sweep = (e.sweep * Math.PI) / 180;
        const end = s + sweep;
        area += (e.r * e.r * sweep + e.r * e.c.x * (Math.sin(end) - Math.sin(s)) - e.r * e.c.y * (Math.cos(end) - Math.cos(s))) / 2;
      }
    }
  }
  return area;
}

/** The area two circles of radius r overlap, with centers d apart. */
const lens = (r: number, d: number) => 2 * r * r * Math.acos(d / (2 * r)) - (d / 2) * Math.sqrt(4 * r * r - d * d);

describe("regions", () => {
  it("gives A∩B the exact area of the lens", () => {
    const r = addRegion(venn(2), "A∩B");
    expect(r.error).toBeUndefined();
    expect(loopArea(r.doc)).toBeCloseTo(lens(2, 2.6), 6);
  });

  it("gives A∪B and A−B their areas", () => {
    const circle = Math.PI * 4;
    expect(loopArea(addRegion(venn(2), "A∪B").doc)).toBeCloseTo(2 * circle - lens(2, 2.6), 6);
    expect(loopArea(addRegion(venn(2), "A−B").doc)).toBeCloseTo(circle - lens(2, 2.6), 6);
  });

  it("takes the complement in the universe, leaving the holes empty", () => {
    const doc = venn(1);
    const out = addRegion(doc, "A'").doc;
    const width = (2 + 0.9) * 2;
    expect(loopArea(out)).toBeCloseTo(width * width - Math.PI * 4, 6);
  });

  it("handles three sets at once", () => {
    const r = addRegion(venn(3), "(A∪B)∩C");
    expect(r.error).toBeUndefined();
    expect(regionOutline(r.doc, regionAt(r.doc)).length).toBeGreaterThan(0);
    expect(loopArea(r.doc)).toBeGreaterThan(0);
  });

  it("writes the same region in SVG and TikZ", () => {
    const r = addRegion(venn(2), "A∩B");
    expect(toSvg(r.doc)).toMatch(/<path d="M[^"]*A[^"]*Z" fill=/);
    expect(toTikz(r.doc)).toMatch(/\\path\[.*arc\[start angle/);
  });

  it("follows the sets when they move", () => {
    const doc = addRegion(venn(2), "A∩B").doc;
    const before = loopArea(doc);
    const center = doc.elements.find((e) => e.type === "circle")!;
    const c = center.type === "circle" ? center.center : "";
    const p = pointMap(doc).get(c)!;
    expect(loopArea(movePoints(doc, [{ id: c, x: p.x + 0.5, y: p.y }]))).toBeGreaterThan(before);
  });

  it("explains names that aren't in the figure and empty regions", () => {
    expect(addRegion(venn(2), "A∩Z").error).toMatch(/Z/);
    const apart = movePoints(venn(2), []);
    const c = apart.elements.filter((e) => e.type === "circle").map((e) => (e.type === "circle" ? e.center : ""));
    expect(addRegion(movePoints(apart, [{ id: c[0], x: -20, y: 0 }]), "A∩B").error).toMatch(/vazia/);
  });

  it("goes when its set is deleted, and survives saving", () => {
    const doc = addRegion(venn(2), "A∩B").doc;
    expect(normalizeDoc(JSON.parse(JSON.stringify(doc))).elements).toEqual(doc.elements);
    const circle = doc.elements.find((e) => e.type === "circle")!;
    expect(deleteElements(doc, [circle.id]).doc.elements.some((e) => e.type === "region")).toBe(false);
  });
});

describe("set operations from the menu", () => {
  const expr = (doc: FigureDoc) => regionAt(doc).expr;
  const circles = (doc: FigureDoc) => doc.elements.filter((e) => e.type === "circle").map((e) => e.id);

  it("uses all the sets when none is selected", () => {
    expect(expr(markSetOperation(venn(2), [], "union").doc)).toBe("A∪B");
    expect(expr(markSetOperation(venn(3), [], "inter").doc)).toBe("A∩B∩C");
    expect(expr(markSetOperation(venn(2), [], "comp").doc)).toBe("(A∪B)'");
  });

  it("follows the selection, in its order", () => {
    const doc = venn(3);
    const [a, b, c] = circles(doc);
    expect(expr(markSetOperation(doc, [c, a], "inter").doc)).toBe("C∩A");
    expect(expr(markSetOperation(doc, [b, a], "diff").doc)).toBe("B−A");
    expect(expr(markSetOperation(doc, [b], "comp").doc)).toBe("B'");
  });

  it("asks for a selection when the order isn't clear", () => {
    expect(markSetOperation(venn(3), [], "diff").error).toMatch(/de onde tirar/);
    const doc = venn(2);
    expect(markSetOperation(doc, [circles(doc)[0]], "union").error).toMatch(/ao menos dois/);
    expect(markSetOperation(emptyDoc(), [], "union").error).toMatch(/diagrama/);
  });
});

describe("diagram contents", () => {
  const items = (doc: FigureDoc) => doc.elements.find((e): e is VennItems => e.type === "vennitems")!;

  it("creates the sets as they are typed, up to three", () => {
    let doc = typed(emptyDoc(), "A={1,2,3}");
    doc = typed(doc, "B={3,4}");
    doc = typed(doc, "C={4}");
    expect(doc.elements.filter((e) => e.type === "circle")).toHaveLength(3);
    expect(setMembers(doc, "D", ["9"]).error).toMatch(/3 conjuntos/);
  });

  it("writes each element where its sets overlap", () => {
    let doc = typed(emptyDoc(), "A={1,2,3}");
    doc = typed(doc, "B={3,4}");
    const spots = vennItemSpots(doc, items(doc));
    const three = spots.find((s) => s.text === "3")!.anchor;
    const one = spots.find((s) => s.text === "1")!.anchor;
    const four = spots.find((s) => s.text === "4")!.anchor;
    expect(one.x).toBeLessThan(three.x);
    expect(three.x).toBeLessThan(four.x);
  });

  it("puts the universe's other elements outside the sets", () => {
    let doc = typed(emptyDoc(), "A={1}");
    doc = typed(doc, "U={1,5}");
    const [circle] = doc.elements.filter((e) => e.type === "circle");
    const c = pointMap(doc).get(circle.type === "circle" ? circle.center : "")!;
    const five = vennItemSpots(doc, items(doc)).find((s) => s.text === "5")!;
    expect(Math.hypot(five.anchor.x - c.x, five.anchor.y - c.y)).toBeGreaterThan(2);
  });

  it("writes a count in one region, and refuses a union", () => {
    const doc = typed(venn(2), "n(A∩B)=7");
    expect(items(doc).counts[0].text).toBe("7");
    expect(setRegionCount(venn(2), "A∪B", "7").error).toMatch(/mais de uma região/);
  });

  it("replaces a set typed again, and forgets a deleted set", () => {
    let doc = typed(venn(2), "A={1,2}");
    doc = typed(doc, "A={8}");
    expect(items(doc).members).toHaveLength(1);
    expect(items(doc).members[0].items).toEqual(["8"]);
    const circle = doc.elements.find((e) => e.type === "circle" && e.label?.text === "A")!;
    expect(items(deleteElements(doc, [circle.id]).doc).members).toHaveLength(0);
  });
});

describe("arithmetic boards", () => {
  it("reads what is typed, without taking points or polar forms", () => {
    expect(parseBoard("1234÷5")).toMatchObject({ kind: "div" });
    expect(parseBoard("12+34+5")).toMatchObject({ kind: "add" });
    expect(parseBoard("12-5")).toMatchObject({ kind: "sub" });
    expect(parseBoard("12x5")).toMatchObject({ kind: "mul" });
    expect(parseBoard("conta 12:5")).toMatchObject({ kind: "div" });
    expect(parseBoard("(2;3)")).toBeNull();
    expect(parseBoard("3:60")).toBeNull();
    expect(parseInput("3:60").nodes).toHaveLength(1);
    expect(parseInput("A=(0;0)--B=(4;0)").nodes).toHaveLength(2);
  });

  it("works a long division with its remainders", () => {
    const t = texts("1234÷5");
    expect(t.join("")).toContain("1234");
    // Quotient 246, remainder 4, as digits written under the chave.
    expect(t).toEqual(expect.arrayContaining(["2", "4", "6", "−"]));
    const r = board("1234÷5");
    expect(boardLayout(r.el, r.doc)!.marks.filter((m) => m.kind === "line").length).toBeGreaterThan(3);
  });

  it("writes only remainders in the short method", () => {
    expect(texts("1234÷5", { method: "short" })).not.toContain("−");
  });

  it("carries the quotient to the decimals asked for", () => {
    const t = texts("3÷4", { places: 2 });
    expect(t).toEqual(expect.arrayContaining(["0", ",", "7", "5"]));
  });

  it("evens out decimals before dividing", () => {
    expect(texts("12,5÷2,5").join("")).toContain("125");
  });

  it("refuses division by zero and a negative subtraction", () => {
    expect(boardError("5÷0")).toMatch(/zero/);
    expect(boardError("3-5")).toMatch(/negativo/);
  });

  it("adds in columns with carries", () => {
    const t = texts("58+67");
    expect(t).toEqual(expect.arrayContaining(["1", "2", "5", "+"]));
  });

  it("aligns decimals by the comma", () => {
    const t = texts("1,5+2,25");
    expect(t.filter((s) => s === ",")).toHaveLength(3);
  });

  it("crosses out the digit that lends", () => {
    const r = board("302-5");
    const marks = boardLayout(r.el, r.doc)!.marks;
    expect(marks.filter((m) => m.kind === "line" && m.role === "carry").length).toBeGreaterThan(0);
  });

  it("writes partial products", () => {
    const t = texts("12x34");
    // 48 + 36(0) = 408
    expect(t.join("")).toContain("408");
  });

  it("hides results on a blank board, and leaves boxes on a gaps board", () => {
    const blank = board("1234÷5", { show: "blank" });
    expect(boardLayout(blank.el, blank.doc)!.marks.some((m) => m.kind === "text" && m.role === "result")).toBe(false);
    const gaps = board("1234÷5", { show: "gaps" });
    expect(boardLayout(gaps.el, gaps.doc)!.marks.some((m) => m.kind === "box")).toBe(true);
  });

  it("changes which gaps with the seed", () => {
    const at = (seed: number) => {
      const g = board("1234÷5", { show: "gaps", seed });
      return JSON.stringify(boardLayout(g.el, g.doc)!.marks.filter((m) => m.kind === "box"));
    };
    expect(at(0)).not.toBe(at(1));
  });
});

describe("devices", () => {
  it("factors with the primes on the right", () => {
    expect(texts("fatorar 360").join(" ")).toContain("360 = 2^3 · 3^2 · 5");
  });

  it("finds the MMC", () => {
    expect(texts("mmc(12;18)").join(" ")).toContain("MMC = 2^2 · 3^2 = 36");
  });

  it("circles the common primes for the MDC", () => {
    const r = board("mdc(12;18)");
    const marks = boardLayout(r.el, r.doc)!.marks;
    expect(marks.filter((m) => m.kind === "ring")).toHaveLength(2);
    expect(texts("mdc(12;18)").join(" ")).toContain("MDC = 2 · 3 = 6");
  });

  it("runs Euclid's table", () => {
    const t = texts("euclides(48;18)");
    expect(t.join(" ")).toContain("MDC(48; 18) = 6");
  });

  it("explains bad numbers", () => {
    expect(boardError("mmc(12)")).toMatch(/dois números/);
    expect(boardError("fatorar 1,5")).toMatch(/um número por vez/);
    expect(boardError("fatorar abc")).toMatch(/inteiros/);
  });
});

describe("number line boards", () => {
  it("keeps fractions and roots exact", () => {
    const t = texts("varal [1/3;√2] ∪ ]1;5[");
    expect(t).toEqual(expect.arrayContaining(["1/3", "√2"]));
  });

  it("solves the varal", () => {
    const r = board("varal [1;3] ∩ ]2;5[");
    const marks = boardLayout(r.el, r.doc)!.marks.filter((m) => m.kind === "dot" && m.role === "result");
    // ]2; 3]: open at 2, closed at 3.
    expect(marks.map((m) => (m.kind === "dot" ? m.open : null))).toEqual([true, false]);
  });

  it("takes letters and words between intervals", () => {
    expect(texts("varal [1;3] U [2;4]")).toContain("A∪B");
    expect(texts("varal [1;3] n [2;4]")).toContain("A∩B");
    expect(texts("varal [1;3] inter [2;4]")).toContain("A∩B");
    expect(texts("varal [1;3] menos [2;4]")).toContain("A−B");
    expect(parseInput("[1;3] n [2;4]").boards).toHaveLength(1);
  });

  it("names the result by the operation", () => {
    expect(texts("varal [1;3] ∪ [2;4] − [3;5]")).toContain("A∪B−C");
  });

  it("marks an empty result with nothing thick", () => {
    const r = board("varal [1;2] ∩ [3;4]");
    expect(boardLayout(r.el, r.doc)!.marks.filter((m) => m.kind === "line" && m.role === "result")).toHaveLength(0);
  });

  it("takes infinite ends", () => {
    expect(texts("varal ]-∞;2] ∪ [1;+∞[")).toEqual(expect.arrayContaining(["1", "2"]));
  });

  it("sketches a parabola with both roots and three signs", () => {
    const t = texts("sinal x²-4");
    expect(t).toEqual(expect.arrayContaining(["−2", "2"]));
    expect(t.filter((s) => s === "+")).toHaveLength(2);
    expect(t.filter((s) => s === "−")).toHaveLength(1);
  });

  it("keeps the sign across an even root", () => {
    const t = texts("sinal (x-1)^2");
    expect(t.filter((s) => s === "−")).toHaveLength(0);
    expect(t.filter((s) => s === "+")).toHaveLength(2);
  });

  it("uses radicals for roots that aren't rational", () => {
    expect(texts("sinal x²-2")).toEqual(expect.arrayContaining(["−√2", "√2"]));
    expect(texts("sinal x²-x-1").join(" ")).toContain("1 − √5/2");
  });

  it("marks a pole with an open ball", () => {
    const r = board("sinal 1/x");
    expect(boardLayout(r.el, r.doc)!.marks.some((m) => m.kind === "dot" && m.open)).toBe(true);
  });

  it("builds the sign chart row by row", () => {
    const t = texts("quadro (x-1)(x+2)/(x-3)");
    expect(t).toEqual(expect.arrayContaining(["x − 1", "x + 2", "x − 3", "f(x)", "−2", "1", "3", "∄", "0"]));
    // Four columns in four rows.
    expect(t.filter((s) => s === "+" || s === "−")).toHaveLength(16);
  });

  it("flips the last row correctly", () => {
    const signs = texts("quadro (x-1)/(x+2)").slice(-8);
    expect(signs.join(" ")).toContain("+ − +");
  });

  it("refuses a chart of what isn't a product of polynomials", () => {
    expect(boardError("quadro sen(x)")).toMatch(/polinômios/);
  });

  it("opens modules column by column and finds the solutions", () => {
    const t = texts("modular |x-1|+|x+2|=5");
    expect(t).toEqual(expect.arrayContaining(["−x + 1", "x − 1", "−x − 2", "x + 2"]));
    expect(t.join(" ")).toContain("S = {−3; 2}");
  });

  it("recognizes a module equation without the word", () => {
    expect(parseBoard("|x|=3")).toMatchObject({ kind: "modulus" });
  });

  it("rejects a root outside its column", () => {
    const t = texts("modular |x-1|=2x+5").join(" ");
    expect(t).toContain("x = −6 ∉");
    expect(t).toContain("S = {−4/3}");
  });

  it("opens modules of any degree", () => {
    expect(boardError("modular |x²-1|=3")).toBeNull();
  });
});

describe("boards in the figure", () => {
  it("draws in SVG and TikZ", () => {
    const r = addBoard(emptyDoc(), "varal [1/2;3] ∩ ]2;5[");
    expect(toSvg(r.doc)).toContain("<text");
    expect(toTikz(r.doc)).toContain("\\frac{1}{2}");
  });

  it("writes math as LaTeX", () => {
    expect(mathToLatex({ row: ["x ≥ ", { frac: ["1", "2"] }] })).toBe("$x\\geq \\frac{1}{2}$");
    expect(mathToLatex({ sqrt: "2" })).toBe("$\\sqrt{2}$");
  });

  it("lays fractions out taller than their line", () => {
    const b = layoutMath({ frac: ["1", "2"] }, 10);
    expect(b.up).toBeGreaterThan(5);
    expect(b.down).toBeGreaterThan(5);
  });

  it("goes under what is already drawn", () => {
    const first = addBoard(emptyDoc(), "12+34").doc;
    const second = addBoard(first, "56+78").doc;
    const [a, b] = second.elements as Board[];
    expect(b.y).toBeLessThan(a.y);
  });

  it("drops a damaged board but keeps the rest", () => {
    const doc = normalizeDoc({
      kind: "geo",
      version: 1,
      elements: [
        { id: "b1", type: "board", x: 0, y: 0, source: "12+34" },
        { id: "b2", type: "board", x: 0, y: 0, source: "nada disso" },
      ],
    });
    expect(doc.elements.map((e) => e.id)).toEqual(["b1"]);
  });

  it("types boards in the input bar", () => {
    expect(typed(emptyDoc(), "mmc(12;18)").elements[0].type).toBe("board");
    expect(parseInput("fatorar").errors[0].message).toMatch(/fatorar 360/);
    expect(parseInput("5÷0").errors[0].message).toMatch(/zero/);
  });

  it("doesn't take typed intervals, functions or points", () => {
    expect(parseInput("[1; 2[").intervals).toHaveLength(1);
    expect(parseInput("y=x^2").functions).toHaveLength(1);
    expect(parseInput("n(x)=x^2").functions).toHaveLength(1);
    expect(parseInput("n(A∩B)=3").counts).toHaveLength(1);
    expect(parseInput("x=2").lines).toHaveLength(1);
    expect(parseInput("+1;2", { points: [{ id: "p1", x: 0, y: 0 }] }).nodes).toHaveLength(1);
  });
});

describe("choices for the printed board", () => {
  it("writes the sign of a column operation on the right when asked", () => {
    for (const source of ["58+67", "302-5", "12x34"]) {
      const { el, doc } = board(source, { signSide: "right" });
      const marks = boardLayout(el, doc)!.marks.flatMap((m) => (m.kind === "text" ? [m] : []));
      const sign = marks.find((m) => ["+", "−", "×"].includes(flat(m.node)))!;
      const digits = marks.filter((m) => /^\d$/.test(flat(m.node)));
      expect(sign.at.x).toBeGreaterThan(Math.max(...digits.map((d) => d.at.x)));
    }
  });

  it("leaves out the results picked by hand, as boxes, blanks or a text", () => {
    const boxes = (patch: Partial<Board>) => {
      const { el, doc } = board("1234÷5", { show: "gaps", gaps: [0, 2], ...patch });
      return boardLayout(el, doc)!.marks;
    };
    expect(boxes({}).filter((m) => m.kind === "box")).toHaveLength(2);
    expect(boxes({ gapStyle: "text", gapText: "?" }).filter((m) => m.kind === "text" && m.node === "?")).toHaveLength(2);
    const full = boxes({ gaps: [] }).length;
    expect(boxes({ gapStyle: "blank" })).toHaveLength(full - 2);
  });

  it("toggles a gap from the preview, starting from the ones the seed drew", () => {
    const { doc, el } = board("1234÷5", { show: "gaps" });
    const before = boardSlots(el, doc).filter((s) => s.gap).map((s) => s.index);
    const free = boardSlots(el, doc).find((s) => !s.gap)!.index;
    const after = toggleBoardGap(doc, el.id, free).doc.elements[0] as Board;
    expect(after.gaps).toEqual([...before, free].sort((a, b) => a - b));
    const none = setAllBoardGaps(doc, el.id, false).doc.elements[0] as Board;
    expect(none.gaps).toEqual([]);
    const all = setAllBoardGaps(doc, el.id, true).doc.elements[0] as Board;
    expect(all.gaps).toHaveLength(boardSlots(el, doc).length);
  });

  it("draws the stretches of a set as waves when asked", () => {
    const { el, doc } = board("varal [1;3] ∩ ]2;5[", { intervals: "wave" });
    expect(boardLayout(el, doc)!.marks.some((m) => m.kind === "curve" && m.role === "result")).toBe(true);
  });

  it("keeps the new choices through a saved file", () => {
    const { doc } = board("58+67", { signSide: "right", gaps: [1], gapStyle: "text", gapText: "?", intervals: "wave" });
    expect(normalizeDoc(JSON.parse(JSON.stringify(doc))).elements[0]).toMatchObject({ signSide: "right", gaps: [1], gapStyle: "text", gapText: "?", intervals: "wave" });
  });
});

describe("inequalities", () => {
  it("joins >= and <= into one sign", () => {
    expect(joinRelationSigns("x >= 2 e x <= 5")).toBe("x ≥ 2 e x ≤ 5");
  });

  it("sketches the set where an inequality holds", () => {
    expect(texts("sinal x²-4 >= 0").join(" ")).toContain("S = ]−∞; −2] ∪ [2; +∞[");
    expect(texts("sinal x²-4 < 0").join(" ")).toContain("S = ]−2; 2[");
    expect(texts("sinal x² ≤ 0").join(" ")).toContain("S = {0}");
    expect(texts("sinal x²+1 > 0").join(" ")).toContain("S = ℝ");
    const { el, doc } = board("sinal x²-4 > 0");
    const balls = boardLayout(el, doc)!.marks.filter((m) => m.kind === "dot");
    expect(balls.map((b) => (b.kind === "dot" ? b.open : null))).toEqual([true, true]);
  });

  it("never takes a pole into the set", () => {
    expect(texts("quadro (x-1)/(x-3) >= 0").join(" ")).toContain("S = ]−∞; 1] ∪ ]3; +∞[");
    expect(texts("quadro x-1 ≥ 0").join(" ")).toContain("S");
  });

  it("asks for 0 on one side of a sign chart", () => {
    expect(boardError("quadro (x-1)(x+2) >= 3")).toMatch(/deixe 0/);
  });

  it("draws the x row of a sign chart as an axis with an arrow", () => {
    const { el, doc } = board("quadro (x-1)(x+2)");
    expect(boardLayout(el, doc)!.marks.some((m) => m.kind === "head")).toBe(true);
  });

  it("solves inequalities with modules", () => {
    expect(texts("modular |x-2| < 3").join(" ")).toContain("S = ]−1; 5[");
    expect(texts("|x-1|+|x+2| >= 5").join(" ")).toContain("S = ]−∞; −3] ∪ [2; +∞[");
    expect(texts("|x²-1| <= 3").join(" ")).toContain("S = [−2; 2]");
  });

  it("opens modules of higher degree and of functions", () => {
    expect(texts("modular |x²-4|=3").join(" ")).toContain("S = {−√7; −1; 1; √7}");
    const sine = texts("modular |sen(x)| = 1/2").join(" ");
    expect(sine).toContain("S = {π/6; 5π/6; 7π/6; 11π/6}");
    expect(texts("modular |sen(x)| = 1 em [0; pi]").join(" ")).toContain("S = {π/2}");
  });
});

describe("sign sketches", () => {
  /** The steepness of the curve on each side of a root, in pt per pt. */
  const slopes = (source: string) => {
    const { el, doc } = board(source);
    const curves = boardLayout(el, doc)!.marks.flatMap((m) => (m.kind === "curve" ? [m.points] : []));
    const ends = curves.flatMap((pts) => [
      { at: pts[0], slope: Math.abs((pts[1].y - pts[0].y) / (pts[1].x - pts[0].x)) },
      { at: pts[pts.length - 1], slope: Math.abs((pts[pts.length - 1].y - pts[pts.length - 2].y) / (pts[pts.length - 1].x - pts[pts.length - 2].x)) },
    ]);
    return ends.filter((e) => Math.abs(e.at.y) < 1e-6);
  };

  it("crosses a simple root as steeply on both sides, without a bend", () => {
    for (const source of ["sinal x²-4", "sinal (x-1)(x+1)(x-3)"]) {
      const atRoots = slopes(source);
      const byX = new Map<number, number[]>();
      for (const e of atRoots) byX.set(Math.round(e.at.x), [...(byX.get(Math.round(e.at.x)) ?? []), e.slope]);
      for (const pair of byX.values()) {
        expect(pair).toHaveLength(2);
        expect(Math.abs(pair[0] - pair[1]) / pair[0]).toBeLessThan(0.05);
      }
    }
  });
});

describe("second round of board choices", () => {
  it("writes a sign on the right by the top number", () => {
    const { el, doc } = board("302-5", { signSide: "right" });
    const marks = boardLayout(el, doc)!.marks.flatMap((m) => (m.kind === "text" && !m.role ? [m] : []));
    const sign = marks.find((m) => flat(m.node) === "−")!;
    const top = marks.find((m) => flat(m.node) === "3")!;
    expect(sign.at.y).toBe(top.at.y);
  });

  it("lets any digit or sign of the statement be a gap, and draws only results by chance", () => {
    const { el, doc } = board("58+67", { show: "gaps", gaps: [0] });
    const shown = boardLayout(el, doc)!.marks.flatMap((m) => (m.kind === "text" ? [flat(m.node)] : []));
    // The 5 of 58 is gone; the 5 of 125 stays.
    expect(shown.filter((t) => t === "5")).toHaveLength(1);
    expect(boardSlots(el, doc).some((s) => s.index === 2)).toBe(true);
    const drawn = board("1234÷5", { show: "gaps" });
    const marks = boardLayout({ ...drawn.el, show: "full" }, drawn.doc)!.marks.filter((m) => m.kind === "text" && m.role !== "carry");
    for (const slot of boardSlots(drawn.el, drawn.doc).filter((s) => s.gap)) expect(marks[slot.index]).toMatchObject({ role: "result" });
  });

  it("draws every line of a sign chart as an axis, and paints each row's set on it", () => {
    const { el, doc } = board("quadro (x-1)(x+2)/(x-3) <= 0");
    const marks = boardLayout(el, doc)!.marks;
    expect(marks.filter((m) => m.kind === "head")).toHaveLength(5);
    const painted = new Set(marks.flatMap((m) => (m.kind === "line" && m.role === "result" ? [Math.round(m.a.y)] : [])));
    expect(painted.size).toBe(4);
    expect(texts("quadro (x-1)^2(x+3)")).toContain("(x − 1)²");
  });
});
