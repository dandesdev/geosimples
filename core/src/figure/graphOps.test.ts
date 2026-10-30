import { describe, expect, it } from "vitest";
import { findExtrema, findRoots } from "../plot";
import {
  addFunction,
  addNumberLine,
  addPoints,
  addVerticalLine,
  applyInput,
  construct,
  connectPoints,
  emptyDoc,
  functionLines,
  linearExpr,
  makeCircle,
  makePolygon,
  markNotable,
  moveNumberLine,
  movePoints,
  normalizeDoc,
  parseInput,
  settleDoc,
  toFunctions,
  toTikz,
  updateElements,
  type Element,
  type FigureDoc,
  type FunctionGraph,
  type Point,
  type Segment,
  type VerticalLine,
} from "./index";

const graph = (expr: string, doc: FigureDoc = emptyDoc()) => {
  const r = addFunction(doc, expr);
  if (r.error) throw new Error(r.error);
  return r.doc;
};
const points = (doc: FigureDoc) => doc.elements.filter((e): e is Point => e.type === "point");
const at = (doc: FigureDoc) => points(doc).map((p) => [p.x, p.y].map((v) => Math.round(v * 1e6) / 1e6));
const setExpr = (doc: FigureDoc, id: string, expr: string) =>
  updateElements(doc, [id], (e) => ({ ...e, expr }) as FunctionGraph);
const byId = (doc: FigureDoc, id: string) => doc.elements.find((e) => e.id === id) as Element;

describe("roots and turning points", () => {
  it("find sign changes and touching roots, but not asymptotes", () => {
    expect(findRoots((x) => x * x - 1, [-5, 5])).toEqual([-1, 1]);
    expect(findRoots((x) => (x - 1) ** 2, [-5, 5])).toEqual([1]);
    expect(findRoots((x) => 1 / x, [-5, 5])).toEqual([]);
    expect(findRoots(Math.tan, [-2, 2])).toEqual([0]);
    expect(findRoots(Math.sin, [-5, 5]).map((x) => Math.round(x * 1e6) / 1e6)).toEqual([-3.141593, 0, 3.141593]);
  });

  it("find maxima and minima, skipping asymptotes and the interval's ends", () => {
    expect(findExtrema((x) => x * x - 2 * x - 1, [-5, 5], 10)).toEqual([{ x: 1, y: -2, kind: "min" }]);
    expect(findExtrema(Math.sin, [-5, 5], 10).map((e) => e.kind)).toEqual(["max", "min", "max", "min"]);
    expect(findExtrema(Math.tan, [-3, 3], 10)).toEqual([]);
    expect(findExtrema(Math.abs, [-5, 5], 10)).toEqual([{ x: 0, y: 0, kind: "min" }]);
    expect(findExtrema((x) => x, [-5, 5], 10)).toEqual([]);
  });
});

describe("notable points", () => {
  it("mark roots as x₁, x₂, the vertex as V, and the y crossing unnamed", () => {
    let doc = graph("x^2 - 1");
    const roots = markNotable(doc, ["f1"], "root");
    expect(at(roots.doc)).toEqual([[-1, 0], [1, 0]]);
    expect(points(roots.doc).map((p) => p.label?.text)).toEqual(["x₁", "x₂"]);
    expect(markNotable(roots.doc, ["f1"], "root").error).toMatch(/já estão marcadas/);
    doc = markNotable(roots.doc, ["f1"], "extremum").doc;
    expect(points(doc).at(-1)).toMatchObject({ x: 0, y: -1, label: { text: "V" } });
    const y = markNotable(graph("2x + 3"), ["f1"], "yAxis");
    expect(at(y.doc)).toEqual([[0, 3]]);
    expect(points(y.doc)[0].label).toBeUndefined();
    expect(markNotable(graph("x^2 + 1"), ["f1"], "root").error).toMatch(/não tem raízes/);
    expect(markNotable(graph("x"), [], "root").error).toMatch(/Selecione um gráfico/);
  });

  it("recompute when the formula changes, and go away with a note when they vanish", () => {
    const doc = markNotable(graph("x^2 - 1"), ["f1"], "root").doc;
    const wider = setExpr(doc, "f1", "x^2 - 4");
    expect(at(wider)).toEqual([[-2, 0], [2, 0]]);
    expect(settleDoc(doc, wider).dropped).toEqual([]);
    const none = setExpr(wider, "f1", "x^2 + 1");
    const settled = settleDoc(wider, none);
    expect(settled.dropped).toEqual(["x₁", "x₂"]);
    expect(points(settled.doc)).toEqual([]);
  });

  it("note when a graph gains roots nobody marked", () => {
    const doc = markNotable(graph("x - 1"), ["f1"], "root").doc;
    const settled = settleDoc(doc, setExpr(doc, "f1", "x^3 - x"));
    expect(settled.dropped).toEqual([]);
    expect(settled.notes).toEqual(["f tem 3 raízes agora; só 1 estão marcados."]);
  });
});

describe("intersections with graphs and vertical lines", () => {
  const cross = (doc: FigureDoc, sel: string[]) => {
    const r = construct(doc, sel, "intersection");
    if (r.error) throw new Error(r.error);
    return r.doc;
  };

  it("cross two graphs, and follow their formulas until the crossing is gone", () => {
    const doc = cross(graph("x", graph("x^2")), ["f1", "f2"]);
    expect(at(doc)).toEqual([[0, 0], [1, 1]]);
    const moved = setExpr(doc, "f2", "x + 2");
    expect(at(moved)).toEqual([[-1, 1], [2, 4]]);
    const apart = setExpr(moved, "f2", "x - 5");
    expect(settleDoc(moved, apart).dropped).toHaveLength(2);
  });

  it("cross a graph with a vertical line, a segment and a circle", () => {
    let doc = addVerticalLine(graph("x^2"), 2).doc;
    expect(at(cross(doc, ["f1", "r1"]))).toEqual([[2, 4]]);
    doc = applyInput(doc, parseInput("A=(-2;1)--B=(2;1)")).doc;
    const seg = doc.elements.find((e) => e.type === "segment")!.id;
    expect(at(cross(doc, ["f1", seg])).slice(-2)).toEqual([[-1, 1], [1, 1]]);
    const circle = makeCircle(addPoints(graph("x"), [{ x: 0, y: 0 }]).doc, ["p1"], "radius").doc;
    const c = circle.elements.find((e) => e.type === "circle")!.id;
    const h = Math.round(Math.SQRT1_2 * 1e6) / 1e6;
    expect(at(cross(circle, ["f1", c])).slice(1)).toEqual([[-h, -h], [h, h]]);
  });

  it("cross a vertical line with a circle and a segment, but not with another vertical line", () => {
    let doc = makeCircle(addPoints(emptyDoc(), [{ x: 0, y: 0 }]).doc, ["p1"], "radius").doc;
    doc = addVerticalLine(doc, 0.6).doc;
    expect(at(cross(doc, ["c1", "r1"])).slice(1)).toEqual([[0.6, -0.8], [0.6, 0.8]]);
    doc = addVerticalLine(doc, 1).doc;
    expect(construct(doc, ["r1", "r2"], "intersection").error).toMatch(/não se cruzam/);
    const withSeg = connectPoints(addPoints(addVerticalLine(emptyDoc(), 1).doc, [{ x: 0, y: 0 }, { x: 2, y: 2 }]).doc, ["p1", "p2"], false).doc;
    expect(at(cross(withSeg, ["r1", "s1"])).slice(-1)).toEqual([[1, 1]]);
  });

  it("drop a segment and circle crossing once the circle moves away", () => {
    let doc = addPoints(emptyDoc(), [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 2, y: 0 }]).doc;
    doc = makeCircle(doc, ["p1"], "radius").doc;
    doc = connectPoints(doc, ["p2", "p3"], false).doc;
    doc = cross(doc, ["c1", "s1"]);
    expect(points(doc)).toHaveLength(5);
    const away = movePoints(doc, [{ id: "p1", x: 0, y: 5 }]);
    expect(settleDoc(doc, away).dropped).toHaveLength(2);
  });

  it("are kept through normalize", () => {
    const doc = cross(graph("x", graph("x^2")), ["f1", "f2"]);
    expect(normalizeDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });
});

describe("number line", () => {
  it("goes at y = 0 in an empty figure, or under what's there", () => {
    expect(addNumberLine(emptyDoc()).doc.elements[0]).toMatchObject({ type: "numberline", x: [-5, 5], y: 0 });
    expect(addNumberLine(graph("x")).doc.elements.at(-1)).toMatchObject({ y: -7 });
  });

  it("takes intervals typed like [-2; 3[ and ]-∞; 1]", () => {
    expect(parseInput("[-2; 3[").intervals).toEqual([{ from: -2, to: 3, closed: [true, false] }]);
    expect(parseInput("]-∞; 1/2]").intervals).toEqual([{ from: null, to: 0.5, closed: [false, true] }]);
    expect(parseInput("[1; +inf[").intervals).toEqual([{ from: 1, to: null, closed: [true, false] }]);
    expect(parseInput("[3; 1]").errors[0].message).toMatch(/menor/);
    expect(parseInput("[+∞; 1]").errors[0].message).toMatch(/-∞/);

    const line = addNumberLine(emptyDoc()).doc;
    const r = applyInput(line, parseInput("[-2; 3["));
    const [mark, a, b] = r.created.map((id) => byId(r.doc, id)) as [Segment, Point, Point];
    expect(mark.stroke.width).toBe(2.4);
    expect([a.x, a.shape, b.x, b.shape]).toEqual([-2, "dot", 3, "ring"]);
    const open = applyInput(line, parseInput("]-∞; 1]")).doc;
    expect(points(open).map((p) => [p.x, p.shape])).toEqual([[-5, "none"], [1, "dot"]]);
    expect(applyInput(emptyDoc(), parseInput("[1; 2]")).error).toMatch(/reta numérica/);
  });

  it("carries its intervals when it moves, and exports ticks and numbers", () => {
    const line = addNumberLine(emptyDoc()).doc;
    const doc = applyInput(line, parseInput("[-2; 3[")).doc;
    const moved = moveNumberLine(doc, "n1", -1);
    expect(points(moved).map((p) => p.y)).toEqual([-1, -1]);
    const tikz = toTikz(line);
    expect(tikz).toContain("\\draw[draw=black, line width=0.6pt] (-5,0) -- (5,0);");
    expect(tikz).toContain("{$-4$}");
    expect(normalizeDoc(JSON.parse(JSON.stringify(moved)))).toEqual(moved);
  });
});

describe("turning shapes into functions", () => {
  it("writes lines the way a textbook does", () => {
    expect(linearExpr(0.75, 0)).toBe("3x/4");
    expect(linearExpr(-0.5, 1)).toBe("-x/2 + 1");
    expect(linearExpr(2, -1 / 3)).toBe("2x - 1/3");
    expect(linearExpr(0, 4)).toBe("4");
    expect(linearExpr(1, 0)).toBe("x");
  });

  it("turns a unit square into y = 0, x = 1, y = 1 and x = 0 over its sides", () => {
    let doc = applyInput(emptyDoc(), parseInput("A=(0;0) B=(1;0) C=(1;1) D=(0;1)")).doc;
    doc = makePolygon(doc, ["p1", "p2", "p3", "p4"]).doc;
    const r = toFunctions(doc, [doc.elements.find((e) => e.type === "polygon")!.id]);
    expect(r.error).toBeUndefined();
    const made = r.created.map((id) => byId(r.doc, id));
    expect(made.map((e) => e.label?.text)).toEqual(["f₁", "f₂", "f₃", "f₄"]);
    const [f1, f2, f3, f4] = made as [FunctionGraph, VerticalLine, FunctionGraph, VerticalLine];
    expect([f1.expr, f1.domain]).toEqual(["0", [0, 1]]);
    expect([f2.type, f2.x, f2.range]).toEqual(["vline", 1, [0, 1]]);
    expect([f3.expr, f3.domain]).toEqual(["1", [0, 1]]);
    expect([f4.type, f4.x, f4.range]).toEqual(["vline", 0, [0, 1]]);
    // The square is gone, its corners stay, and axes come in.
    expect(r.doc.elements.filter((e) => e.type === "polygon" || e.type === "segment")).toEqual([]);
    expect(points(r.doc)).toHaveLength(4);
    expect(r.doc.elements[0].type).toBe("axes");
  });

  it("turns a circle into its two halves, which meet at both ends", () => {
    let doc = makeCircle(addPoints(emptyDoc(), [{ x: 0, y: 0 }]).doc, ["p1"], "radius").doc;
    let r = toFunctions(doc, ["c1"]);
    const [up, down] = r.created.map((id) => byId(r.doc, id)) as FunctionGraph[];
    expect([up.expr, down.expr, up.domain]).toEqual(["raiz(1 - x^2)", "-raiz(1 - x^2)", [-1, 1]]);
    const ends = functionLines(up).flat();
    expect([ends[0], ends.at(-1)]).toEqual([{ x: -1, y: 0 }, { x: 1, y: 0 }]);

    doc = makeCircle(addPoints(emptyDoc(), [{ x: 1, y: 2 }, { x: 1, y: 4 }]).doc, ["p1", "p2"], "through").doc;
    r = toFunctions(doc, ["c1"]);
    expect(r.created.map((id) => (byId(r.doc, id) as FunctionGraph).expr)).toEqual([
      "2 + raiz(4 - (x - 1)^2)",
      "2 - raiz(4 - (x - 1)^2)",
    ]);
  });

  it("turns a slanted segment into y = mx + q over its x span", () => {
    const doc = connectPoints(addPoints(emptyDoc(), [{ x: 0, y: 1 }, { x: 4, y: 4 }]).doc, ["p1", "p2"], false).doc;
    const r = toFunctions(doc, ["s1"]);
    expect(byId(r.doc, r.created[0])).toMatchObject({ expr: "3x/4 + 1", domain: [0, 4] });
    expect(toFunctions(doc, ["p1"]).error).toMatch(/Selecione segmentos/);
  });
});
