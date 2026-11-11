import { describe, expect, it } from "vitest";
import {
  addCircuitTemplate,
  addComponent,
  addPoints,
  buildScene,
  circuitOf,
  connectPoints,
  deleteElements,
  emptyDoc,
  flipComponent,
  normalizeDoc,
  setCircuit,
  solveCircuit,
  toSvg,
  toTikz,
  translate,
  updateComponent,
  type Component,
  type FigureDoc,
} from "./index";

const pieces = (doc: FigureDoc) => doc.elements.filter((e): e is Component => e.type === "component");
const byName = (doc: FigureDoc, name: string) => pieces(doc).find((c) => c.name === name)!;
const state = (doc: FigureDoc, name: string) => {
  const s = solveCircuit(doc);
  if (!s.ok) throw new Error(s.error);
  return s.pieces.get(byName(doc, name).id)!;
};

describe("circuit solver", () => {
  it("solves a series circuit: one current, voltages split by resistance", () => {
    const { doc } = addCircuitTemplate(emptyDoc(), "series");
    expect(state(doc, "R₁").current).toBeCloseTo(2);
    expect(state(doc, "R₂").current).toBeCloseTo(2);
    expect(Math.abs(state(doc, "R₁").voltage!)).toBeCloseTo(8);
    expect(Math.abs(state(doc, "R₂").voltage!)).toBeCloseTo(4);
    // The current leaves the source by its positive end: a generator.
    expect(state(doc, "ε").current).toBeCloseTo(2);
  });

  it("splits the current between parallel branches", () => {
    const { doc } = addCircuitTemplate(emptyDoc(), "parallel");
    expect(Math.abs(state(doc, "R₁").current)).toBeCloseTo(2);
    expect(Math.abs(state(doc, "R₂").current)).toBeCloseTo(4);
    expect(state(doc, "ε").current).toBeCloseTo(6);
  });

  it("solves a mixed circuit", () => {
    const { doc } = addCircuitTemplate(emptyDoc(), "mixed");
    // R₁ = 2 in series with 6 ∥ 3 = 2: 4 Ω, so 3 A from 12 V.
    expect(Math.abs(state(doc, "R₁").current)).toBeCloseTo(3);
    expect(Math.abs(state(doc, "R₂").current)).toBeCloseTo(1);
    expect(Math.abs(state(doc, "R₃").current)).toBeCloseTo(2);
  });

  it("finds a receptor: a source the others push current through backwards", () => {
    // 12 V and 6 V facing each other around one loop with 4 Ω: 1,5 A, into the + of the smaller one.
    let { doc } = addCircuitTemplate(emptyDoc(), "series");
    doc = updateComponent(doc, byName(doc, "R₂").id, { kind: "source", value: 6 }).doc;
    const second = pieces(doc).find((c) => c.kind === "source" && c.name !== "ε")!;
    doc = flipComponent(doc, second.id).doc;
    doc = updateComponent(doc, byName(doc, "R₁").id, { value: 4 }).doc;
    const s = solveCircuit(doc);
    if (!s.ok) throw new Error(s.error);
    expect(s.pieces.get(byName(doc, "ε").id)!.current).toBeCloseTo(1.5);
    expect(s.pieces.get(second.id)!.current).toBeCloseTo(-1.5);
    const svg = toSvg(setCircuit(doc, { on: true }).doc);
    expect(svg).toContain("receptor");
  });

  it("reads ideal meters: the ammeter takes the branch current, the voltmeter its voltage and none of it", () => {
    let { doc } = addCircuitTemplate(emptyDoc(), "series");
    doc = updateComponent(doc, byName(doc, "R₂").id, { kind: "ammeter" }).doc;
    // 12 V over R₁ = 4 Ω alone.
    expect(Math.abs(state(doc, "A").current)).toBeCloseTo(3);
    const r1 = byName(doc, "R₁");
    const across = addComponent(doc, [r1.a, r1.b], "voltmeter");
    expect(across.error).toBeUndefined();
    expect(Math.abs(state(across.doc, "V").voltage!)).toBeCloseTo(12);
    expect(state(across.doc, "V").current).toBe(0);
    expect(Math.abs(state(across.doc, "R₁").current)).toBeCloseTo(3);
  });

  it("stops the current with an open switch and takes the internal resistance into account", () => {
    let { doc } = addCircuitTemplate(emptyDoc(), "series");
    const source = byName(doc, "ε");
    doc = updateComponent(doc, source.id, { internal: 2 }).doc;
    // 12 V over 4 + 2 + 2 Ω.
    expect(state(doc, "R₁").current).toBeCloseTo(1.5);
    doc = updateComponent(doc, byName(doc, "R₂").id, { kind: "switch" }).doc;
    doc = updateComponent(doc, byName(doc, "Ch").id, { closed: false }).doc;
    expect(state(doc, "R₁").current).toBe(0);
  });

  it("explains a short-circuited ideal source", () => {
    const pts = addPoints(emptyDoc(), [{ x: 0, y: 0 }, { x: 0, y: 3 }]);
    let doc = addComponent(pts.doc, pts.created, "source").doc;
    doc = connectPoints(doc, pts.created, false).doc;
    const s = solveCircuit(doc);
    expect(s.ok).toBe(false);
    expect(!s.ok && s.error).toMatch(/curto-circuito/);
    expect(setCircuit(doc, { on: true }).error).toMatch(/curto-circuito/);
    expect(translate(!s.ok ? s.error : "", "en")).toMatch(/short-circuited/);
  });
});

describe("circuit pieces in the figure", () => {
  it("adds a piece between two points, with its name and value, and the circuit with it", () => {
    const pts = addPoints(emptyDoc(), [{ x: 0, y: 0 }, { x: 4, y: 0 }]);
    const r = addComponent(pts.doc, pts.created, "resistor");
    expect(r.error).toBeUndefined();
    const piece = pieces(r.doc)[0];
    expect(piece.label?.text).toBe("R₁ = 10 Ω");
    expect(circuitOf(r.doc)).toBeDefined();
    expect(addComponent(pts.doc, [pts.created[0]], "lamp").error).toMatch(/dois pontos/);
    // Its label follows the value until the teacher writes another.
    const changed = updateComponent(r.doc, piece.id, { value: 4.7 }).doc;
    expect(pieces(changed)[0].label?.text).toBe("R₁ = 4,7 Ω");
    expect(updateComponent(r.doc, piece.id, { value: 0 }).error).toMatch(/maior que zero/);
  });

  it("names pieces as books do", () => {
    let { doc } = addCircuitTemplate(emptyDoc(), "twoLoops");
    expect(pieces(doc).map((c) => c.name)).toEqual(["ε", "R₁", "R₂", "R₃", "ε₂"]);
    doc = addCircuitTemplate(doc, "series").doc;
    expect(pieces(doc).filter((c) => c.kind === "source").map((c) => c.name)).toEqual(["ε", "ε₂", "ε₃"]);
  });

  it("shows dots only where three or more wires meet", () => {
    const { doc } = addCircuitTemplate(emptyDoc(), "parallel");
    const shown = doc.elements.filter((e) => e.type === "point" && e.shape === "dot");
    expect(shown).toHaveLength(2);
  });

  it("draws every symbol in the SVG and in TikZ, as plain TikZ", () => {
    let { doc } = addCircuitTemplate(emptyDoc(), "series");
    for (const kind of ["lamp", "capacitor", "voltmeter"] as const) {
      const ends = addPoints(doc, [{ x: 10, y: 0 }, { x: 13, y: kind.length }]);
      doc = addComponent(ends.doc, ends.created, kind).doc;
    }
    const scene = buildScene(doc);
    expect(scene.hits.filter((h) => h.type === "component")).toHaveLength(6);
    const tikz = toTikz(doc);
    expect(tikz).not.toContain("circuitikz");
    expect(tikz).toContain("circle[radius=");
    expect(tikz).toContain("{$R_{1}=4\\ \\Omega$}");
  });

  it("writes the current and voltage of each piece when switched on, and arrows for the current", () => {
    const { doc } = addCircuitTemplate(emptyDoc(), "series");
    const off = toSvg(doc);
    expect(off).not.toContain("2 A");
    const on = setCircuit(doc, { on: true, current: "conventional" }).doc;
    const svg = toSvg(on);
    expect(svg).toMatch(/i<\/tspan> = 2</);
    expect(svg).toMatch(/U<\/tspan> = 8</);
    const tikz = toTikz(on);
    expect(tikz).toContain("\\mbox{ A}");
    // Electrons go the other way: the arrows turn around.
    const real = toTikz(setCircuit(doc, { current: "real" }).doc);
    const conventional = toTikz(setCircuit(doc, { current: "conventional" }).doc);
    expect(real).not.toEqual(conventional);
  });

  it("keeps pieces and settings through a saved file, and drops the settings with the last piece", () => {
    const on = setCircuit(addCircuitTemplate(emptyDoc(), "series").doc, { on: true, current: "real" }).doc;
    const again = normalizeDoc(JSON.parse(JSON.stringify(on)));
    expect(again).toEqual(on);
    const gone = deleteElements(on, pieces(on).map((c) => c.id)).doc;
    expect(circuitOf(gone)).toBeUndefined();
  });
});

describe("circuits in recipes", () => {
  it("builds a circuit from points, pieces and wires, and explains an impossible one", async () => {
    const { compileRecipe, GUIDE } = await import("../recipe");
    const result = compileRecipe(GUIDE.circuits.examples[1].recipe);
    expect(result.errors).toEqual([]);
    expect(Math.abs(state(result.doc, "A").current)).toBeCloseTo(0.25);
    // The corners are plain wire.
    expect(result.doc.elements.filter((e) => e.type === "point" && e.shape !== "none")).toHaveLength(0);
    const shorted = compileRecipe({
      v: 1,
      steps: [
        { do: "points", points: [{ name: "A", at: [0, 0] }, { name: "B", at: [0, 3] }] },
        { do: "component", kind: "source", from: "A", to: "B" },
        { do: "segment", points: ["A", "B"] },
        { do: "circuit", on: true },
      ],
    });
    expect(shorted.errors[0]?.message).toMatch(/curto-circuito|short/);
  });
});
