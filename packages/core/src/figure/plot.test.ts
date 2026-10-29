import { describe, expect, it } from "vitest";
import {
  addFunction,
  addPoints,
  applyInput,
  buildScene,
  deleteElements,
  emptyDoc,
  labelText,
  normalizeDoc,
  parseInput,
  setAxesWindow,
  toSvg,
  toTikz,
  type Axes,
  type FunctionGraph,
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
    const gridded = { ...doc, elements: [{ ...axes, grid: true }, doc.elements[1]] };
    expect(buildScene(gridded).prims.length).toBeGreaterThan(buildScene(doc).prims.length);
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
