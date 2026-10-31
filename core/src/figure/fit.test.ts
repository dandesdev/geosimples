import { describe, expect, it } from "vitest";
import {
  addAxes,
  addFunction,
  addGrid,
  addVerticalLine,
  construct,
  addPoints,
  addPointOnGraph,
  connectPoints,
  dragHandle,
  elementHandles,
  emptyDoc,
  fitAxesWindow,
  fitFigure,
  gridWindow,
  makeCircle,
  markNotable,
  setAxesWindow,
  settleDoc,
  updateElements,
  addNumberLine,
  buildScene,
  moveElements,
  niceStep,
  toTikz,
  type Axes,
  type FigureDoc,
  type FunctionGraph,
  type Grid,
  type Prim,
} from "./index";

const axesOf = (doc: FigureDoc) => doc.elements.find((e): e is Axes => e.type === "axes")!;
const fitted = (doc: FigureDoc) => {
  const a = axesOf(fitFigure(doc));
  return { x: a.x, y: a.y, step: a.step, yStep: a.yStep };
};
const withGraph = (expr: string, doc = emptyDoc()) => addFunction(doc, expr).doc;
const triangle = () =>
  connectPoints(addAxes(addPoints(emptyDoc(), [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }]).doc).doc, ["p1", "p2", "p3"], true).doc;

describe("axes that fit the figure", () => {
  it("count in round steps that keep the numbers apart", () => {
    expect([2, 4, 10, 20, 30, 100].map((span) => niceStep(span))).toEqual([0.5, 1, 1, 2, 5, 10]);
    // On an axis at 0.2 cm per unit, ticks every 1 would sit 2 mm apart.
    expect(niceStep(20, 0.2)).toBe(5);
  });

  it("come in on their own, fitting, and start at the usual window in an empty figure", () => {
    const doc = addAxes(emptyDoc()).doc;
    expect(axesOf(doc)).toMatchObject({ fit: true, x: [-5, 5], y: [-5, 5] });
    expect(fitFigure(doc)).toBe(doc);
    expect(addAxes(doc).error).toMatch(/já tem eixos/);
  });

  it("take in geometry with a tick of room, and a tick past the origin", () => {
    expect(fitted(triangle())).toEqual({ x: [-1, 5], y: [-1, 4], step: 1, yStep: undefined });
    // A unit circle counts in halves.
    const circle = makeCircle(addAxes(addPoints(emptyDoc(), [{ x: 0, y: 0 }]).doc).doc, ["p1"], "radius").doc;
    expect(fitted(circle)).toMatchObject({ x: [-1.5, 1.5], y: [-1.5, 1.5], step: 0.5 });
  });

  it("drop the unused side of a graph, and cut a tall one rather than stretch", () => {
    // x² never goes under 0: no y down to -5. x spans its vertex with room, and the curve is cut at 1.5 times the width.
    const parabola = fitFigure(withGraph("x^2"));
    expect(fitted(parabola)).toEqual({ x: [-3, 3], y: [-1, 10], step: 1, yStep: undefined });
    const graph = parabola.elements.find((e): e is FunctionGraph => e.type === "function")!;
    expect([graph.domain, graph.range]).toEqual([[-3, 3], [-1, 10]]);
    expect(fitted(withGraph("x^2 - 1"))).toMatchObject({ x: [-3, 3], y: [-2, 9] });
    // An asymptote runs off both ways: an even split.
    expect(fitted(withGraph("1/x"))).toMatchObject({ y: [-6, 6] });
    expect(fitted(withGraph("x/2"))).toMatchObject({ y: [-3, 3] });
    // Roots and turning points far apart widen x to take them all.
    expect(fitted(withGraph("sen(x)"))).toMatchObject({ x: [-6, 6], y: [-1.5, 1.5] });
    expect(fitted(withGraph("2x + 10"))).toMatchObject({ x: [-6, 1] });
    // A curve far above the origin still shows: the cut keeps its part nearest the origin.
    expect(fitted(withGraph("x + 100"))).toMatchObject({ y: [-10, 120] });
  });

  it("don't stretch a graph for a point on it, its roots or its crossings", () => {
    const parabola = fitFigure(withGraph("x^2"));
    const onIt = fitFigure(addPointOnGraph(parabola, "f1", 2.5).doc);
    expect(fitted(onIt)).toMatchObject({ x: [-3, 3] });
    expect(onIt.elements.find((e) => e.id === "f1")).toMatchObject({ domain: [-3, 3] });
    // Nor for geometry inside its window; past it, geometry gets its tick of room.
    expect(fitted(addPoints(parabola, [{ x: 2.5, y: 1 }]).doc)).toMatchObject({ x: [-3, 3] });
    expect(fitted(addPoints(parabola, [{ x: 3.5, y: 1 }]).doc)).toMatchObject({ x: [-3, 5] });
  });

  it("fit graphs and geometry together, and leave hand-set axes alone", () => {
    const both = withGraph("x", addPoints(addAxes(emptyDoc()).doc, [{ x: 8, y: 1 }]).doc);
    expect(fitted(both)).toMatchObject({ x: [-3, 9] });
    const byHand = { ...both, elements: both.elements.map((e) => (e.type === "axes" ? { ...e, fit: false } : e)) };
    expect(fitFigure(byHand)).toBe(byHand);
  });

  it("keep marked roots where they are when the window grows or shrinks", () => {
    const sine = fitFigure(markNotable(withGraph("sen(x)", addAxes(emptyDoc()).doc), ["f1"], "root").doc);
    const roots = (d: FigureDoc) => d.elements.flatMap((e) => (e.type === "point" && e.construction ? [Math.round(e.x * 1000) / 1000] : []));
    expect(roots(sine)).toEqual([-3.142, 0, 3.142]);
    // A point far left widens the window: the roots it brings in are not the ones marked.
    const wider = fitFigure(addPoints(sine, [{ x: -14, y: 0 }]).doc);
    expect(axesOf(wider).x[0]).toBeLessThan(-14);
    expect(roots(wider)).toEqual([-3.142, 0, 3.142]);
    // A window that leaves -π out drops that mark, and only that one.
    const narrow = settleDoc(sine, setAxesWindow(sine, "e1", [-1, 5], axesOf(sine).y).doc);
    expect(narrow.dropped).toEqual(["x₁"]);
    expect(roots(narrow.doc)).toEqual([0, 3.142]);
  });

  it("keep marked roots where they are when a graph's domain is dragged or typed", () => {
    const sine = fitFigure(markNotable(withGraph("sen(x)", addAxes(emptyDoc()).doc), ["f1"], "root").doc);
    const marks = (d: FigureDoc) =>
      d.elements.flatMap((e) => (e.type === "point" && e.construction ? [[e.label?.text, Math.round(e.x * 1000) / 1000]] : []));
    const dragged = settleDoc(sine, fitFigure(dragHandle(sine, { owner: "f1", end: "x0" }, { x: -2, y: 0 })));
    expect(dragged.dropped).toEqual(["x₁"]);
    expect(marks(dragged.doc)).toEqual([["x₂", 0], ["x₃", 3.142]]);
    const typed = updateElements(sine, ["f1"], (e) => (e.type === "function" ? { ...e, domain: [-2, 5] } : e));
    expect(settleDoc(sine, typed).dropped).toEqual(["x₁"]);
    // A new expression still carries the marks by place.
    const changed = updateElements(sine, ["f1"], (e) => (e.type === "function" ? { ...e, expr: "sen(x - 1)" } : e));
    expect(marks(changed).map(([, x]) => x)).toEqual([-2.142, 1, 4.142]);
    // A vertical line typed to a new x takes its crossing with it.
    const crossed = construct(addVerticalLine(withGraph("x^2"), 2).doc, ["f1", "r1"], "intersection").doc;
    const moved = updateElements(crossed, ["r1"], (e) => (e.type === "vline" ? { ...e, x: 3 } : e));
    expect(settleDoc(crossed, moved).dropped).toEqual([]);
    expect(moved.elements.find((e) => e.type === "point")).toMatchObject({ x: 3, y: 9 });
  });

  it("show the fitted window in the exports", () => {
    expect(toTikz(fitFigure(withGraph("x^2")))).toContain("(0,-1) -- (0,10)");
    expect(fitAxesWindow(withGraph("x + 100"), axesOf(withGraph("x + 100"))).yStep).toBe(10);
  });
});

describe("printed grids", () => {
  it("lie over the axes, with their ticks, or fit around the figure", () => {
    const over = addGrid(fitFigure(withGraph("x^2"))).doc;
    const grid = over.elements[0] as Grid;
    expect(gridWindow(over, grid)).toEqual({ x: [-3, 3], y: [-1, 10], stepX: 1, stepY: 1 });
    expect(addGrid(over).error).toMatch(/já tem uma malha/);

    const alone = addGrid(addPoints(emptyDoc(), [{ x: 0.5, y: 0.5 }, { x: 3, y: 2 }]).doc).doc;
    expect(alone.elements[0]).toMatchObject({ follow: "figure" });
    expect(fitFigure(alone).elements[0]).toMatchObject({ x: [-1, 4], y: [-1, 3] });
    // A fixed grid stays where it was set.
    // Left without its axes, a grid that followed them fits the figure.
    const orphan = { ...over, elements: over.elements.filter((e) => e.type !== "axes") };
    expect(fitFigure(orphan).elements[0]).not.toMatchObject({ x: grid.x, y: grid.y });
    const fixed = { ...alone, elements: alone.elements.map((e) => (e.type === "grid" ? { ...e, follow: "none" as const } : e)) };
    expect(fitFigure(fixed)).toBe(fixed);
  });
});

describe("Mover", () => {
  it("drags the ends of axes to the ticks, and the axes stop fitting", () => {
    const doc = fitFigure(withGraph("x"));
    expect(elementHandles(doc, axesOf(doc)).map((h) => [h.end, h.at.x, h.at.y])).toEqual([
      ["x0", -3, 0],
      ["x1", 3, 0],
      ["y0", 0, -4],
      ["y1", 0, 4],
    ]);
    const wider = dragHandle(doc, { owner: "e1", end: "x1" }, { x: 7.3, y: 2 });
    expect(axesOf(wider)).toMatchObject({ x: [-3, 7], fit: false });
    // The graph drawn over the window follows it.
    expect(wider.elements.find((e) => e.type === "function")).toMatchObject({ domain: [-3, 7] });
    // A press that snaps back to the same tick changes nothing, so the axes keep fitting.
    expect(dragHandle(doc, { owner: "e1", end: "x1" }, { x: 3.2, y: 0.1 })).toBe(doc);
    // An end can't pass the other one.
    expect(axesOf(dragHandle(doc, { owner: "e1", end: "x0" }, { x: 9, y: 0 })).x).toEqual([2, 3]);
  });

  it("drags the ends of grids, number lines and graphs", () => {
    const grid = addGrid(addPoints(emptyDoc(), [{ x: 0, y: 0 }]).doc).doc;
    expect(dragHandle(grid, { owner: "m1", end: "y1" }, { x: 0, y: 7.8 }).elements[0]).toMatchObject({ y: [-5, 8], follow: "none" });
    const line = addNumberLine(emptyDoc()).doc;
    expect(dragHandle(line, { owner: "n1", end: "x0" }, { x: -8.2, y: 0 }).elements[0]).toMatchObject({ x: [-8, 5] });
    const graph = fitFigure(withGraph("x^2"));
    const domainAt = (x: number, reach?: number) =>
      dragHandle(graph, { owner: "f1", end: "x0" }, { x, y: x * x }, reach === undefined ? undefined : { x: reach, y: reach }).elements.find(
        (e) => e.id === "f1",
      );
    // A graph's end follows the pointer, and lands on a tick only near one.
    expect(domainAt(0.234)).toMatchObject({ domain: [0.23, 3] });
    expect(domainAt(0.234, 0.3)).toMatchObject({ domain: [0, 3] });
    expect(domainAt(0.534, 0.3)).toMatchObject({ domain: [0.53, 3] });
    // Along the curve, not the x axis: from beside the parabola's arm, the end goes to the nearest point of it.
    const right = dragHandle(graph, { owner: "f1", end: "x1" }, { x: 2.5, y: 4 }).elements.find((e) => e.id === "f1");
    expect(right).toMatchObject({ domain: [-3, 2.03] });
    // On the steep arm, reach is measured on paper along the curve: 0.1 left of the tick is 0.6 down it, out of reach.
    const steep = (to: { x: number; y: number }) =>
      dragHandle(graph, { owner: "f1", end: "x1" }, to, { x: 0.2, y: 0.2 }).elements.find((e) => e.id === "f1");
    expect(steep({ x: 2.9, y: 8.41 })).toMatchObject({ domain: [-3, 2.9] });
    expect(steep({ x: 2.98, y: 8.9 })).toMatchObject({ domain: [-3, 3] });
    // Over the axes, a grid has no ends of its own.
    const over = addGrid(graph).doc;
    expect(elementHandles(over, over.elements[0])).toEqual([]);
  });

  it("moves shapes by their points, so what is built on them follows", () => {
    const doc = makeCircle(triangle(), ["p1", "p3"], "through").doc;
    const moved = moveElements(doc, ["s1"], { x: 1, y: 2 });
    expect(moved.elements.filter((e) => e.type === "point").map((p) => p.type === "point" && [p.x, p.y])).toEqual([
      [1, 2],
      [5, 2],
      [0, 3],
    ]);
    const circle = moveElements(doc, ["c1"], { x: -1, y: 0 });
    expect(circle.elements.filter((e) => e.type === "point").map((p) => p.type === "point" && [p.x, p.y])).toEqual([
      [-1, 0],
      [4, 0],
      [-1, 3],
    ]);
  });
});

describe("settling", () => {
  it("gives back the room fitted axes kept for a crossing that went", () => {
    let doc = connectPoints(addPoints(withGraph("x^2"), [{ x: -2, y: 1 }, { x: 2, y: 1 }]).doc, ["p1", "p2"], false).doc;
    doc = fitFigure(construct(doc, ["f1", "s1"], "intersection").doc);
    // The segment moves far up and right of the parabola: its crossings go, and the axes stop reaching back for them.
    const away = fitFigure(moveElements(doc, ["s1"], { x: 30, y: -20 }));
    const settled = settleDoc(doc, away);
    expect(settled.dropped).toHaveLength(2);
    expect(axesOf(settled.doc)).toEqual(axesOf(fitFigure(settled.doc)));
  });
});

describe("x tick numbers", () => {
  it("move beside a vertical line through them, in the preview and in TikZ", () => {
    const plain = fitFigure(withGraph("1/(x-2)"));
    const doc = addVerticalLine(plain, 2).doc;
    const two = (d: FigureDoc) =>
      buildScene(d).prims.find((p): p is Extract<Prim, { kind: "text" }> => p.kind === "text" && p.owner === "e1" && p.text === "2");
    expect(two(doc)!.x).toBeGreaterThan(two(plain)!.x + 3);
    const node = (d: FigureDoc) => toTikz(d).split("\n").find((l) => l.includes("\\node") && l.endsWith("{$2$};"));
    expect(node(plain)).toContain("[shift={(0pt,");
    expect(node(doc)).toContain("[shift={(4.6pt,");
  });
});

describe("axes at different scales", () => {
  const scaled = (doc: FigureDoc, unit: [number, number]) => ({
    ...doc,
    elements: doc.elements.map((e) => (e.type === "axes" ? { ...e, unit } : e)),
  });

  it("stretch the whole figure: points, curves and circles, which become ellipses", () => {
    const doc = scaled(makeCircle(addAxes(addPoints(emptyDoc(), [{ x: 2, y: 2 }]).doc).doc, ["p1"], "radius").doc, [1, 0.5]);
    const scene = buildScene(doc);
    expect(scene.ky).toBeCloseTo(scene.kx / 2);
    const point = scene.hits.find((h) => h.type === "point")!;
    expect(point).toMatchObject({ x: 2 * scene.kx, y: -2 * scene.ky });
    const outline = scene.hits.find((h) => h.type === "circle")!;
    expect(outline.type === "circle" && outline.d).toMatch(/A28\.346 14\.173 /);
    expect(toTikz(doc)).toContain("[x=1cm, y=0.5cm, miter limit=4]");
  });

  it("let a fitting y axis take a steep curve without the cut, with ticks far enough apart", () => {
    // x³ up to 27: at a fifth of the scale in y it fits whole, counted every 5.
    expect(fitted(withGraph("x^3"))).toMatchObject({ y: [-6, 6] });
    expect(fitted(scaled(withGraph("x^3"), [1, 0.2]))).toMatchObject({ y: [-30, 30], yStep: 5 });
  });
});
