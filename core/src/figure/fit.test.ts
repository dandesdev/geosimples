import { describe, expect, it } from "vitest";
import {
  addAxes,
  addFunction,
  addGrid,
  addPoints,
  connectPoints,
  emptyDoc,
  fitAxesWindow,
  fitFigure,
  gridWindow,
  makeCircle,
  niceStep,
  toTikz,
  type Axes,
  type FigureDoc,
  type FunctionGraph,
  type Grid,
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
    expect([2, 4, 10, 20, 30, 100].map(niceStep)).toEqual([0.5, 1, 1, 2, 5, 10]);
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
    // x² never goes under 0: no y down to -5, and the curve is cut at twice the width.
    const parabola = fitFigure(withGraph("x^2"));
    expect(fitted(parabola)).toEqual({ x: [-5, 5], y: [-2, 22], step: 1, yStep: 2 });
    const graph = parabola.elements.find((e): e is FunctionGraph => e.type === "function")!;
    expect([graph.domain, graph.range]).toEqual([[-5, 5], [-2, 22]]);
    // An asymptote runs off both ways: an even split.
    expect(fitted(withGraph("1/x"))).toMatchObject({ y: [-12, 12] });
    expect(fitted(withGraph("x/2"))).toMatchObject({ y: [-4, 4] });
  });

  it("fit graphs and geometry together, and leave hand-set axes alone", () => {
    const both = withGraph("x", addPoints(addAxes(emptyDoc()).doc, [{ x: 8, y: 1 }]).doc);
    expect(fitted(both)).toMatchObject({ x: [-5, 9] });
    const byHand = { ...both, elements: both.elements.map((e) => (e.type === "axes" ? { ...e, fit: false } : e)) };
    expect(fitFigure(byHand)).toBe(byHand);
  });

  it("show the fitted window in the exports", () => {
    expect(toTikz(fitFigure(withGraph("x^2")))).toContain("(0,-2) -- (0,22)");
    expect(fitAxesWindow(withGraph("x^2"), axesOf(withGraph("x^2"))).yStep).toBe(2);
  });
});

describe("printed grids", () => {
  it("lie over the axes, with their ticks, or fit around the figure", () => {
    const over = addGrid(fitFigure(withGraph("x^2"))).doc;
    const grid = over.elements[0] as Grid;
    expect(gridWindow(over, grid)).toEqual({ x: [-5, 5], y: [-2, 22], stepX: 1, stepY: 2 });
    expect(addGrid(over).error).toMatch(/já tem uma malha/);

    const alone = addGrid(addPoints(emptyDoc(), [{ x: 0.5, y: 0.5 }, { x: 3, y: 2 }]).doc).doc;
    expect(alone.elements[0]).toMatchObject({ follow: "figure" });
    expect(fitFigure(alone).elements[0]).toMatchObject({ x: [-1, 4], y: [-1, 3] });
    // A fixed grid stays where it was set.
    const fixed = { ...alone, elements: alone.elements.map((e) => (e.type === "grid" ? { ...e, follow: "none" as const } : e)) };
    expect(fitFigure(fixed)).toBe(fixed);
  });
});
