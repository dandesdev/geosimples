import { describe, expect, it } from "vitest";
import {
  addPoints,
  angleArc,
  autoLabel,
  buildScene,
  circumcircle,
  connectPoints,
  deleteElements,
  emptyDoc,
  DEFAULT_STYLES,
  fillShapes,
  formatNumber,
  labelToLatex,
  makeAngles,
  makeCircle,
  makePolygon,
  movePoints,
  normalizeDoc,
  parseInput,
  applyInput,
  pointOnSegment,
  projectPoint,
  toSvg,
  toTikz,
  type Circle,
  type FigureDoc,
  type ParsedPoint,
  type Point,
} from "./index";

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

  it("projects a point and marks the height", () => {
    const r = projectPoint(triangle(), ["p3", "p1", "p2"], true);
    expect(r.error).toBeUndefined();
    const foot = r.doc.elements.find((e) => e.id === r.created[0]);
    expect(foot).toMatchObject({ x: 0, y: 0 });
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
    expect(tikz).toContain("\\begin{tikzpicture}[x=1cm, y=1cm]");
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
    expect(tikz).toContain("[x=2cm, y=2cm]");
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
