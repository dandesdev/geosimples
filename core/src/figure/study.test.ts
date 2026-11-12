import { describe, expect, it } from "vitest";
import {
  addStudy,
  addStudySketch,
  applyInput,
  buildScene,
  emptyDoc,
  insertStudyPoint,
  mathText,
  normalizeDoc,
  parseInput,
  prettyMath,
  readStudy,
  removeStudyPiece,
  setStudyText,
  setStudyWidth,
  stretchWidths,
  studyLayout,
  studyMath,
  studyPaths,
  studyPiece,
  studyPieceName,
  studyPieces,
  toSvg,
  toTikz,
  updateStudyPoint,
  updateStudySketch,
  type FigureDoc,
  type Study,
} from "./index";

const studyOf = (doc: FigureDoc): Study => doc.elements.find((e): e is Study => e.type === "study")!;

function made(source: string): { doc: FigureDoc; study: Study } {
  const result = addStudy(emptyDoc(), source);
  expect(result.error).toBeUndefined();
  return { doc: result.doc, study: studyOf(result.doc) };
}

describe("reading estudo", () => {
  it("is null for anything else", () => {
    expect(readStudy("varal [1;3]")).toBeNull();
    expect(readStudy("A=0;0")).toBeNull();
  });

  it("takes blank points, names, or curves", () => {
    expect(readStudy("estudo")).toMatchObject({ points: [{ label: "" }, { label: "" }] });
    expect(readStudy("estudo ?; ?; ?")).toMatchObject({ points: [{ label: "" }, { label: "" }, { label: "" }], intervals: ["", "", "", ""] });
    expect(readStudy("Estudo a; b")).toMatchObject({ points: [{ label: "a" }, { label: "b" }] });
    expect(readStudy("estudo x₁ x₂")).toMatchObject({ points: [{ label: "x₁" }, { label: "x₂" }] });
  });

  it("puts the zeros of the curves on the line, sketches them and writes the stretches", () => {
    const spec = readStudy("estudo x-2; x²-5x+4");
    expect(spec).toMatchObject({
      points: [{ label: "1" }, { label: "2" }, { label: "4" }],
      intervals: ["x < 1", "1 ≤ x < 2", "2 ≤ x < 4", "x ≥ 4"],
      sketches: [
        { shape: "line", up: true, roots: [1], label: "x − 2" },
        { shape: "parabola", up: true, roots: [0, 2], label: "x² − 5x + 4" },
      ],
    });
  });

  it("sketches a module by what is inside it, a double root as one touch, and keeps exact roots", () => {
    expect(readStudy("estudo |x-2|; -x^2+2x-1")).toMatchObject({
      points: [{ label: "1" }, { label: "2" }],
      sketches: [{ shape: "line", roots: [1] }, { shape: "parabola", up: false, roots: [0] }],
    });
    expect(readStudy("estudo x^2-4x+1")).toMatchObject({ points: [{ label: "2 − √3" }, { label: "2 + √3" }] });
  });

  it("says what is wrong", () => {
    expect(readStudy("estudo x^3-x")).toMatch(/1º ou do 2º grau/);
    expect(readStudy(`estudo ${Array(11).fill("?").join(";")}`)).toMatch(/até 10 pontos/);
  });

  it("is the whole input of the bar", () => {
    const parsed = parseInput("estudo a; b; c");
    expect(parsed.studies).toEqual(["estudo a; b; c"]);
    const doc = applyInput(emptyDoc(), parsed).doc;
    expect(studyOf(doc).axis.points.map((p) => p.label)).toEqual(["a", "b", "c"]);
    expect(parseInput("estudo x^3").errors.length).toBe(1);
  });
});

describe("typed math", () => {
  it("writes the signs a keyboard lacks", () => {
    expect(prettyMath("1<=x<2")).toBe("1 ≤ x < 2");
    expect(prettyMath("x^2-5x+4")).toBe("x² − 5x + 4");
    expect(prettyMath("-x+2>=-1")).toBe("−x + 2 ≥ −1");
    expect(prettyMath("Resolução parcial")).toBe("Resolução parcial");
  });

  it("makes fractions and roots, and writes them back", () => {
    expect(studyMath("1/2")).toEqual({ frac: ["1", "2"] });
    // The space before the root stays as room of its own.
    expect(studyMath("2 + √3")).toEqual({ row: ["2 +", " ", { sqrt: "3" }] });
    expect(studyMath("(4-2√3)/2")).toEqual({ frac: [{ row: ["4 − 2", { sqrt: "3" }] }, "2"] });
    expect(mathText({ frac: [{ row: ["1 + ", { sqrt: "5" }] }, "2"] })).toBe("(1 + √5)/2");
  });
});

describe("study pieces", () => {
  it("names each piece by ids, in reading order", () => {
    const { study } = made("estudo a; b");
    const withDividers = { ...study, axis: { ...study.axis, points: study.axis.points.map((p) => ({ ...p, divider: true })) } };
    expect(studyPieces(withDividers)).toEqual([
      "interval:start",
      "point:p1",
      "divider:p1",
      "interval:p1",
      "point:p2",
      "divider:p2",
      "interval:p2",
    ]);
    expect(studyPieceName(study, "point:p2")).toBe("Ponto 2 (b)");
    expect(studyPiece(study, "point:p9")).toBeNull();
  });

  it("puts a point in a stretch and keeps the text on the left", () => {
    let { doc } = made("estudo a; b");
    doc = setStudyText(doc, studyOf(doc).id, "interval:p1", "a ≤ x < b").doc;
    const inserted = insertStudyPoint(doc, studyOf(doc).id, 1);
    const s = studyOf(inserted.doc);
    expect(s.axis.points.map((p) => p.label)).toEqual(["a", "", "b"]);
    expect(s.axis.intervals).toEqual(["", "a ≤ x < b", "", ""]);
    expect(s.axis.widths).toHaveLength(4);
    expect(inserted.part).toBe(studyPaths.point(s.axis.points[1].id));
    // The selected stretch keeps its path: it is named by the point before it.
    expect(studyPiece(s, "interval:p1")).toEqual({ kind: "interval", index: 1 });
  });

  it("removes a point with its stretch and its sketch roots", () => {
    const { doc, study } = made("estudo x-2; x²-5x+4");
    const two = study.axis.points[1].id;
    const s = studyOf(removeStudyPiece(doc, study.id, studyPaths.point(two)).doc);
    expect(s.axis.points.map((p) => p.label)).toEqual(["1", "4"]);
    expect(s.axis.intervals).toEqual(["x < 1", "1 ≤ x < 2", "x ≥ 4"]);
    // The line through 2 has nothing left to cross; the parabola stays.
    expect(s.axis.sketches.map((sk) => sk.shape)).toEqual(["parabola"]);
  });

  it("clears a text, drops a divider and a sketch", () => {
    let { doc, study } = made("estudo x-2");
    doc = updateStudyPoint(doc, study.id, "p1", { divider: true, drop: 30 }).doc;
    expect(studyOf(doc).axis.points[0]).toMatchObject({ divider: true, drop: 30 });
    doc = removeStudyPiece(doc, study.id, "divider:p1").doc;
    expect(studyOf(doc).axis.points[0]).toMatchObject({ divider: false, drop: 0 });
    doc = removeStudyPiece(doc, study.id, "interval:start").doc;
    expect(studyOf(doc).axis.intervals[0]).toBe("");
    doc = removeStudyPiece(doc, study.id, "sketch:s1").doc;
    expect(studyOf(doc).axis.sketches).toEqual([]);
    study = studyOf(doc);
    expect(removeStudyPiece(doc, study.id, "sketch:s1").error).toBeTruthy();
  });

  it("adds and changes sketches, keeping roots in line order", () => {
    const { doc: start, study } = made("estudo a; b; c");
    let doc = start;
    const added = addStudySketch(doc, study.id, "parabola");
    expect(added.part).toBe("sketch:s1");
    doc = updateStudySketch(added.doc, study.id, "s1", { roots: ["p3", "p1"] }).doc;
    expect(studyOf(doc).axis.sketches[0].roots).toEqual(["p1", "p3"]);
    doc = updateStudySketch(doc, study.id, "s1", { shape: "line" }).doc;
    expect(studyOf(doc).axis.sketches[0]).toMatchObject({ shape: "line", roots: ["p1"] });
  });

  it("widens a stretch for its text and lets it be widened by hand", () => {
    const { doc: start, study } = made("estudo a; b");
    let doc = start;
    const narrow = stretchWidths(study)[1];
    doc = setStudyText(doc, study.id, "interval:p1", "uma frase bem mais longa que o trecho").doc;
    expect(stretchWidths(studyOf(doc))[1]).toBeGreaterThan(narrow);
    doc = setStudyWidth(doc, study.id, 0, 200).doc;
    expect(stretchWidths(studyOf(doc))[0]).toBe(200);
  });
});

describe("study layout", () => {
  it("draws the line with an open arrow, the points, dividers and sketches as pieces", () => {
    const { doc: start, study } = made("estudo x-2; x²-5x+4");
    let doc = start;
    for (const p of study.axis.points) doc = updateStudyPoint(doc, study.id, p.id, { divider: true }).doc;
    const layout = studyLayout(studyOf(doc));
    expect(layout.groups[0].part).toBeNull();
    expect(layout.groups[0].marks.some((m) => m.kind === "head" && m.open)).toBe(true);
    const parts = new Set(layout.groups.map((g) => g.part));
    for (const path of ["point:p1", "divider:p2", "sketch:s1", "sketch:s2", "interval:start"]) expect(parts.has(path)).toBe(true);
    // Every curve stays within its reach over and under the line.
    const curves = layout.groups.flatMap((g) => g.marks).filter((m) => m.kind === "curve");
    expect(curves.length).toBeGreaterThan(0);
    for (const c of curves) for (const p of c.points) expect(Math.abs(p.y)).toBeLessThanOrEqual(study.size * 2.2 + 1e-6);
    // The points sit left to right, and dividers reach under the line.
    const xs = layout.points.map((p) => p.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(layout.points.every((p) => p.bottom !== null && p.bottom < 0)).toBe(true);
  });

  it("keeps blank pieces pickable without drawing them", () => {
    const { study } = made("estudo ?; ?");
    const layout = studyLayout(study);
    expect(layout.groups.flatMap((g) => g.marks).some((m) => m.kind === "text")).toBe(false);
    expect(layout.pieces.filter((p) => p.empty).map((p) => p.path)).toEqual(["interval:start", "interval:p1", "interval:p2", "point:p1", "point:p2"]);
  });

  it("goes through the scene, the SVG and the TikZ", () => {
    const { doc, study } = made("estudo x-2; x²-5x+4");
    const scene = buildScene(doc);
    expect(scene.hits.some((h) => h.owner === study.id && h.type === "study")).toBe(true);
    expect(scene.parts.filter((p) => p.owner === study.id).map((p) => p.path)).toContain("sketch:s2");
    expect(scene.studies[0].points).toHaveLength(3);
    expect(toSvg(doc)).toContain("<path");
    const tikz = toTikz(doc);
    expect(tikz).toContain("x^{2}");
    expect(tikz).toMatch(/\\draw.*--/);
  });
});

describe("saved studies", () => {
  it("survive a round trip and get fixed when broken", () => {
    const { doc, study } = made("estudo x-2; x²-5x+4");
    expect(normalizeDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    const broken = {
      ...doc,
      elements: [
        {
          ...study,
          axis: {
            points: [...study.axis.points, study.axis.points[0], { id: "bad id" }],
            intervals: ["only one"],
            widths: [],
            sketches: [{ id: "s1", shape: "line", roots: ["gone"] }, { id: "s2", shape: "parabola", roots: ["p3", "p1", "p2"] }],
          },
        },
      ],
    };
    const fixed = studyOf(normalizeDoc(JSON.parse(JSON.stringify(broken))));
    expect(fixed.axis.points.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(fixed.axis.intervals).toEqual(["only one", "", "", ""]);
    expect(fixed.axis.widths).toHaveLength(4);
    expect(fixed.axis.sketches).toEqual([{ id: "s2", shape: "parabola", up: true, roots: ["p1", "p2"], label: "" }]);
  });
});

describe("study shortcuts", () => {
  it("writes the stretches from the names, and sets every ball", async () => {
    const { fillStudyIntervals, setStudyBalls } = await import("./index");
    const { doc: start, study } = made("estudo ?; b");
    let doc = start;
    expect(fillStudyIntervals(doc, study.id).error).toMatch(/nome/);
    doc = setStudyText(doc, study.id, "point:p1", "a").doc;
    doc = fillStudyIntervals(doc, study.id).doc;
    expect(studyOf(doc).axis.intervals).toEqual(["x < a", "a ≤ x < b", "x ≥ b"]);
    doc = setStudyBalls(doc, study.id, "open").doc;
    expect(studyOf(doc).axis.points.every((p) => p.ball === "open")).toBe(true);
  });
});

describe("study rows", () => {
  it("puts the stretch texts over the sketches, and the names on top of the dividers", () => {
    const { doc, study } = made("estudo x-2; x²-5x+4");
    let d = doc;
    for (const p of study.axis.points) d = updateStudyPoint(d, study.id, p.id, { divider: true }).doc;
    const layout = studyLayout(studyOf(d));
    const box = (path: string) => layout.pieces.find((p) => p.path === path && p.text)!.text!;
    const curveTop = Math.max(...layout.groups.flatMap((g) => g.marks).flatMap((m) => (m.kind === "curve" ? m.points.map((p) => p.y) : [])));
    expect(box("interval:p1").minY).toBeGreaterThan(curveTop);
    expect(box("point:p1").minY).toBeGreaterThan(box("interval:p1").maxY);
    // The sketches are thinner than the line, and dashed when asked.
    const curve = layout.groups.flatMap((g) => g.marks).find((m) => m.kind === "curve")!;
    expect(curve.kind === "curve" && curve.width! < studyOf(d).width).toBe(true);
    const dotted = studyLayout({ ...studyOf(d), sketchDash: "dotted" }).groups.flatMap((g) => g.marks).find((m) => m.kind === "curve")!;
    expect(dotted.kind === "curve" && dotted.dash).toBe("dotted");
  });
});

describe("study limits", () => {
  it("keeps widths and drops whatever the font size, and cuts generated texts to what is kept", () => {
    const { doc, study } = made("estudo a; b");
    let d = setStudyWidth(doc, study.id, 0, 18).doc;
    d = updateStudyPoint(d, study.id, "p1", { drop: -40 }).doc;
    const bigger = { ...d, elements: d.elements.map((e) => (e.type === "study" ? { ...e, size: 40 } : e)) };
    const back = studyOf(normalizeDoc(JSON.parse(JSON.stringify(bigger))));
    expect(back.axis.widths[0]).toBe(18);
    expect(back.axis.points[0].drop).toBe(-40);
    const long = readStudy(`estudo ${Array(20).fill("x").join("+")}-1`);
    if (!long || typeof long === "string") throw new Error(String(long));
    expect(long.sketches[0].label.length).toBe(60);
  });
});
