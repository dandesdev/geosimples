/**
 * Representative figures for checking the real exports: each one is written as
 * TikZ (compiled with LaTeX) and SVG, so the two renderings can be compared.
 *
 * The docs are literal FigureDocs rather than results of ops, so they keep
 * testing the same drawing when the editing operations change.
 */
import {
  AXES_GRID,
  DEFAULT_ANGLE,
  DEFAULT_FILL,
  DEFAULT_LABEL,
  DEFAULT_POINT,
  DEFAULT_AXES_STROKE,
  DEFAULT_STROKE,
  type Angle,
  type Axes,
  type FunctionGraph,
  type Circle,
  type Element,
  type FigureDoc,
  type Fill,
  type Label,
  type Point,
  type Polygon,
  type Segment,
  type Stroke,
} from "../src/figure/index";

export interface Fixture {
  name: string;
  doc: FigureDoc;
  /** cm per world unit, as chosen in the export dialog. */
  scale?: number;
}

const doc = (elements: Element[]): FigureDoc => ({ kind: "geo", version: 1, elements });

const label = (text: string, over: Partial<Label> = {}): Label => ({ ...DEFAULT_LABEL, text, ...over });
const stroke = (over: Partial<Stroke> = {}): Stroke => ({ ...DEFAULT_STROKE, ...over });
const fill = (over: Partial<Fill> = {}): Fill => ({ ...DEFAULT_FILL, ...over });

function point(id: string, x: number, y: number, text?: string, over: Partial<Point> = {}): Point {
  return { id, type: "point", x, y, ...DEFAULT_POINT, ...(text ? { label: label(text) } : {}), ...over };
}

function segment(id: string, a: string, b: string, over: Partial<Segment> = {}): Segment {
  return { id, type: "segment", a, b, stroke: stroke(), ticks: 0, ...over };
}

function angle(id: string, a: string, vertex: string, b: string, over: Partial<Angle> = {}): Angle {
  return { id, type: "angle", a, vertex, b, ...DEFAULT_ANGLE, stroke: stroke(), ...over };
}

function polygon(id: string, vertices: string[], over: Partial<Polygon> = {}): Polygon {
  return { id, type: "polygon", vertices, stroke: stroke(), fill: fill(), ...over };
}

function circle(id: string, center: string, radius: number, over: Partial<Circle> = {}): Circle {
  return {
    id,
    type: "circle",
    center,
    radius,
    construction: { kind: "free" },
    arc: null,
    radii: false,
    stroke: stroke(),
    fill: null,
    ...over,
  };
}

/** Square with corners p{i}..p{i+3}, lower left at (x, 0). */
function square(i: number, x: number, side: number): Point[] {
  return [
    point(`p${i}`, x, 0),
    point(`p${i + 1}`, x + side, 0),
    point(`p${i + 2}`, x + side, side),
    point(`p${i + 3}`, x, side),
  ];
}
const squareIds = (i: number) => [`p${i}`, `p${i + 1}`, `p${i + 2}`, `p${i + 3}`];

/** 3-4-5 triangle with the right angle at A, side lengths and an angle measure. */
function rightTriangle(): FigureDoc {
  return doc([
    point("A", 0, 0, "A"),
    point("B", 4, 0, "B"),
    point("C", 0, 3, "C"),
    polygon("g1", ["A", "B", "C"], { fill: fill({ opacity: 0.2 }) }),
    segment("s1", "A", "B", { label: label("4") }),
    segment("s2", "B", "C", { label: label("5") }),
    segment("s3", "C", "A", { label: label("3") }),
    angle("a1", "B", "A", "C"),
    angle("a2", "C", "B", "A", { label: label("36,87°", { size: 8 }) }),
  ]);
}

export const FIXTURES: Fixture[] = [
  { name: "right-triangle", doc: rightTriangle() },
  { name: "right-triangle-scale-0.5", doc: rightTriangle(), scale: 0.5 },
  { name: "right-triangle-scale-2", doc: rightTriangle(), scale: 2 },
  {
    name: "fills",
    doc: doc([
      ...square(1, 0, 2),
      ...square(5, 2.5, 2),
      ...square(9, 5, 2),
      ...square(13, 7.5, 2),
      ...square(17, 10, 2),
      polygon("g1", squareIds(1), { fill: fill({ pattern: "hatch", angle: 45, color: "#d62828", opacity: 1 }), label: label("hatch 45") }),
      polygon("g2", squareIds(5), { fill: fill({ pattern: "crosshatch", angle: 0, color: "#1d4ed8", opacity: 1 }) }),
      polygon("g3", squareIds(9), { fill: fill({ pattern: "dots", angle: 30, color: "#2a9d3f", opacity: 1 }) }),
      polygon("g4", squareIds(13), { fill: fill({ pattern: "hatch", angle: -30, color: "#000000", opacity: 0.4 }), stroke: null }),
      polygon("g5", squareIds(17), { fill: fill({ pattern: "solid", color: "#ea7317", opacity: 0.5 }), stroke: stroke({ color: "#7e22ce", width: 1.5 }) }),
    ]),
  },
  {
    name: "angle-marks",
    doc: doc([
      // Three angles at different vertices, with 1, 2 and 3 arcs and ticks.
      point("O1", 0, 0),
      point("X1", 3, 0),
      point("Y1", 1.5, 2.6),
      point("O2", 4, 0),
      point("X2", 7, 0.5),
      point("Y2", 4.2, 3),
      point("O3", 8, 0),
      point("X3", 10.5, -1),
      point("Y3", 10, 2),
      segment("s1", "O1", "X1"),
      segment("s2", "O1", "Y1"),
      segment("s3", "O2", "X2"),
      segment("s4", "O2", "Y2"),
      segment("s5", "O3", "X3"),
      segment("s6", "O3", "Y3"),
      angle("a1", "X1", "O1", "Y1", { arcs: 1, ticks: 1, label: label("α") }),
      angle("a2", "X2", "O2", "Y2", { arcs: 2, ticks: 2, label: label("β₁"), fill: fill({ color: "#1d4ed8", opacity: 0.3 }) }),
      angle("a3", "X3", "O3", "Y3", {
        arcs: 3,
        ticks: 3,
        radius: 20,
        stroke: stroke({ color: "#d62828", width: 1.2 }),
        label: label("60°"),
        fill: fill({ pattern: "hatch", color: "#d62828", opacity: 1, angle: 45 }),
      }),
    ]),
  },
  {
    name: "reflex-and-right",
    doc: doc([
      point("V", 0, 0, "V"),
      point("P", 2.5, 0.8),
      point("Q", 0.6, 2.5),
      segment("s1", "V", "P"),
      segment("s2", "V", "Q"),
      angle("a1", "P", "V", "Q", { reflex: true, radius: 18, label: label("288,6°"), fill: fill({ color: "#7e22ce", opacity: 0.2 }) }),
      // A rotated right angle, given clockwise (a → vertex → b), with a filled square.
      point("W", 5, 0, "W"),
      point("R", 5 + 2 * Math.cos(Math.PI / 6), 2 * Math.sin(Math.PI / 6)),
      point("S", 5 - 2 * Math.sin(Math.PI / 6), 2 * Math.cos(Math.PI / 6)),
      segment("s3", "W", "R"),
      segment("s4", "W", "S"),
      angle("a2", "S", "W", "R", { fill: fill({ color: "#2a9d3f", opacity: 0.4 }), stroke: stroke({ width: 1.2 }) }),
      // A right angle opening downward, without the square.
      point("U", 9, 2, "U"),
      point("T", 7.5, 0.5),
      point("Z", 10.5, 0.5),
      segment("s5", "U", "T"),
      segment("s6", "U", "Z"),
      angle("a3", "T", "U", "Z", { rightMark: false, label: label("90°") }),
    ]),
  },
  {
    name: "segments",
    doc: doc([
      point("A", 0, 0, "A"),
      point("B", 4, 0, "B"),
      point("C", 0, -1, "C"),
      point("D", 4, -1.5, "D"),
      point("E", 0, -2.5, "E"),
      point("F", 3, -4.5, "F"),
      point("G", 5, 0, "G", { shape: "ring", size: 2.5 }),
      point("H", 7, -4, "H", { shape: "none" }),
      point("I", 9, 0, "I", { color: "#d62828", size: 3 }),
      point("J", 9, -4, "J"),
      segment("s1", "A", "B", { ticks: 1 }),
      segment("s2", "C", "D", { ticks: 2, stroke: stroke({ dash: "dashed" }) }),
      segment("s3", "E", "F", { ticks: 3, stroke: stroke({ dash: "dotted", width: 1.2 }) }),
      segment("s4", "G", "H", { ticks: 2, stroke: stroke({ color: "#1d4ed8", width: 2 }), label: label("2,5 cm") }),
      segment("s5", "I", "J", { stroke: stroke({ color: "#d62828", width: 3, opacity: 0.4 }), label: label("x", { angle: 0 }) }),
    ]),
  },
  {
    name: "circles",
    doc: doc([
      point("O1", 0, 0, "O"),
      point("O2", 5, 0, "P"),
      point("O3", 10, 0, "Q"),
      point("O4", 15, 0, "R"),
      circle("c1", "O1", 2, { fill: fill({ color: "#0891b2", opacity: 0.25 }), label: label("c") }),
      circle("c2", "O2", 2, { arc: { start: 30, end: 150 }, stroke: stroke({ dash: "dashed" }) }),
      circle("c3", "O3", 2, {
        arc: { start: 200, end: 340 },
        radii: true,
        fill: fill({ pattern: "crosshatch", color: "#7e22ce", opacity: 1, angle: 45 }),
        label: label("setor", { angle: 270 }),
      }),
      circle("c4", "O4", 2, {
        arc: { start: 300, end: 60 },
        radii: true,
        fill: fill({ color: "#e9c400", opacity: 0.6 }),
        stroke: stroke({ width: 1.5, color: "#ea7317" }),
      }),
    ]),
  },
  {
    name: "labels",
    doc: doc([
      point("p1", 0, 0, "α"),
      point("p2", 2, 0, "Δ"),
      point("p3", 4, 0, "A₁"),
      point("p4", 6, 0, "A′"),
      point("p5", 8, 0, "B'"),
      point("p6", 0, -2, "45°"),
      point("p7", 2, -2, "3,5"),
      point("p8", 4.5, -2, "(1,5; 2)"),
      point("p9", 7.5, -2, "área"),
      point("p10", 0, -4, "x²", { label: label("x²", { size: 14, color: "#d62828" }) }),
      point("p11", 2, -4, "A", { label: label("A", { font: "sans" }) }),
      point("p12", 4, -4, "M₂", { label: label("M₂", { font: "sans", size: 8 }) }),
      point("p13", 6, -4, "N", { label: label("N", { angle: 225, distance: 4 }) }),
      point("p14", 8, -4, "50% & mais", { label: label("50% & mais", { font: "sans", color: "#1d4ed8" }) }),
      point("p15", 0, -6, "{x}_#1 ~ \\", { label: label("{x}_#1 ~ \\", { angle: 0 }) }),
      point("p16", 5, -6, "πr²", { label: label("πr²", { angle: 0, size: 12 }) }),
      point("p17", 0, -8, "\"aspas\" x < 2 | y > 1", { label: label("\"aspas\" x < 2 | y > 1", { angle: 0 }) }),
      point("p18", 0, -9.5, "∠ABC ≅ ∠DEF, AB ⊥ CD, r ∥ s", { label: label("∠ABC ≅ ∠DEF, AB ⊥ CD, r ∥ s", { angle: 0 }) }),
    ]),
  },
  {
    name: "sharp-corners",
    doc: doc([
      // Thick strokes meeting at small angles, where line joins differ between renderers.
      point("A", 0, 0, "A"),
      point("B", 5, 0, "B"),
      point("C", 5, 1.8, "C"),
      polygon("g1", ["A", "B", "C"], { fill: null, stroke: stroke({ width: 2.5 }) }),
      angle("a1", "B", "A", "C", { radius: 30, label: label("20°") }),
      // A right angle mark with a translucent stroke: its dot must fade too.
      point("D", 7, 0, "D"),
      point("E", 9, 0),
      point("F", 7, 2),
      segment("s1", "D", "E"),
      segment("s2", "D", "F"),
      angle("a2", "E", "D", "F", { radius: 20, stroke: stroke({ color: "#d62828", width: 1.5, opacity: 0.35 }) }),
    ]),
  },
];

function axes(id: string, x: [number, number], y: [number, number], over: Partial<Axes> = {}): Axes {
  return {
    id,
    type: "axes",
    x,
    y,
    step: 1,
    numbers: true,
    names: ["x", "y"],
    stroke: { ...DEFAULT_AXES_STROKE },
    size: 8,
    ...over,
  };
}

function graph(id: string, expr: string, domain: [number, number], range: [number, number], name: string, over: Partial<FunctionGraph> = {}): FunctionGraph {
  return { id, type: "function", expr, domain, range, stroke: stroke(), label: label(name), ...over };
}

FIXTURES.push({
  name: "graphs",
  doc: doc([
    // fnplot: axes with a grid, a parabola cut by the range, 1/x broken at its asymptote, a dashed line.
    { id: "m1", type: "grid", x: [-4, 4], y: [-3, 5], step: 1, follow: "axes", stroke: { ...AXES_GRID } },
    axes("e1", [-4, 4], [-3, 5]),
    graph("f1", "x^2 - 1", [-4, 4], [-3, 5], "f"),
    graph("f2", "1/x", [-4, 4], [-3, 5], "g", { stroke: stroke({ color: "#1d4ed8" }) }),
    graph("f3", "-x/2 + 1", [-4, 4], [-3, 5], "h", { stroke: stroke({ dash: "dashed", color: "#d62828" }) }),
  ]),
});
FIXTURES.push({
  name: "graphs-scale-0.5",
  doc: doc([axes("e1", [-6.5, 6.5], [-2, 2], { step: 2, names: ["x", "f(x)"] }), graph("f1", "2sen(x)", [-6.5, 6.5], [-2, 2], "f")]),
  scale: 0.5,
});

// Arcs and circle radii are in world units, so they must follow the export scale too.
FIXTURES.push({ name: "circles-scale-0.5", doc: FIXTURES.find((f) => f.name === "circles")!.doc, scale: 0.5 });
