import { COMPONENT_LETTER, componentText, solveCircuit } from "./circuit";
import { DEFAULT_STYLES, LIMITS } from "./defaults";
import { withText } from "./labels";
import { buildScene } from "./render";
import { idMaker, LIMIT_ERROR, roomFor, selectedOfType, withElements, type OpOptions, type OpResult } from "./ops";
import type { Circuit, Component, ComponentKind, Element, FigureDoc, Id, Point, Segment } from "./types";
import { dist, type Vec } from "./vec";

/** Ready-made circuits in Inserir: in series, in parallel, mixed, and two loops with a source each. */
export type CircuitTemplate = "series" | "parallel" | "mixed" | "twoLoops";

export const COMPONENT_KINDS: readonly ComponentKind[] = ["resistor", "lamp", "source", "switch", "ammeter", "voltmeter", "capacitor"];

/** Length of a new piece's symbol along its wire, in pt. */
export const DEFAULT_COMPONENT_SIZE = 24;

/** What a new piece of each kind is worth: Ω, V or μF. */
const DEFAULT_VALUE: Record<ComponentKind, number> = { resistor: 10, lamp: 10, source: 12, switch: 0, ammeter: 0, voltmeter: 0, capacitor: 2 };

const isMeter = (kind: ComponentKind) => kind === "ammeter" || kind === "voltmeter";

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
const subscript = (n: number) => String(n).replace(/\d/g, (d) => SUBSCRIPTS[Number(d)]);

/** Kinds a book numbers from the first (R₁, R₂); the others take a number only from the second on (ε, ε₂). */
const ALWAYS_NUMBERED: ComponentKind[] = ["resistor", "lamp", "capacitor"];

function nextName(doc: FigureDoc, kind: ComponentKind): string {
  const letter = COMPONENT_LETTER[kind];
  const used = new Set(doc.elements.flatMap((e) => (e.type === "component" ? [e.name] : [])));
  if (!ALWAYS_NUMBERED.includes(kind) && !used.has(letter)) return letter;
  for (let i = ALWAYS_NUMBERED.includes(kind) ? 1 : 2; ; i++) {
    const name = letter + subscript(i);
    if (!used.has(name)) return name;
  }
}

export const circuitOf = (doc: FigureDoc): Circuit | undefined => doc.elements.find((e): e is Circuit => e.type === "circuit");

function newCircuit(id: Id, opts: OpOptions): Circuit {
  const styles = opts.styles ?? DEFAULT_STYLES;
  return {
    id,
    type: "circuit",
    on: false,
    current: "none",
    values: { current: true, voltage: true, power: false },
    decimals: 2,
    size: styles.label.size,
    color: styles.label.color,
    font: styles.label.font,
  };
}

function newComponent(doc: FigureDoc, id: Id, kind: ComponentKind, a: Id, b: Id, opts: OpOptions, value?: number): Component {
  const styles = opts.styles ?? DEFAULT_STYLES;
  const base = { kind, name: nextName(doc, kind), value: value ?? DEFAULT_VALUE[kind], internal: 0 };
  return {
    id,
    type: "component",
    ...base,
    a,
    b,
    closed: true,
    shape: "zigzag",
    size: DEFAULT_COMPONENT_SIZE,
    stroke: { ...styles.stroke, dash: "solid" },
    // A meter's letter is in its circle: a name beside it would say it twice.
    ...(isMeter(kind) ? {} : { label: withText(undefined, componentText(base, doc.locale), styles.label) }),
  };
}

/** The points a circuit's wires join: the ends of its pieces, and every point a segment links to them. */
function wiredPoints(doc: FigureDoc): Set<Id> {
  const out = new Set(doc.elements.flatMap((e) => (e.type === "component" ? [e.a, e.b] : [])));
  const segments = doc.elements.filter((e): e is Segment => e.type === "segment");
  for (let grew = true; grew; ) {
    grew = false;
    for (const s of segments) {
      if (out.has(s.a) !== out.has(s.b)) {
        out.add(s.a);
        out.add(s.b);
        grew = true;
      }
    }
  }
  return out;
}

/**
 * A circuit's points show only where three or more wires meet, as the dots
 * of a junction; corners and the ends of a piece are plain wire.
 */
export function tidyJunctions(doc: FigureDoc): FigureDoc {
  const wired = wiredPoints(doc);
  const degree = new Map<Id, number>();
  for (const e of doc.elements) {
    if (e.type !== "segment" && e.type !== "component") continue;
    for (const p of [e.a, e.b]) degree.set(p, (degree.get(p) ?? 0) + 1);
  }
  return withElements(
    doc,
    doc.elements.map((e): Element => {
      if (e.type !== "point" || !wired.has(e.id)) return e;
      const shape = (degree.get(e.id) ?? 0) >= 3 ? "dot" : "none";
      return e.shape === shape ? e : { ...e, shape };
    }),
  );
}

/** The figure with its circuit settings, made with the first piece. */
function withCircuit(doc: FigureDoc, opts: OpOptions): FigureDoc {
  if (circuitOf(doc)) return doc;
  return withElements(doc, [...doc.elements, newCircuit(idMaker(doc)("circuit"), opts)]);
}

/** A piece of the given kind between the two selected points; a source's positive end goes at the second. */
export function addComponent(doc: FigureDoc, selection: Id[], kind: ComponentKind, opts: OpOptions = {}): OpResult {
  const points = selectedOfType(doc, selection, "point");
  if (points.length !== 2) return { doc, created: [], error: "Selecione dois pontos: o componente fica entre eles." };
  const [a, b] = points;
  if (dist(a, b) < 1e-9) return { doc, created: [], error: "Os pontos coincidem." };
  if (!roomFor(doc, 2)) return { doc, created: [], error: LIMIT_ERROR };
  const piece = newComponent(doc, idMaker(doc)("component"), kind, a.id, b.id, opts);
  const next = tidyJunctions(withCircuit(withElements(doc, [...doc.elements, piece]), opts));
  return { doc: next, created: [piece.id] };
}

/** Space in cm between a new ready-made circuit and what is left of it, with room for its source's label. */
const GAP = 3.5;

/** Where a new ready-made circuit goes: right of everything drawn, labels too, level with its bottom. */
function spotBeside(doc: FigureDoc): Vec {
  const { box, kx, ky } = buildScene(doc);
  if (!box) return { x: 0, y: 0 };
  return { x: Math.ceil(box.maxX / kx + GAP), y: Math.round(-box.maxY / ky) };
}

type Piece = [ComponentKind, number, number, number?];

/** Corners and pieces of each ready-made circuit, in cm from its bottom left: [kind, from, to, value]. */
const TEMPLATES: Record<CircuitTemplate, { points: Vec[]; wires: [number, number][]; pieces: Piece[] }> = {
  // ε on the left, R₁ on top, R₂ down the right.
  series: {
    points: [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 0 }],
    wires: [[3, 0]],
    pieces: [["source", 0, 1, 12], ["resistor", 1, 2, 4], ["resistor", 2, 3, 2]],
  },
  // R₁ and R₂ side by side, both across ε.
  parallel: {
    points: [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 4.5, y: 4 }, { x: 9, y: 4 }, { x: 9, y: 0 }, { x: 4.5, y: 0 }],
    wires: [[1, 2], [2, 3], [4, 5], [5, 0]],
    pieces: [["source", 0, 1, 12], ["resistor", 2, 5, 6], ["resistor", 3, 4, 3]],
  },
  // R₁ in series with R₂ ∥ R₃.
  mixed: {
    points: [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 4.5, y: 4 }, { x: 9, y: 4 }, { x: 9, y: 0 }, { x: 4.5, y: 0 }],
    wires: [[2, 3], [4, 5], [5, 0]],
    pieces: [["source", 0, 1, 12], ["resistor", 1, 2, 2], ["resistor", 2, 5, 6], ["resistor", 3, 4, 3]],
  },
  // Two loops sharing the middle branch, with a source on each side.
  twoLoops: {
    points: [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 4.5, y: 4 }, { x: 9, y: 4 }, { x: 9, y: 0 }, { x: 4.5, y: 0 }],
    wires: [[4, 5], [5, 0]],
    pieces: [["source", 0, 1, 12], ["resistor", 1, 2, 2], ["resistor", 2, 5, 2], ["resistor", 2, 3, 2], ["source", 4, 3, 9]],
  },
};

/** A ready-made circuit, right of the figure, with its corners as hidden points. */
export function addCircuitTemplate(doc: FigureDoc, template: CircuitTemplate, opts: OpOptions = {}, at?: Vec): OpResult {
  const t = TEMPLATES[template];
  if (!roomFor(doc, t.points.length + t.wires.length + t.pieces.length + 1)) return { doc, created: [], error: LIMIT_ERROR };
  const styles = opts.styles ?? DEFAULT_STYLES;
  const origin = at ?? spotBeside(doc);
  if (Math.abs(origin.x) + 10 > LIMITS.coordinate) return { doc, created: [], error: "A figura chegou ao limite de espaço." };
  const nextId = idMaker(doc);
  let working = doc;
  const add = (el: Element) => (working = withElements(working, [...working.elements, el]));
  const ids = t.points.map((p) => {
    const point: Point = { id: nextId("point"), type: "point", x: origin.x + p.x, y: origin.y + p.y, ...styles.point, shape: "none" };
    add(point);
    return point.id;
  });
  for (const [from, to] of t.wires) {
    add({ id: nextId("segment"), type: "segment", a: ids[from], b: ids[to], stroke: { ...styles.stroke, dash: "solid" }, ticks: 0 });
  }
  const created: Id[] = [];
  for (const [kind, from, to, value] of t.pieces) {
    const piece = newComponent(working, nextId("component"), kind, ids[from], ids[to], opts, value);
    add(piece);
    created.push(piece.id);
  }
  return { doc: tidyJunctions(withCircuit(working, opts)), created };
}

/** What can change on a piece from the panel. */
export type ComponentPatch = Partial<Pick<Component, "kind" | "value" | "internal" | "closed" | "shape" | "name" | "size">>;

/**
 * Changes a piece. Its label follows its name and value while it still says
 * what they said; a label the teacher wrote stays.
 */
export function updateComponent(doc: FigureDoc, id: Id, patch: ComponentPatch): OpResult {
  const el = doc.elements.find((e): e is Component => e.type === "component" && e.id === id);
  if (!el) return { doc, created: [] };
  if (patch.value !== undefined && !(Number.isFinite(patch.value) && patch.value >= 0 && patch.value <= 1e9)) {
    return { doc, created: [], error: "Use um valor entre 0 e 1 000 000 000." };
  }
  if (patch.internal !== undefined && !(Number.isFinite(patch.internal) && patch.internal >= 0 && patch.internal <= 1e9)) {
    return { doc, created: [], error: "Use uma resistência interna entre 0 e 1 000 000 000." };
  }
  let next: Component = { ...el, ...patch };
  if (patch.kind && patch.kind !== el.kind) {
    // A new kind takes its own name and usual value, unless both kinds count the same way.
    next = { ...next, name: nextName(doc, patch.kind), value: patch.value ?? (sameUnit(el.kind, patch.kind) ? el.value : DEFAULT_VALUE[patch.kind]) };
  }
  if ((next.kind === "resistor" || next.kind === "lamp") && next.value <= 0) {
    return { doc, created: [], error: "A resistência precisa ser maior que zero. Para um fio, ligue os pontos com um segmento." };
  }
  const auto = !el.label || el.label.text === componentText(el, doc.locale);
  if (auto && patch.kind && patch.kind !== el.kind) {
    // A label that only said what the piece was follows its new kind, none for a meter.
    const bare: Component = { ...next };
    delete bare.label;
    next = isMeter(next.kind) ? bare : { ...bare, label: withText(el.label, componentText(next, doc.locale)) };
  } else if (el.label && auto) next = { ...next, label: { ...el.label, text: componentText(next, doc.locale) } };
  return { doc: withElements(doc, doc.elements.map((e) => (e.id === id ? next : e))), created: [] };
}

const sameUnit = (a: ComponentKind, b: ComponentKind) => (a === "resistor" || a === "lamp") && (b === "resistor" || b === "lamp");

/** Turns a piece around: a source's poles swap. */
export function flipComponent(doc: FigureDoc, id: Id): OpResult {
  return {
    doc: withElements(doc, doc.elements.map((e) => (e.type === "component" && e.id === id ? { ...e, a: e.b, b: e.a } : e))),
    created: [],
  };
}

export type CircuitPatch = Partial<Pick<Circuit, "on" | "current" | "values" | "decimals" | "size" | "color" | "font">>;

/** Switches the circuit on or off, picks its current arrows and what it writes. Switching on checks that it has a solution. */
export function setCircuit(doc: FigureDoc, patch: CircuitPatch, opts: OpOptions = {}): OpResult {
  if (!doc.elements.some((e) => e.type === "component")) return { doc, created: [], error: "A figura não tem circuito: insira um componente primeiro." };
  const withOne = withCircuit(doc, opts);
  const circuit = circuitOf(withOne)!;
  // Fields left out stay as they are, even when given as undefined.
  const given = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as CircuitPatch;
  const next: Circuit = { ...circuit, ...given, values: { ...circuit.values, ...given.values } };
  if ((next.on && !circuit.on) || (next.current !== "none" && circuit.current === "none")) {
    const solution = solveCircuit(withOne);
    if (!solution.ok) return { doc, created: [], error: solution.error };
  }
  return { doc: withElements(withOne, withOne.elements.map((e) => (e.id === circuit.id ? next : e))), created: [] };
}
