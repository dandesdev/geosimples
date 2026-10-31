import { describe, expect, it } from "vitest";
import {
  addFunction,
  addGrid,
  addPointOnGraph,
  addPoints,
  addVerticalLine,
  applyInput,
  buildScene,
  deleteElements,
  emptyDoc,
  functionEnds,
  labelText,
  movePoints,
  normalizeDoc,
  parseInput,
  piText,
  piWindow,
  setAxesWindow,
  toggleGuides,
  toSvg,
  toTikz,
  updateElements,
  type Axes,
  type EndMark,
  type FigureDoc,
  type FunctionGraph,
  type Point,
  type VerticalLine,
} from "./index";

const graph = (expr: string) => {
  const r = addFunction(emptyDoc(), expr);
  if (r.error) throw new Error(r.error);
  return r.doc;
};

describe("function graphs", () => {
  it("adds axes once, then each function over them, named f, g…", () => {
    const one = addFunction(emptyDoc(), "x^2 - 1");
    expect(one.doc.elements.map((e) => e.type)).toEqual(["axes", "function"]);
    const f = one.doc.elements[1] as FunctionGraph;
    expect(f.domain).toEqual([-5, 5]);
    expect(f.range).toEqual([-5, 5]);
    expect(labelText(one.doc, f)).toBe("f");

    const two = addFunction(one.doc, "2x + 1");
    expect(two.doc.elements.map((e) => e.type)).toEqual(["axes", "function", "function"]);
    expect(labelText(two.doc, two.doc.elements[2])).toBe("g");
    expect(addFunction(two.doc, "x", "h").doc.elements.at(-1)!.label?.text).toBe("h");
  });

  it("refuses an expression it can't read, saying why", () => {
    const r = addFunction(emptyDoc(), "2y");
    expect(r.error).toMatch(/y/);
    expect(r.doc.elements).toHaveLength(0);
  });

  it("is typed in the point input as f(x) = … or y = …", () => {
    const p = parseInput("f(x) = x^2 - 1");
    expect(p.functions).toEqual([{ name: "f", expr: "x^2 - 1" }]);
    expect(p.errors).toEqual([]);
    expect(parseInput("y=2x+1").functions).toEqual([{ name: "", expr: "2x+1" }]);
    expect(parseInput("Y = x").functions).toEqual([{ name: "", expr: "x" }]);
    // A point named y is still a point.
    expect(parseInput("y=(1;2)").functions).toEqual([]);
    expect(parseInput("y=(1;2)").nodes).toHaveLength(1);
    const bad = parseInput("g(x) = 2 +");
    expect(bad.errors[0].message).toMatch(/termina/);

    const doc = applyInput(emptyDoc(), parseInput("g(x)=sen(x)")).doc;
    expect(doc.elements.map((e) => e.type)).toEqual(["axes", "function"]);
    expect(labelText(doc, doc.elements[1])).toBe("g");
  });

  it("draws the same curve in the preview, the SVG and TikZ", () => {
    const doc = graph("x^2 - 1");
    const scene = buildScene(doc);
    const curve = scene.prims.find((p) => p.owner === "f1" && p.kind === "path");
    expect(curve?.kind === "path" && curve.d.startsWith("M")).toBe(true);
    expect(scene.hits.some((h) => h.owner === "f1")).toBe(true);
    // Axes and their numbers come before the curve: the figure draws over them.
    expect(scene.prims.findIndex((p) => p.owner === "e1")).toBeLessThan(scene.prims.findIndex((p) => p.owner === "f1"));
    const svg = toSvg(doc);
    expect(svg).toContain(">-2<");
    const tikz = toTikz(doc);
    expect(tikz).toContain("plot coordinates {");
    expect(tikz).toMatch(/\(-2\.449,5\)|\(-2\.45,5\)/);
    expect(tikz).toContain("{$x$}");
    expect(tikz).toContain("{$f$}");
    // No library beyond plain TikZ.
    expect(tikz).not.toContain("usetikzlibrary");
  });

  it("breaks 1/x at its asymptote in the export too", () => {
    const tikz = toTikz(graph("1/x"));
    expect(tikz.match(/plot coordinates/g)).toHaveLength(2);
  });

  it("draws grid lines when asked, and nothing for an unreadable saved expression", () => {
    const doc = graph("x");
    const axes = doc.elements[0] as Axes;
    const gridded = addGrid(doc).doc;
    expect(gridded.elements[0]).toMatchObject({ type: "grid", follow: "axes" });
    expect(buildScene(gridded).prims.length).toBeGreaterThan(buildScene(doc).prims.length);
    // Axes saved with a grid of their own, from before grids were elements, get one over them.
    const old = normalizeDoc({ ...doc, elements: [{ ...axes, grid: true }, doc.elements[1]] });
    expect(old.elements.map((e) => e.type)).toEqual(["grid", "axes", "function"]);
    expect(old.elements[1]).not.toHaveProperty("grid");
    // Lines at both ends, not only at -5: the grid is even.
    const grid = toTikz(gridded).split("\n").find((l) => l.startsWith("\\draw[draw=gs1"))!;
    expect(grid).toContain("(5,-5) -- (5,5)");
    expect(grid).toContain("(-5,5) -- (5,5)");
    const broken = normalizeDoc({ ...doc, elements: [axes, { ...doc.elements[1], expr: "x +" }] });
    expect(broken.elements).toHaveLength(2);
    expect(buildScene(broken).prims.filter((p) => p.owner === "f1" && p.kind === "path")).toHaveLength(0);
  });

  it("survives a save and load, and fixes bad saved values", () => {
    const doc = graph("x^2");
    expect(normalizeDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    const fixed = normalizeDoc({
      kind: "geo",
      version: 1,
      elements: [
        { id: "e1", type: "axes", x: [3, -3], step: -1, names: [5] },
        { id: "f1", type: "function", expr: "x", domain: "all", range: [0, 1] },
        { id: "f2", type: "function", expr: "" },
      ],
    });
    const [axes, f] = fixed.elements as [Axes, FunctionGraph];
    expect(axes.x).toEqual([-5, 5]);
    expect(axes.step).toBe(0.01);
    expect(axes.names).toEqual(["x", "y"]);
    expect(f.domain).toEqual([-5, 5]);
    expect(f.range).toEqual([0, 1]);
    expect(fixed.elements).toHaveLength(2);
  });

  it("lives beside geometry: deleting points keeps graphs", () => {
    const withPoint = addPoints(graph("x"), [{ x: 1, y: 1 }]);
    const after = deleteElements(withPoint.doc, withPoint.created).doc;
    expect(after.elements.map((e) => e.type)).toEqual(["axes", "function"]);
  });
});

describe("axes window", () => {
  it("carries the graphs drawn over it, and leaves graphs with their own domain", () => {
    let doc = graph("x^2");
    doc = addFunction(doc, "x").doc;
    const own = doc.elements[2] as FunctionGraph;
    doc = { ...doc, elements: doc.elements.map((e) => (e.id === own.id ? { ...own, domain: [0, 2] as [number, number] } : e)) };
    const r = setAxesWindow(doc, "e1", [-8, 8], [-2, 10]);
    const [axes, f, g] = r.doc.elements as [Axes, FunctionGraph, FunctionGraph];
    expect(axes.x).toEqual([-8, 8]);
    expect(f.domain).toEqual([-8, 8]);
    expect(f.range).toEqual([-2, 10]);
    expect(g.domain).toEqual([0, 2]);
    expect(g.range).toEqual([-2, 10]);
    expect(setAxesWindow(doc, "e1", [3, 1], [0, 1]).error).toMatch(/menor/);
  });
});

describe("vertical lines", () => {
  it("are typed as x = a, never taking a point like x=(1;2)", () => {
    expect(parseInput("x = 2").lines).toEqual([{ x: 2 }]);
    expect(parseInput("x=-1,5").lines).toEqual([{ x: -1.5 }]);
    expect(parseInput("x = pi/2").lines[0].x).toBeCloseTo(Math.PI / 2);
    expect(parseInput("x=(1;2)").nodes).toHaveLength(1);
    expect(parseInput("x = x + 1").errors[0].message).toMatch(/número/);
  });

  it("come dashed over the axes, which they add when missing, and follow the axes window", () => {
    const r = applyInput(emptyDoc(), parseInput("x = 2"));
    expect(r.doc.elements.map((e) => e.type)).toEqual(["axes", "vline"]);
    const line = r.doc.elements[1] as VerticalLine;
    expect(line.stroke.dash).toBe("dashed");
    expect(line.range).toEqual([-5, 5]);
    const wider = setAxesWindow(r.doc, "e1", [-5, 5], [-8, 8]).doc;
    expect((wider.elements[1] as VerticalLine).range).toEqual([-8, 8]);
    expect(toTikz(r.doc)).toContain("\\draw[draw=black, line width=0.8pt, dashed] (2,-5) -- (2,5);");
    expect(buildScene(r.doc).hits.some((h) => h.type === "vline")).toBe(true);
  });
});

describe("points on graphs", () => {
  const ctx = (doc: FigureDoc) => ({
    points: [],
    graphs: doc.elements.flatMap((e) => (e.type === "function" ? [{ id: e.id, name: e.label?.text ?? "" }] : [])),
  });

  it("are typed as P = f(2) for a graph named f", () => {
    const doc = graph("x^2");
    expect(parseInput("P = f(2)", ctx(doc)).graphPoints).toEqual([{ graph: "f1", x: 2, label: "P" }]);
    expect(parseInput("f(-1,5)", ctx(doc)).graphPoints).toEqual([{ graph: "f1", x: -1.5, label: "" }]);
    expect(parseInput("g(2)", ctx(doc)).graphPoints).toEqual([]);
    expect(parseInput("f(x) = 2x", ctx(doc)).functions).toHaveLength(1);
  });

  it("sit at (x, f(x)), follow the expression, and stay put where it's undefined", () => {
    const doc = graph("x^2");
    const r = applyInput(doc, parseInput("P = f(2)", ctx(doc)));
    const p = r.doc.elements.find((e) => e.id === r.created[0]) as Point;
    expect([p.x, p.y, p.label?.text]).toEqual([2, 4, "P"]);
    const changed = updateElements(r.doc, ["f1"], (e) => ({ ...e, expr: "x + 1" }) as FunctionGraph);
    expect((changed.elements.find((e) => e.id === p.id) as Point).y).toBe(3);
    const undefinedThere = updateElements(changed, ["f1"], (e) => ({ ...e, expr: "1/(x - 2)" }) as FunctionGraph);
    expect((undefinedThere.elements.find((e) => e.id === p.id) as Point).y).toBe(3);
  });

  it("slide along the graph when dragged, and become free when it's deleted", () => {
    const doc = graph("x^2");
    const r = addPointOnGraph(doc, "f1", 1);
    const id = r.created[0];
    const moved = movePoints(r.doc, [{ id, x: -2, y: 4 }]);
    expect(moved.elements.find((e) => e.id === id)).toMatchObject({ x: -2, y: 4 });
    // Taken beside the steep arm, it goes to the curve's nearest point, not straight up from the pointer's x.
    const beside = movePoints(r.doc, [{ id, x: 2.5, y: 4 }]).elements.find((e) => e.id === id) as Point;
    expect(beside.x).toBeCloseTo(2.03, 2);
    const freed = deleteElements(moved, ["f1"]).doc.elements.find((e) => e.id === id) as Point;
    expect(freed.construction).toBeUndefined();
    expect([freed.x, freed.y]).toEqual([-2, 4]);
  });

  it("get a whole x where the curve shows when none is given, or say where f is undefined", () => {
    const r = addPointOnGraph(graph("x^2"), "f1", null);
    expect(r.doc.elements.find((e) => e.id === r.created[0])).toMatchObject({ x: 1, y: 1 });
    expect(addPointOnGraph(graph("raiz(x)"), "f1", -1).error).toMatch(/não está definida em x = -1/);
    expect(addPointOnGraph(graph("x"), "e1", 1).error).toMatch(/Selecione um gráfico/);
  });
});

describe("guides to the axes", () => {
  it("turn on and off for selected points, and need axes", () => {
    const doc = addPoints(graph("x"), [{ x: 2, y: 3 }]).doc;
    const on = toggleGuides(doc, ["p1"]);
    expect((on.doc.elements[2] as Point).guides?.dash).toBe("dashed");
    expect(toTikz(on.doc)).toContain("\\draw[draw=black, line width=0.5pt, dashed] (p1) -- (2,0) (p1) -- (0,3);");
    expect((toggleGuides(on.doc, ["p1"]).doc.elements[2] as Point).guides).toBeUndefined();
    expect(toggleGuides(addPoints(emptyDoc(), [{ x: 1, y: 1 }]).doc, ["p1"]).error).toMatch(/eixos/);
  });

  it("skip the line along an axis the point sits on", () => {
    const doc = toggleGuides(addPoints(graph("x"), [{ x: 2, y: 0 }]).doc, ["p1"]).doc;
    expect(toTikz(doc)).toContain("(p1) -- (0,0);");
    expect(toTikz(doc)).not.toContain("(p1) -- (2,0)");
  });
});

describe("graph ends", () => {
  it("draw closed and open dots where the curve reaches the domain's ends", () => {
    const doc = graph("x");
    const f = { ...(doc.elements[1] as FunctionGraph), domain: [-2, 3] as [number, number], ends: ["closed", "open"] as [EndMark, EndMark] };
    expect(functionEnds(f)).toEqual([
      { at: { x: -2, y: -2 }, open: false },
      { at: { x: 3, y: 3 }, open: true },
    ]);
    const tikz = toTikz({ ...doc, elements: [doc.elements[0], f] });
    expect(tikz).toMatch(/\\fill\[black\] \(-2,-2\) circle/);
    expect(tikz).toMatch(/\\filldraw\[draw=black, fill=white, line width=0.64pt\] \(3,3\) circle/);
    // Outside the y cut there's no curve to end, so no dot.
    expect(functionEnds({ ...f, range: [-1, 5] })).toHaveLength(1);
  });
});

describe("π ticks", () => {
  it("write multiples of π the textbook way", () => {
    expect([0.5, 1, 1.5, 2, -0.5, -1, 2 / 3, 1 / 6].map((r) => piText(r * Math.PI))).toEqual([
      "π/2",
      "π",
      "3π/2",
      "2π",
      "-π/2",
      "-π",
      "2π/3",
      "π/6",
    ]);
    expect(piText(1)).toBeNull();
  });

  it("put x ticks every xPi·π, keep y in units, and suit the window to them", () => {
    const doc = graph("sen(x)");
    const axes = { ...(doc.elements[0] as Axes), xPi: 0.5, x: piWindow([-5, 5], 0.5) };
    expect(axes.x).toEqual([-5.212, 5.212]);
    const tikz = toTikz({ ...doc, elements: [axes] });
    expect(tikz).toContain("{$\\pi /2$}");
    expect(tikz).toContain("{$-3\\pi /2$}");
    expect(tikz).toContain("{$2$}");
    expect(normalizeDoc({ ...doc, elements: [axes] }).elements[0]).toMatchObject({ xPi: 0.5 });
  });
});

describe("saved graph tools", () => {
  it("keep guides, ends, vertical lines and points on graphs through normalize", () => {
    let doc = graph("x^2");
    doc = addPointOnGraph(doc, "f1", 1).doc;
    doc = toggleGuides(doc, ["p1"]).doc;
    doc = addVerticalLine(doc, 2).doc;
    doc = updateElements(doc, ["f1"], (e) => ({ ...e, ends: ["open", "closed"] }) as FunctionGraph);
    expect(normalizeDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });
});
