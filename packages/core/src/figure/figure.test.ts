import { describe, expect, it } from "vitest";
import {
  addPoints,
  addText,
  angleArc,
  autoLabel,
  autoLabelMany,
  buildScene,
  circumcircle,
  connectPoints,
  deleteElements,
  emptyDoc,
  DEFAULT_ANGLE,
  DEFAULT_LABEL,
  DEFAULT_POINT,
  DEFAULT_STROKE,
  DEFAULT_STYLES,
  fillShapes,
  formatNumber,
  labelRuns,
  labelText,
  labelToLatex,
  measureRuns,
  measureToLatex,
  makeAngles,
  makeCircle,
  makePolygon,
  movePoints,
  normalizeDoc,
  parseInput,
  applyInput,
  pointOnSegment,
  removeLabels,
  clearLabels,
  toSvg,
  toTikz,
  type Circle,
  type FigureDoc,
  type FreeText,
  type Label,
  type ParsedPoint,
  type Point,
} from "./index";
import { FIXTURES } from "../../fixtures/figures";

/** New points of an input, for building test figures. */
function pts(text: string): ParsedPoint[] {
  return parseInput(text).nodes.flatMap((n) => (n.kind === "new" ? [{ x: n.x, y: n.y, label: n.label }] : []));
}

/** A 3-4-5 right triangle: p1 (0,0), p2 (4,0), p3 (0,3). */
function triangle(): FigureDoc {
  return addPoints(emptyDoc(), pts("0;0 4;0 0;3")).doc;
}

const ids = (doc: FigureDoc, type: string) => doc.elements.filter((e) => e.type === type).map((e) => e.id);

describe("parseInput", () => {
  const at = (r: ReturnType<typeof parseInput>, i: number) => ({ x: r.nodes[i].x, y: r.nodes[i].y });

  it("reads absolute points with or without parentheses, comma or dot decimals", () => {
    const r = parseInput("0;0 (2,5;-1) 1.5;2 ( 3 ; 4 )");
    expect(r.errors).toEqual([]);
    expect(r.nodes.map((n) => [n.x, n.y])).toEqual([
      [0, 0],
      [2.5, -1],
      [1.5, 2],
      [3, 4],
    ]);
    expect(r.segments).toEqual([]);
  });

  it("reads names, with spaces around = and separators", () => {
    const r = parseInput("A = 0 ; 0  B=(4;0)");
    expect(r.nodes.map((n) => (n.kind === "new" ? n.label : null))).toEqual(["A", "B"]);
  });

  it("reads polar points from the origin", () => {
    const r = parseInput("(2:90)");
    expect(at(r, 0)).toEqual({ x: 0, y: 2 });
  });

  it("chains displacements from the previous point", () => {
    const r = parseInput("(1;1) +(2;0) +(2:90) +3;0");
    expect([1, 2, 3].map((i) => at(r, i))).toEqual([
      { x: 3, y: 1 },
      { x: 3, y: 3 },
      { x: 6, y: 3 },
    ]);
  });

  it("starts a displacement at the selected point, or the figure's last point", () => {
    expect(at(parseInput("+(1;0)", { points: [], selected: { x: 5, y: 5 } }), 0)).toEqual({ x: 6, y: 5 });
    expect(at(parseInput("+(1;0)", { points: [{ id: "p1", x: 2, y: 2 }] }), 0)).toEqual({ x: 3, y: 2 });
    expect(parseInput("+(1;0)").errors).toHaveLength(1);
  });

  it("joins points with -- and closes with a trailing --", () => {
    const r = parseInput("A=(0;0)--B=(4;0)--C=(0;3)--");
    expect(r.errors).toEqual([]);
    expect(r.segments).toEqual([
      [0, 1],
      [1, 2],
      [2, 0],
    ]);
  });

  it("accepts spaces around --, and a minus right after it", () => {
    for (const text of ["(1;1)--(-1;2)", "1;1 -- -1;2", "1;1---1;2"]) {
      const r = parseInput(text);
      expect(r.errors, text).toEqual([]);
      expect(at(r, 1), text).toEqual({ x: -1, y: 2 });
      expect(r.segments, text).toEqual([[0, 1]]);
    }
  });

  it("keeps chains separated by spaces apart", () => {
    const r = parseInput("0;0--1;0 5;5--6;5");
    expect(r.segments).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("closes a chain that returns to a name", () => {
    const r = parseInput("A=(0;0)--B=(4;0)--C=(0;3)--A");
    expect(r.nodes).toHaveLength(3);
    expect(r.segments).toContainEqual([2, 0]);
  });

  it("connects existing points by their labels", () => {
    const r = parseInput("A--C", {
      points: [
        { id: "p1", x: 0, y: 0, label: "A" },
        { id: "p3", x: 0, y: 3, label: "C" },
      ],
    });
    expect(r.nodes).toEqual([
      { kind: "existing", id: "p1", x: 0, y: 0 },
      { kind: "existing", id: "p3", x: 0, y: 3 },
    ]);
    expect(r.segments).toEqual([[0, 1]]);
  });

  it("points errors at the exact text and keeps reading", () => {
    const text = "1;2 abc 3;x";
    const r = parseInput(text);
    expect(r.nodes).toHaveLength(1);
    expect(r.errors.map((e) => text.slice(e.start, e.end))).toEqual(["abc", "3;x"]);
  });

  it("closes a contour with -- right before a free text", () => {
    const r = parseInput('A=(0;0)--B=(4;0)--C=(0;3)-- "Figura 1"@(1;-1)');
    expect(r.errors).toEqual([]);
    expect(r.segments).toContainEqual([2, 0]);
    expect(r.texts).toHaveLength(1);
  });

  it("refuses to close fewer than three points", () => {
    expect(parseInput("0;0--1;0--").errors).toHaveLength(1);
    expect(parseInput("--0;0").errors).toHaveLength(1);
  });

  it("marks tokens for coloring", () => {
    const r = parseInput("A=(0;0)--B");
    expect(r.tokens.map((t) => t.kind)).toEqual(["name", "point", "connector", "error"]);
  });
});

describe("applyInput", () => {
  it("creates points and segments in one step", () => {
    const r = applyInput(emptyDoc(), parseInput("A=(0;0)--B=(4;0)--C=(0;3)--"));
    expect(ids(r.doc, "point")).toEqual(["p1", "p2", "p3"]);
    expect(ids(r.doc, "segment")).toEqual(["s1", "s2", "s3"]);
    expect(r.created).toEqual(["p1", "p2", "p3"]);
  });

  it("reuses existing points and skips existing segments", () => {
    const first = applyInput(emptyDoc(), parseInput("A=(0;0)--B=(4;0)")).doc;
    const ctx = { points: first.elements.flatMap((e) => (e.type === "point" ? [{ ...e, label: e.label?.text }] : [])) };
    const r = applyInput(first, parseInput("B--A--C=(0;3)", ctx));
    expect(ids(r.doc, "point")).toHaveLength(3);
    expect(ids(r.doc, "segment")).toHaveLength(2);
  });

  it("adds nothing when the input has errors", () => {
    const r = applyInput(emptyDoc(), parseInput("0;0 oops"));
    expect(r.error).toBeDefined();
    expect(r.doc.elements).toHaveLength(0);
  });
});

describe("operations", () => {
  it("connects points and skips existing segments", () => {
    const doc = triangle();
    const closed = connectPoints(doc, ["p1", "p2", "p3"], true);
    expect(ids(closed.doc, "segment")).toEqual(["s1", "s2", "s3"]);
    expect(connectPoints(closed.doc, ["p2", "p1"], false).error).toBeDefined();
  });

  it("makes a polygon from points and closes its contour", () => {
    const r = makePolygon(triangle(), ["p1", "p2", "p3"]);
    expect(r.error).toBeUndefined();
    expect(ids(r.doc, "polygon")).toHaveLength(1);
    expect(ids(r.doc, "segment")).toHaveLength(3);
    // The fill is drawn first, under the outline.
    expect(r.doc.elements[0].type).toBe("polygon");
  });

  it("makes a polygon from a loop of segments, in any selection order", () => {
    const closed = connectPoints(triangle(), ["p1", "p2", "p3"], true).doc;
    const r = makePolygon(closed, ["s3", "s1", "s2"]);
    expect(r.error).toBeUndefined();
  });

  it("rejects segments that do not close", () => {
    const open = connectPoints(triangle(), ["p1", "p2", "p3"], false).doc;
    expect(makePolygon(open, ["s1", "s2"]).error).toBeDefined();
  });

  it("marks the interior angles of a polygon, including a reflex one", () => {
    // An arrowhead: concave at p4.
    let doc = addPoints(emptyDoc(), pts("0;0 4;2 0;4 1;2")).doc;
    doc = makePolygon(doc, ["p1", "p2", "p3", "p4"]).doc;
    const r = makeAngles(doc, ["g1"]);
    const angles = r.doc.elements.filter((e) => e.type === "angle");
    expect(angles).toHaveLength(4);
    const atP4 = angles.find((a) => a.type === "angle" && a.vertex === "p4");
    expect(atP4 && atP4.type === "angle" && atP4.reflex).toBe(true);
  });

  it("marks ∠ABC from three selected points", () => {
    const r = makeAngles(triangle(), ["p2", "p1", "p3"]);
    const angle = r.doc.elements.find((e) => e.type === "angle");
    expect(angle).toMatchObject({ a: "p2", vertex: "p1", b: "p3" });
  });

  it("refuses an angle between collinear points", () => {
    const doc = addPoints(emptyDoc(), pts("0;0 1;0 2;0")).doc;
    expect(makeAngles(doc, ["p1", "p2", "p3"]).error).toMatch(/alinhados/);
  });

  it("builds the circumcircle with its center point and keeps it on moves", () => {
    const r = makeCircle(triangle(), ["p1", "p2", "p3"], "circumcircle");
    const circle = r.doc.elements.find((e): e is Circle => e.type === "circle")!;
    expect(circle.radius).toBeCloseTo(2.5);
    const moved = movePoints(r.doc, [{ id: "p2", x: 6, y: 0 }]);
    const after = moved.elements.find((e): e is Circle => e.type === "circle")!;
    const center = moved.elements.find((e): e is Point => e.id === circle.center)!;
    expect(after.radius).toBeCloseTo(Math.hypot(3, 1.5));
    expect(center.x).toBeCloseTo(3);
    expect(center.y).toBeCloseTo(1.5);
  });

  it("deletes shapes that use a deleted point", () => {
    let doc = makePolygon(triangle(), ["p1", "p2", "p3"]).doc;
    doc = makeAngles(doc, ["g1"]).doc;
    doc = deleteElements(doc, ["p1"]).doc;
    expect(doc.elements.map((e) => e.type).sort()).toEqual(["point", "point", "segment"]);
  });

  it("frees a circle whose through point is deleted", () => {
    let doc = makeCircle(triangle(), ["p1", "p2"], "through").doc;
    doc = deleteElements(doc, ["p2"]).doc;
    const circle = doc.elements.find((e): e is Circle => e.type === "circle")!;
    expect(circle.construction).toEqual({ kind: "free" });
    expect(circle.radius).toBe(4);
  });

  it("inserts a point on a segment by ratio or distance", () => {
    const doc = connectPoints(triangle(), ["p1", "p2"], false).doc;
    const half = pointOnSegment(doc, "s1", { ratio: 0.5 });
    expect(half.doc.elements.at(-1)).toMatchObject({ x: 2, y: 0 });
    expect(pointOnSegment(doc, "s1", { distance: 5 }).error).toBeDefined();
  });

  it("selects every interior angle, also those already marked", () => {
    const doc = makePolygon(triangle(), ["p1", "p2", "p3"]).doc;
    const polygon = doc.elements.find((e) => e.type === "polygon")!.id;
    const right = makeAngles(doc, ["p2", "p1", "p3"]);
    const all = makeAngles(right.doc, [polygon]);
    expect(all.created).toHaveLength(2);
    expect(all.selected).toHaveLength(3);
    expect(all.selected).toContain(right.created[0]);
    // Points and the polygon together ask for the same angle twice: it counts once.
    expect(makeAngles(right.doc, [polygon, "p1", "p2", "p3"]).selected).toHaveLength(3);
  });

  it("removes labels quickly", () => {
    let doc = connectPoints(triangle(), ["p1", "p2", "p3"], true).doc;
    doc = autoLabel(doc, "point", "latin", null).doc;
    doc = autoLabel(doc, "segment", "length", null).doc;
    const one = removeLabels(doc, ["p1"]).doc;
    expect(one.elements.filter((e) => e.label).length).toBe(5);
    const noSides = clearLabels(doc, [{ type: "segment", scheme: "length" }], null).doc;
    expect(noSides.elements.filter((e) => e.label).map((e) => e.type)).toEqual(["point", "point", "point"]);
    expect(removeLabels(noSides, ["s1"]).error).toBeDefined();
  });

  it("labels points A, B, C and segments by length", () => {
    let doc = connectPoints(triangle(), ["p1", "p2", "p3"], true).doc;
    doc = autoLabel(doc, "point", "latin", null).doc;
    doc = autoLabel(doc, "segment", "length", null).doc;
    const labels = doc.elements.map((e) => e.label?.text);
    expect(labels).toEqual(["A", "B", "C", "4", "5", "3"]);
  });
});

describe("geometry", () => {
  it("finds the small and reflex sides of an angle", () => {
    const arc = angleArc({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, false)!;
    expect(arc).toMatchObject({ start: 0, sweep: 90, isRight: true });
    const reflex = angleArc({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, true)!;
    expect(reflex).toMatchObject({ start: 90, sweep: 270, isRight: false });
  });

  it("detects right angles with a tolerance", () => {
    const arc = angleArc({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1e-6, y: 1 }, false)!;
    expect(arc.isRight).toBe(true);
  });

  it("returns null for collinear circumcircles", () => {
    expect(circumcircle({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
  });
});

describe("labels", () => {
  it("formats numbers the Brazilian way", () => {
    expect(formatNumber(3.5)).toBe("3,5");
    expect(formatNumber(2)).toBe("2");
    expect(formatNumber(1 / 3)).toBe("0,33");
    expect(formatNumber(90, 0)).toBe("90");
    expect(formatNumber(100.4, 0)).toBe("100");
    expect(formatNumber(2.5, 3)).toBe("2,5");
  });

  it("converts labels to LaTeX", () => {
    expect(labelToLatex("A")).toBe("$A$");
    expect(labelToLatex("A₁'")).toBe("$A_{1}'$");
    expect(labelToLatex("α")).toBe("$\\alpha$");
    expect(labelToLatex("60°")).toBe("$60^\\circ$");
    expect(labelToLatex("3,5")).toBe("$3{,}5$");
    expect(labelToLatex("x²")).toBe("$x^{2}$");
    expect(labelToLatex("50% & mais")).toBe("50\\% \\& mais");
  });

  it("keeps words, sans labels and OT1-unsafe characters out of math mode", () => {
    // Math mode would set "cm" in italic and ignore \sffamily.
    expect(labelToLatex("2,5 cm")).toBe("2,5 cm");
    expect(labelToLatex("A", "sans")).toBe("A");
    expect(labelToLatex("M₂", "sans")).toBe("M\\textsubscript{2}");
    expect(labelToLatex("α área")).toBe("$\\alpha$ área");
    // pdflatex's default OT1 encoding prints < > | as ¡ ¿ —.
    expect(labelToLatex('"aspas" x < 2 | y > 1')).toBe("``aspas'' x \\textless{} 2 \\textbar{} y \\textgreater{} 1");
    expect(labelToLatex("a ~ b")).toBe("a $\\sim$ b");
  });

  it("writes geometry symbols as commands pdflatex can typeset", () => {
    expect(labelToLatex("∠ABC ≅ ∠DEF")).toBe("$\\angle ABC\\cong \\angle DEF$");
    expect(labelToLatex("AB ⊥ CD")).toBe("$AB\\perp CD$");
    expect(labelToLatex("r ∥ s, área")).toBe("r $\\parallel$ s, área");
    expect(labelToLatex("(1,5; 2)")).toBe("$(1{,}5{;}\\ 2)$");
  });

  it("splits labels into italic and upright runs like LaTeX math", () => {
    expect(labelRuns("A′")).toEqual([
      { text: "A", italic: true },
      { text: "′", italic: false },
    ]);
    expect(labelRuns("Δ")).toEqual([{ text: "Δ", italic: false }]);
    expect(labelRuns("2x²")).toEqual([
      { text: "2", italic: false },
      { text: "x", italic: true },
      { text: "²", italic: false },
    ]);
    expect(labelRuns("2,5 cm")).toEqual([{ text: "2,5 cm", italic: false }]);
    expect(labelRuns("A", "sans")).toEqual([{ text: "A", italic: false }]);
  });
});

describe("exports", () => {
  function sample(): FigureDoc {
    let doc = makePolygon(triangle(), ["p1", "p2", "p3"]).doc;
    doc = makeAngles(doc, ["g1"]).doc;
    doc = autoLabel(doc, "point", "latin", null).doc;
    return doc;
  }

  it("writes TikZ with named coordinates and a right-angle square", () => {
    const tikz = toTikz(sample());
    expect(tikz).toContain("\\coordinate (p1) at (0,0);");
    expect(tikz).toContain("\\begin{tikzpicture}[x=1cm, y=1cm, miter limit=4]");
    expect(tikz).toContain("(p1) -- (p2) -- (p3) -- cycle");
    expect(tikz).toMatch(/\\node\[text=black\] at \(\[shift=\{\(-?[\d.]+pt,-?[\d.]+pt\)\}\]p1\) \{\$A\$\};/);
    expect(tikz).not.toContain('"solid"');
    // Rounded numbers only.
    expect(tikz).not.toMatch(/\d\.\d{4,}/);
  });

  it("asks for patterns.meta only when a pattern is used", () => {
    const doc = sample();
    expect(toTikz(doc)).not.toContain("patterns.meta");
    const hatched: FigureDoc = {
      ...doc,
      elements: doc.elements.map((e) =>
        e.type === "polygon" ? { ...e, fill: { color: "#d62828", opacity: 1, pattern: "hatch", angle: 45 } } : e,
      ),
    };
    const tikz = toTikz(hatched);
    expect(tikz).toContain("\\usetikzlibrary{patterns.meta}");
    expect(tikz).toContain("\\definecolor{gs1}{HTML}{D62828}");
    expect(tikz).toContain("pattern={Lines[angle=45,distance=4pt,line width=0.4pt]}");
  });

  it("scales coordinates but not line widths", () => {
    const tikz = toTikz(sample(), { scale: 2 });
    expect(tikz).toContain("[x=2cm, y=2cm, miter limit=4]");
    expect(tikz).toContain("line width=0.8pt");
  });

  it("writes a standalone SVG sized in pt", () => {
    const svg = toSvg(sample());
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toMatch(/width="[\d.]+pt"/);
    expect(svg).toContain(">A</text>");
  });

  it("escapes label text in SVG", () => {
    const doc = addPoints(emptyDoc(), [{ x: 0, y: 0, label: "<b>" }]).doc;
    expect(toSvg(doc)).toContain("&lt;b&gt;");
  });

  it("bounds the scene around everything drawn", () => {
    const scene = buildScene(sample());
    expect(scene.box).not.toBeNull();
    const k = scene.k;
    expect(scene.box!.maxX).toBeGreaterThanOrEqual(4 * k);
    expect(scene.box!.minY).toBeLessThanOrEqual(-3 * k);
  });
});

describe("normalizeDoc", () => {
  it("keeps a valid doc as is", () => {
    let doc = makeCircle(triangle(), ["p1", "p2", "p3"], "circumcircle").doc;
    doc = makePolygon(doc, ["p1", "p2", "p3"]).doc;
    expect(normalizeDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it("drops broken elements and dangling references", () => {
    const doc = normalizeDoc({
      kind: "geo",
      version: 1,
      elements: [
        { id: "p1", type: "point", x: 0, y: 0 },
        { id: "p2", type: "point", x: "oops", y: 0 },
        { id: "s1", type: "segment", a: "p1", b: "p2" },
        { id: "bad id", type: "point", x: 1, y: 1 },
      ],
    });
    expect(doc.elements.map((e) => e.id)).toEqual(["p1"]);
  });

  it("returns an empty doc for garbage", () => {
    expect(normalizeDoc("nope").elements).toEqual([]);
    expect(normalizeDoc(null).elements).toEqual([]);
  });
});

describe("styles and options", () => {
  it("fills selected circles with the Polígono action", () => {
    const withCircle = makeCircle(triangle(), ["p1", "p2"], "through").doc;
    const r = fillShapes(withCircle, ["c1"]);
    expect(r.error).toBeUndefined();
    const circle = r.doc.elements.find((e): e is Circle => e.type === "circle")!;
    expect(circle.fill).toEqual(DEFAULT_STYLES.fill);
    expect(fillShapes(r.doc, ["c1"]).error).toMatch(/preenchidas/);
  });

  it("fills a circle and makes a polygon in one go", () => {
    const withCircle = makeCircle(triangle(), ["p1", "p2"], "through").doc;
    const r = fillShapes(withCircle, ["p1", "p2", "p3", "c1"]);
    expect(r.doc.elements.filter((e) => e.type === "polygon")).toHaveLength(1);
    expect(r.doc.elements.find((e): e is Circle => e.type === "circle")!.fill).not.toBeNull();
  });

  it("uses the given styles for new elements", () => {
    const styles = {
      ...DEFAULT_STYLES,
      stroke: { ...DEFAULT_STYLES.stroke, width: 2, color: "#d62828" },
      point: { shape: "ring" as const, size: 3, color: "#1d4ed8" },
      polygonFilled: false,
    };
    let doc = applyInput(emptyDoc(), parseInput("0;0--4;0--0;3--"), { styles }).doc;
    doc = makePolygon(doc, ["p1", "p2", "p3"], { styles }).doc;
    expect(doc.elements.find((e) => e.type === "point")).toMatchObject({ shape: "ring", size: 3 });
    expect(doc.elements.find((e) => e.type === "segment")).toMatchObject({ stroke: { width: 2, color: "#d62828" } });
    expect(doc.elements.find((e) => e.type === "polygon")).toMatchObject({ fill: null });
  });

  it("names new points automatically, skipping names in use", () => {
    const first = applyInput(emptyDoc(), parseInput("A=(0;0) (1;0)"), { autoName: true }).doc;
    const labels = first.elements.map((e) => e.label?.text);
    expect(labels).toEqual(["A", "B"]);
    const more = addPoints(first, [{ x: 2, y: 2 }], { autoName: true }).doc;
    expect(more.elements.at(-1)?.label?.text).toBe("C");
  });

  it("writes sans-serif labels in TikZ and SVG", () => {
    let doc = applyInput(emptyDoc(), parseInput("A=(0;0)"), {
      styles: { ...DEFAULT_STYLES, label: { ...DEFAULT_STYLES.label, font: "sans" } },
    }).doc;
    expect(toTikz(doc)).toContain("font=\\sffamily");
    expect(toSvg(doc)).toContain("sans-serif");
    doc = normalizeDoc(JSON.parse(JSON.stringify(doc)));
    expect(doc.elements[0].label?.font).toBe("sans");
  });
});

describe("export fidelity", () => {
  function doc(elements: FigureDoc["elements"]): FigureDoc {
    return { kind: "geo", version: 1, elements };
  }
  const point = (id: string, x: number, y: number): Point => ({ id, type: "point", x, y, ...DEFAULT_POINT });
  const stroke = { ...DEFAULT_STROKE };

  it("draws segment ticks at the midpoint in the scene, like the TikZ export", () => {
    const d = doc([
      point("p1", 0, 0),
      point("p2", 4, 0),
      { id: "s1", type: "segment", a: "p1", b: "p2", stroke, ticks: 1 },
    ]);
    const scene = buildScene(d);
    const tick = scene.prims.filter((p) => p.kind === "path" && p.owner === "s1")[1];
    const xs = tick.kind === "path" ? [...tick.d.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1])) : [];
    expect(xs).toHaveLength(2);
    for (const x of xs) expect(x).toBeCloseTo(2 * scene.k, 3);
    expect(toTikz(d)).toContain("([shift={(0pt,3.5pt)}]2,0) -- ([shift={(0pt,-3.5pt)}]2,0)");
  });

  it("fades the right-angle dot with the stroke in TikZ, like in the SVG", () => {
    const d = doc([
      point("p1", 0, 0),
      point("p2", 1, 0),
      point("p3", 0, 1),
      { id: "a1", type: "angle", a: "p2", vertex: "p1", b: "p3", ...DEFAULT_ANGLE, stroke: { ...stroke, opacity: 0.4 } },
    ]);
    expect(toTikz(d)).toMatch(/\\fill\[black, fill opacity=0\.4\] .* circle/);
    expect(toSvg(d)).toMatch(/fill="#000000" fill-opacity="0\.4"/);
  });

  it("bevels sharp corners in TikZ at the SVG miter limit", () => {
    expect(toTikz(emptyDoc())).toContain("miter limit=4]");
  });

  it("styles SVG label text per run", () => {
    const d = doc([{ ...point("p1", 0, 0), label: { ...DEFAULT_LABEL, text: "2x" } }]);
    expect(toSvg(d)).toContain('>2<tspan font-style="italic">x</tspan></text>');
    const single = doc([{ ...point("p1", 0, 0), label: { ...DEFAULT_LABEL, text: "A" } }]);
    expect(toSvg(single)).toMatch(/font-style="italic"[^>]*>A<\/text>/);
  });

  it("writes only characters pdflatex reads for every fixture", () => {
    for (const { name, doc: d, scale } of FIXTURES) {
      const body = toTikz(d, { scale })
        .split("\n")
        .filter((l) => !l.startsWith("%"));
      // ASCII plus Latin-1 letters (á, ç), which LaTeX reads as UTF-8 since 2018.
      const bad = body.filter((l) => !/^[\x20-\x7e\u00c0-\u00ff]*$/.test(l));
      expect(bad, name).toEqual([]);
    }
  });
});

describe("live measure labels", () => {
  /** Triangle with its sides labeled by live lengths: s1 = 4, s2 = 5, s3 = 3. */
  function measured(): FigureDoc {
    const doc = connectPoints(triangle(), ["p1", "p2", "p3"], true).doc;
    return autoLabel(doc, "segment", "length", null, 2).doc;
  }
  const label = (doc: FigureDoc, id: string): Label => doc.elements.find((e) => e.id === id)!.label!;

  it("makes the Medida schemes live, with the decimals stored on the label", () => {
    const doc = measured();
    expect(label(doc, "s1").measure).toEqual({ kind: "length", decimals: 2, prefix: "", suffix: "" });
    const angles = autoLabel(makeAngles(doc, ["p2", "p1", "p3"]).doc, "angle", "measure", null, 3).doc;
    expect(label(angles, "a1").measure).toMatchObject({ kind: "angle", decimals: 1 });
    // A naming scheme replaces the measure with static text.
    const named = autoLabel(doc, "segment", "latin-lower", null).doc;
    expect(label(named, "s1")).toMatchObject({ text: "a" });
    expect(label(named, "s1").measure).toBeUndefined();
  });

  it("computes the text from the figure when it is drawn", () => {
    const doc = movePoints(measured(), [{ id: "p2", x: 2.5, y: 0 }]);
    const s1 = doc.elements.find((e) => e.id === "s1")!;
    expect(labelText(doc, s1)).toBe("2,5");
    // The stored text is only a fallback for older readers.
    expect(label(doc, "s1").text).toBe("4");
    expect(toSvg(doc)).toContain(">2,5</text>");
    expect(toSvg(doc)).not.toContain(">4</text>");
  });

  it("adds prefix, suffix and decimals, and measures angles, circles and polygons", () => {
    let doc = makePolygon(triangle(), ["p1", "p2", "p3"]).doc;
    doc = makeAngles(doc, ["p2", "p1", "p3"]).doc;
    doc = makeCircle(doc, ["p1", "p3"], "through").doc;
    const measure = (id: string, m: Label["measure"]) => {
      doc = {
        ...doc,
        elements: doc.elements.map((e) =>
          e.id === id && e.type !== "text" ? { ...e, label: { ...DEFAULT_STYLES.label, text: "?", measure: m } } : e,
        ),
      };
      return labelText(doc, doc.elements.find((e) => e.id === id)!);
    };
    expect(measure("s1", { kind: "length", decimals: 1, prefix: "x = ", suffix: " cm" })).toBe("x = 4 cm");
    expect(measure("g1", { kind: "area", decimals: 2, prefix: "", suffix: "" })).toBe("6");
    expect(measure("g1", { kind: "perimeter", decimals: 0, prefix: "P = ", suffix: "" })).toBe("P = 12");
    expect(measure("a1", { kind: "angle", decimals: 0, prefix: "", suffix: "" })).toBe("90°");
    expect(measure("c1", { kind: "radius", decimals: 2, prefix: "r = ", suffix: "" })).toBe("r = 3");
    doc = movePoints(doc, [{ id: "p3", x: 0, y: 1.234 }]);
    expect(labelText(doc, doc.elements.find((e) => e.id === "c1")!)).toBe("r = 1,23");
  });

  it("writes the value at export time in TikZ, with upright units", () => {
    let doc = measured();
    doc = {
      ...doc,
      elements: doc.elements.map((e) =>
        e.id === "s1" && e.label?.measure
          ? { ...e, label: { ...e.label, measure: { ...e.label.measure, prefix: "x = ", suffix: " cm" } } }
          : e,
      ),
    };
    doc = movePoints(doc, [{ id: "p2", x: 1.5, y: 0 }]);
    const tikz = toTikz(doc);
    // Math mode spaces the = itself.
    expect(tikz).toContain("{$x=1{,}5\\textrm{ cm}$};");
    expect(tikz).toContain("{$3$};");
    // The SVG sets the prefix like LaTeX math and keeps the unit upright.
    expect(toSvg(doc)).toContain('<tspan font-style="italic">x</tspan> = 1,5 cm</text>');
  });

  it("writes word prefixes and sans-serif measures as text", () => {
    const m = { kind: "length" as const, decimals: 2, prefix: "lado ", suffix: " cm" };
    expect(measureToLatex(m, "2,5")).toBe("lado $2{,}5\\textrm{ cm}$");
    expect(measureToLatex({ ...m, prefix: "" }, "2,5", "sans")).toBe("2,5 cm");
    expect(measureRuns(m, "2,5")).toEqual([{ text: "lado 2,5 cm", italic: false }]);
  });

  it("keeps measures through normalizeDoc and drops ones the element can't have", () => {
    const doc = measured();
    expect(normalizeDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    const fixed = normalizeDoc({
      kind: "geo",
      version: 1,
      elements: [
        { id: "p1", type: "point", x: 0, y: 0, label: { text: "A", measure: { kind: "length", decimals: 2 } } },
        { id: "p2", type: "point", x: 3, y: 0 },
        { id: "s1", type: "segment", a: "p1", b: "p2", label: { text: "", measure: { kind: "length", decimals: 9 } } },
        { id: "s2", type: "segment", a: "p2", b: "p1", label: { text: "", measure: { kind: "nope" } } },
      ],
    });
    expect(fixed.elements[0].label).toMatchObject({ text: "A" });
    expect(fixed.elements[0].label?.measure).toBeUndefined();
    expect(fixed.elements[2].label?.measure).toEqual({ kind: "length", decimals: 4, prefix: "", suffix: "" });
    expect(labelText(fixed, fixed.elements[2])).toBe("3");
    expect(fixed.elements[3].label).toBeUndefined();
  });

  it("opens old docs that have no measures or texts", () => {
    const ink = { color: "ink", width: 0.8, dash: "solid", opacity: 1 };
    const doc = normalizeDoc({
      kind: "geo",
      version: 1,
      elements: [
        { id: "p1", type: "point", x: 0, y: 0, label: { text: "A", angle: null, distance: 9, size: 10, color: "ink" } },
        { id: "p2", type: "point", x: 4, y: 0 },
        { id: "s1", type: "segment", a: "p1", b: "p2", stroke: ink, ticks: 0, label: { text: "4", angle: null } },
      ],
    });
    expect(doc.elements).toHaveLength(3);
    expect(doc.elements[2].label).toEqual({ text: "4", angle: null, distance: 9, size: 10, color: "ink", font: "serif" });
    expect(toTikz(doc)).toContain("{$4$};");
  });
});

describe("auto labels", () => {
  it("labels radii, areas and perimeters as live measures", () => {
    let doc = makePolygon(triangle(), ["p1", "p2", "p3"]).doc;
    doc = makeCircle(doc, ["p1", "p3"], "through").doc;
    // Side p1p3 is a radius, so the label goes on it rather than beside the circle.
    const radius = autoLabel(doc, "circle", "radius", null, 2).doc;
    const side = radius.elements.find((e) => e.type === "segment" && [e.a, e.b].sort().join() === "p1,p3")!;
    expect(labelText(radius, side)).toBe("3");
    expect(radius.elements.find((e) => e.id === "c1")!.label).toBeUndefined();
    const area = autoLabel(doc, "polygon", "area", null, 2).doc;
    expect(area.elements.find((e) => e.id === "g1")!.label?.measure?.kind).toBe("area");
    expect(labelText(area, area.elements.find((e) => e.id === "g1")!)).toBe("6");
    const perimeter = autoLabel(doc, "polygon", "perimeter", null, 0).doc;
    expect(labelText(perimeter, perimeter.elements.find((e) => e.id === "g1")!)).toBe("12");
  });

  it("runs only the opted-in labelings, as one change", () => {
    const doc = connectPoints(triangle(), ["p1", "p2", "p3"], true).doc;
    const r = autoLabelMany(
      doc,
      [
        { type: "point", scheme: "latin" },
        { type: "segment", scheme: "length" },
        { type: "circle", scheme: "radius" },
      ],
      null,
      2,
    );
    expect(r.error).toBeUndefined();
    const text = (id: string) => labelText(r.doc, r.doc.elements.find((e) => e.id === id)!);
    expect([text("p1"), text("p2"), text("p3"), text("s1")]).toEqual(["A", "B", "C", "4"]);
    expect(autoLabelMany(doc, [], null).error).toMatch(/Marque/);
    expect(autoLabelMany(doc, [{ type: "circle", scheme: "radius" }], null).error).toBeDefined();
  });
});

describe("free text", () => {
  it('is created from the input bar with "texto"@(x;y)', () => {
    const r = parseInput('A=(0;0) "Figura 1"@(2;-1) “não está em escala”@ +(0;-1)');
    expect(r.errors).toEqual([]);
    expect(r.texts).toEqual([
      { text: "Figura 1", x: 2, y: -1 },
      { text: "não está em escala", x: 0, y: -1 },
    ]);
    expect(r.tokens.filter((t) => t.kind === "text")).toHaveLength(2);
    const doc = applyInput(emptyDoc(), r).doc;
    expect(doc.elements.map((e) => e.type)).toEqual(["point", "text", "text"]);
    expect(doc.elements[1]).toMatchObject({ id: "t1", text: "Figura 1", size: 10, color: "ink", font: "serif" });
  });

  it("reports text without a place or a closing quote", () => {
    expect(parseInput('"Figura 1"').errors[0].message).toMatch(/onde fica/);
    expect(parseInput('"Figura 1@(1;1)').errors[0].message).toMatch(/aspas/);
    expect(parseInput('""@(1;1)').errors[0].message).toMatch(/vazio/);
  });

  it("draws, exports, moves, bounds and deletes a text", () => {
    let doc = addText(triangle(), { x: 2, y: -1 }, "Figura 1").doc;
    const t = doc.elements.at(-1) as FreeText;
    expect(t).toMatchObject({ type: "text", x: 2, y: -1 });
    expect(toSvg(doc)).toContain(">Figura 1</text>");
    expect(toTikz(doc)).toContain("\\node[text=black] at (2,-1) {Figura 1};");
    expect(toTikz(addText(doc, { x: 0, y: 0 }, "x₁").doc)).toContain("{$x_{1}$};");
    const scene = buildScene(doc);
    expect(scene.hits.some((h) => h.owner === t.id && h.type === "text")).toBe(true);
    expect(scene.box!.maxY).toBeGreaterThanOrEqual(1 * scene.k);
    doc = movePoints(doc, [{ id: t.id, x: 5, y: 5 }]);
    expect(doc.elements.at(-1)).toMatchObject({ x: 5, y: 5 });
    expect(deleteElements(doc, [t.id]).doc.elements.some((e) => e.type === "text")).toBe(false);
    expect(addText(doc, { x: 0, y: 0 }, "   ").error).toBeDefined();
  });

  it("escapes text that isn't math in TikZ", () => {
    const doc = addText(emptyDoc(), { x: 0, y: 0 }, "não está em escala").doc;
    expect(toTikz(doc)).toContain("{não está em escala}");
  });

  it("survives normalizeDoc and drops broken texts", () => {
    const doc = addText(triangle(), { x: 1, y: 1 }, "x", {
      styles: { ...DEFAULT_STYLES, label: { ...DEFAULT_STYLES.label, size: 14, font: "sans", color: "#d62828" } },
    }).doc;
    expect(normalizeDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    const fixed = normalizeDoc({
      kind: "geo",
      version: 1,
      elements: [
        { id: "t1", type: "text", x: 0, y: 0, text: "ok", size: 500, color: "red" },
        { id: "t2", type: "text", x: 0, y: 0, text: "  " },
        { id: "t3", type: "text", x: "a", y: 0, text: "x" },
      ],
    });
    expect(fixed.elements).toEqual([{ id: "t1", type: "text", x: 0, y: 0, text: "ok", size: 72, color: "ink", font: "serif" }]);
  });
});
