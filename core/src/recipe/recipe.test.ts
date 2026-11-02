import { describe, expect, it } from "vitest";
import {
  addPoints,
  emptyDoc,
  labelText,
  makePolygon,
  pointMap,
  toSvg,
  type Element,
  type FigureDoc,
  type Point,
} from "../figure";
import { compileRecipe, GUIDE, GUIDE_TOPIC_NAMES, guideText, recipeSchema, type Recipe } from "./index";

function compiled(recipe: Recipe, base?: FigureDoc) {
  const result = compileRecipe(recipe, { base });
  expect(result.errors).toEqual([]);
  return result;
}

const byName = (doc: FigureDoc, name: string): Point => {
  const p = doc.elements.find((e): e is Point => e.type === "point" && e.label?.text === name);
  if (!p) throw new Error(`no point ${name}`);
  return p;
};

const near = (p: { x: number; y: number }, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 9);
  expect(p.y).toBeCloseTo(y, 9);
};

const ofType = <T extends Element["type"]>(doc: FigureDoc, type: T) =>
  doc.elements.filter((e): e is Extract<Element, { type: T }> => e.type === type);

/** The request from the plan: 3-4-5 triangle on its hypotenuse, dashed height, sides, height and angles labeled. */
const PYTHAGOREAN: Recipe = {
  v: 1,
  steps: [
    { do: "triangle", points: ["A", "B", "C"], sides: [5, 4, 3] },
    { do: "angles", of: "ABC", label: { measure: true, decimals: 0 } },
    {
      do: "altitude",
      from: "C",
      to: ["A", "B"],
      foot: "H",
      as: "h",
      style: { dash: "dashed" },
      label: { measure: true, prefix: "h = " },
    },
    { do: "label", targets: [{ sidesOf: "ABC" }], scheme: "opposite" },
  ],
};

describe("compileRecipe: the Pythagorean triangle", () => {
  const { doc, names } = compiled(PYTHAGOREAN);

  it("places the right angle above the hypotenuse", () => {
    near(byName(doc, "A"), 0, 0);
    near(byName(doc, "B"), 5, 0);
    near(byName(doc, "C"), 1.8, 2.4);
  });

  it("drops a dashed height with its foot, right mark and live length", () => {
    const h = doc.elements.find((e) => e.id === names.h[0]);
    expect(h?.type).toBe("segment");
    if (h?.type !== "segment") return;
    expect(h.stroke.dash).toBe("dashed");
    near(byName(doc, "H"), 1.8, 0);
    expect(labelText(doc, h)).toBe("h = 2,4");
    const marks = ofType(doc, "angle").filter((a) => a.rightMark);
    expect(marks.length).toBeGreaterThanOrEqual(2);
  });

  it("names the sides after the opposite vertices", () => {
    const pts = pointMap(doc);
    const sides = ofType(doc, "segment")
      .filter((s) => s.id !== names.h[0])
      .map((s) => [[pts.get(s.a)!.label!.text, pts.get(s.b)!.label!.text].sort().join(""), s.label?.text]);
    expect(Object.fromEntries(sides)).toEqual({ AB: "c", BC: "a", AC: "b" });
  });

  it("measures the three angles", () => {
    const shown = ofType(doc, "angle")
      .filter((a) => a.label)
      .map((a) => labelText(doc, a))
      .sort();
    expect(shown).toEqual(["37°", "53°", "90°"]);
  });

  it("renders the same figure every time", () => {
    const again = compileRecipe(PYTHAGOREAN);
    expect(again.doc).toEqual(doc);
    const svg = toSvg(doc);
    expect(svg).toContain('<tspan font-style="italic">h</tspan> = 2,4');
    expect(svg).toBe(toSvg(again.doc));
  });
});

describe("compileRecipe: language and label placement", () => {
  it("writes English numbers with locale en", () => {
    const { doc, names } = compiled({ ...PYTHAGOREAN, locale: "en" });
    expect(doc.locale).toBe("en");
    expect(labelText(doc, doc.elements.find((e) => e.id === names.h[0])!)).toBe("h = 2.4");
    expect(toSvg(doc)).toContain("= 2.4");
  });

  it("can turn an English base figure back to pt-BR", () => {
    const base: FigureDoc = { ...emptyDoc(), locale: "en" };
    const recipe: Recipe = { v: 1, locale: "pt-BR", steps: [{ do: "points", points: [{ name: "A", at: [0, 0] }] }] };
    expect(compiled(recipe, base).doc.locale).toBeUndefined();
    expect(compiled({ ...recipe, locale: undefined }, base).doc.locale).toBe("en");
  });

  it("moves the 90° label off the height dropped through it", () => {
    const { doc } = compiled(PYTHAGOREAN);
    const right = ofType(doc, "angle").find((a) => a.label && labelText(doc, a) === "90°")!;
    expect(right.label!.angle).not.toBeNull();
  });

  it("keeps labels the recipe placed, and clear ones automatic", () => {
    const recipe: Recipe = {
      ...PYTHAGOREAN,
      steps: [...PYTHAGOREAN.steps, { do: "label", targets: [["A", "C", "B"]], label: { angle: 300 } }],
    };
    const { doc } = compiled(recipe);
    const right = ofType(doc, "angle").find((a) => a.label && labelText(doc, a) === "90°")!;
    expect(right.label!.angle).toBe(300);
    expect(byName(doc, "A").label!.angle).toBeNull();
  });
});

describe("compileRecipe: errors", () => {
  it("rejects unknown fields with the step index", () => {
    const r = compileRecipe({ v: 1, steps: [{ do: "points", points: [{ name: "A", at: [0, 0] }], colour: "red" }] });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatchObject({ step: 0, code: "invalid" });
  });

  it("names the step that refers to something missing", () => {
    const r = compileRecipe({
      v: 1,
      steps: [
        { do: "points", points: [{ name: "A", at: [0, 0] }, { name: "B", at: [2, 0] }] },
        { do: "segment", points: ["A", "Z"] },
      ],
    });
    expect(r.errors).toEqual([{ step: 1, code: "unknown_name", message: expect.stringContaining('"Z"') }]);
    // The figure is kept up to the failing step.
    expect(ofType(r.doc, "point")).toHaveLength(2);
  });

  it("refuses impossible triangles", () => {
    const r = compileRecipe({ v: 1, steps: [{ do: "triangle", points: ["A", "B", "C"], sides: [1, 2, 5] }] });
    expect(r.errors[0]).toMatchObject({ step: 0, code: "impossible" });
  });

  it("refuses a name used twice", () => {
    const r = compileRecipe({
      v: 1,
      steps: [
        { do: "points", points: [{ name: "A", at: [0, 0] }] },
        { do: "points", points: [{ name: "A", at: [1, 0] }] },
      ],
    });
    expect(r.errors[0]).toMatchObject({ step: 1, code: "duplicate_name" });
  });

  it("passes the editor's refusal through", () => {
    const r = compileRecipe({
      v: 1,
      steps: [
        { do: "points", points: [{ name: "A", at: [0, 0] }, { name: "B", at: [1, 0] }, { name: "C", at: [2, 0] }] },
        { do: "polygon", points: ["A", "B", "C"] },
      ],
    });
    expect(r.errors[0]).toMatchObject({
      step: 1,
      code: "op_failed",
      message: "The points are collinear and don't form a polygon.",
    });
  });

  it("rejects unknown colors", () => {
    const r = compileRecipe({
      v: 1,
      steps: [{ do: "points", points: [{ name: "A", at: [0, 0] }], style: { color: "chartreuse" } }],
    });
    expect(r.errors[0]).toMatchObject({ step: 0, code: "invalid" });
  });
});

describe("compileRecipe: shapes", () => {
  it("builds points from earlier ones in the same step", () => {
    const { doc } = compiled({
      v: 1,
      steps: [{ do: "points", points: [{ name: "A", at: [1, 1] }, { name: "B", from: "A", length: 2, angle: 90 }] }],
    });
    near(byName(doc, "B"), 1, 3);
  });

  it("closes a regular hexagon", () => {
    const { doc } = compiled({
      v: 1,
      steps: [{ do: "regularPolygon", points: ["A", "B", "C", "D", "E", "F"], side: 2 }],
    });
    const [poly] = ofType(doc, "polygon");
    expect(poly.vertices).toHaveLength(6);
    expect(ofType(doc, "segment")).toHaveLength(6);
    near(byName(doc, "D"), 2, 4 * Math.sin(Math.PI / 3));
  });

  it("makes a triangle from a base and two angles", () => {
    const { doc } = compiled({
      v: 1,
      steps: [{ do: "triangle", points: ["A", "B", "C"], base: 4, angles: [60, 60] }],
    });
    near(byName(doc, "C"), 2, 2 * Math.sqrt(3));
  });

  it("styles a polygon's sides from line fields and its inside from fill", () => {
    const { doc } = compiled({
      v: 1,
      defaults: { polygonFilled: false },
      steps: [
        { do: "triangle", points: ["A", "B", "C"], sides: [3, 3, 3], style: { color: "red", fill: { color: "blue", opacity: 0.2 } } },
      ],
    });
    expect(ofType(doc, "segment").every((s) => s.stroke.color === "#d62828")).toBe(true);
    expect(ofType(doc, "polygon")[0].fill).toMatchObject({ color: "#1d4ed8", opacity: 0.2 });
  });

  it("draws a sector with its radii and a circumscribed circle with a named center", () => {
    const { doc } = compiled({
      v: 1,
      steps: [
        { do: "points", points: [{ name: "O", at: [0, 0] }] },
        { do: "circle", center: "O", radius: 2, arc: [0, 60], sector: true, style: { fill: true } },
        { do: "triangle", points: ["A", "B", "C"], sides: [4, 3, 5], at: [5, 0] },
        { do: "circle", circumscribed: ["A", "B", "C"], centerName: "K" },
      ],
    });
    const [sector, circum] = ofType(doc, "circle").sort((a, b) => a.radius - b.radius);
    expect(sector.arc).toEqual({ start: 0, end: 60 });
    expect(sector.fill).not.toBeNull();
    expect(circum.radius).toBeCloseTo(2.5, 9);
    // Center of the circle through a right triangle: the midpoint of its hypotenuse.
    near(byName(doc, "K"), 5 + 2, 1.5);
  });

  it("runs the classic constructions", () => {
    const { doc, names } = compiled({
      v: 1,
      steps: [
        { do: "triangle", points: ["A", "B", "C"], sides: [6, 5, 4] },
        { do: "median", from: "C", to: ["A", "B"], midpoint: "M", as: "m" },
        { do: "bisector", angle: ["B", "A", "C"], end: "D" },
        { do: "perpendicularBisector", of: ["B", "C"], midpoint: "N" },
        { do: "midpoint", of: ["A", "C"], name: "P" },
      ],
    });
    near(byName(doc, "M"), 3, 0);
    near(byName(doc, "P"), byName(doc, "C").x / 2, byName(doc, "C").y / 2);
    const d = byName(doc, "D");
    expect(d.construction?.kind).toBe("bisector");
    // The angle bisector splits BC in the ratio of the other sides: BD/DC = AB/AC.
    const [b, c] = [byName(doc, "B"), byName(doc, "C")];
    expect(Math.hypot(d.x - b.x, d.y - b.y) / Math.hypot(d.x - c.x, d.y - c.y)).toBeCloseTo(6 / 4, 9);
    expect(byName(doc, "N").construction?.kind).toBe("midpoint");
    expect(names.m).toHaveLength(1);
  });

  it("names crossings of a circle and a segment", () => {
    const { doc } = compiled({
      v: 1,
      steps: [
        { do: "points", points: [{ name: "O", at: [0, 0] }, { name: "A", at: [-3, 0] }, { name: "B", at: [3, 0] }] },
        { do: "segment", points: ["A", "B"] },
        { do: "circle", center: "O", radius: 2, as: "c" },
        { do: "intersection", of: [["A", "B"], "c"], names: ["P", "Q"] },
      ],
    });
    const xs = [byName(doc, "P").x, byName(doc, "Q").x].sort();
    expect(xs[0]).toBeCloseTo(-2, 9);
    expect(xs[1]).toBeCloseTo(2, 9);
  });

  it("reads the input bar syntax", () => {
    const { doc, names } = compiled({ v: 1, steps: [{ do: "input", text: "A=0;0 B=4;0 C=0;3 A--B--C--" }] });
    expect(ofType(doc, "segment")).toHaveLength(3);
    expect(Object.keys(names).sort()).toEqual(["A", "B", "C"]);
  });
});

describe("compileRecipe: graphs", () => {
  it("marks roots, a point, a tangent and guides on a parabola", () => {
    const { doc } = compiled({
      v: 1,
      steps: [
        { do: "function", expr: "x^2 - 4", style: { color: "blue" } },
        { do: "notable", graph: "f", feature: "root" },
        { do: "pointOnGraph", graph: "f", x: 1, name: "P" },
        { do: "tangent", point: "P", fill: true, style: { dash: "dashed" } },
        { do: "guides", points: ["P"] },
      ],
    });
    const roots = ofType(doc, "point").filter((p) => p.construction?.kind === "notable");
    expect(roots.map((p) => p.label?.text)).toEqual(["x₁", "x₂"]);
    near(byName(doc, "P"), 1, -3);
    expect(byName(doc, "P").guides).toBeDefined();
    expect(ofType(doc, "function")[0].stroke.color).toBe("#1d4ed8");
    expect(ofType(doc, "axes")).toHaveLength(1);
  });

  it("sets axis steps on the fitted window at the end", () => {
    const { doc } = compiled({
      v: 1,
      steps: [
        { do: "axes", step: 2, names: ["t", "s"] },
        { do: "function", expr: "x" },
      ],
    });
    const [axes] = ofType(doc, "axes");
    expect(axes.fit).toBe(false);
    expect(axes.step).toBe(2);
    expect(axes.names).toEqual(["t", "s"]);
  });

  it("keeps a typed window", () => {
    const { doc } = compiled({
      v: 1,
      steps: [
        { do: "function", expr: "sen(x)", domain: [-6, 6] },
        { do: "axes", x: [-7, 7], y: [-2, 2], xPi: 0.5 },
      ],
    });
    const [axes] = ofType(doc, "axes");
    expect(axes.x).toEqual([-7, 7]);
    expect(axes.fit).toBe(false);
    expect(ofType(doc, "function")[0].domain).toEqual([-6, 6]);
  });

  it("marks an interval on a number line", () => {
    const { doc } = compiled({
      v: 1,
      steps: [
        { do: "numberline", x: [-5, 5] },
        { do: "interval", from: -2, to: null, closed: [true, false] },
      ],
    });
    const ends = ofType(doc, "point").map((p) => p.shape);
    expect(ends).toEqual(["dot", "none"]);
  });
});

describe("compileRecipe: labels and base figures", () => {
  it("labels by scheme, text and measure", () => {
    const { doc } = compiled({
      v: 1,
      steps: [
        { do: "triangle", points: ["A", "B", "C"], sides: [4, 4, 4] },
        { do: "angles", of: "ABC" },
        { do: "label", targets: [{ anglesOf: "ABC" }], scheme: "greek" },
        { do: "label", targets: [["A", "B"]], label: { measure: true, suffix: " cm", decimals: 0 } },
        { do: "label", targets: ["ABC"], label: { measure: "area", prefix: "S = " } },
      ],
    });
    expect(ofType(doc, "angle").map((a) => a.label?.text).sort()).toEqual(["α", "β", "γ"]);
    const ab = ofType(doc, "segment").find((s) => s.label);
    expect(ab && labelText(doc, ab)).toBe("4 cm");
    const poly = ofType(doc, "polygon")[0];
    expect(labelText(doc, poly)).toBe(`S = ${(4 * Math.sqrt(3)).toFixed(2).replace(".", ",")}`);
  });

  it("builds on a figure from the editor, by its point names", () => {
    const pts = addPoints(emptyDoc(), [
      { x: 0, y: 0, label: "P" },
      { x: 4, y: 0, label: "Q" },
      { x: 0, y: 3, label: "R" },
    ]);
    const base = makePolygon(pts.doc, pts.created).doc;
    const { doc } = compiled(
      { v: 1, steps: [{ do: "altitude", from: "P", to: ["Q", "R"], foot: "H" }] },
      base,
    );
    near(byName(doc, "H"), 1.44, 1.92);
  });

  it("exports a JSON Schema for the MCP tools, small enough to send every conversation", async () => {
    const { z } = await import("zod");
    const schema = z.toJSONSchema(recipeSchema) as { properties?: Record<string, unknown>; $defs?: Record<string, unknown> };
    expect(schema.properties).toHaveProperty("steps");
    // Shared parts are written once and referred to.
    expect(Object.keys(schema.$defs ?? {})).toEqual(expect.arrayContaining(["style", "label", "target", "color"]));
    // About 5k tokens. Grow it on purpose, not by accident.
    expect(JSON.stringify(schema).length).toBeLessThan(21_000);
  });
});

describe("the recipe guide", () => {
  const examples = GUIDE_TOPIC_NAMES.flatMap((name) => GUIDE[name].examples.map((e) => ({ name, ...e })));

  it.each(examples)("compiles the $name example: $request", ({ recipe }) => {
    const result = compileRecipe(recipe);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.doc.elements.length).toBeGreaterThan(0);
  });

  it("writes every topic, or one", () => {
    expect(guideText()).toContain("# How recipes work");
    expect(guideText("graphs")).not.toContain("# How recipes work");
  });
});
