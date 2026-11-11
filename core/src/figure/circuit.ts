import { mathWidth, type Mark, type MathNode } from "./board/marks";
import { pointMap } from "./geometry";
import { figureUnits } from "./plot";
import { componentReach, estimateTextWidth, formatNumber, labelPlacement, labelText } from "./labels";
import type { Locale } from "./messages";
import type { Circuit, Component, ComponentKind, FigureDoc, Id } from "./types";
import { scale, type Vec } from "./vec";

/**
 * Electric circuits in direct current: the pieces solved by nodal analysis,
 * and their symbols drawn as board marks, so the SVG and the TikZ come out the same.
 */

/** The state of a piece in a switched-on circuit. */
export interface PieceState {
  /** Through the piece from `a` to `b`, in A. */
  current: number;
  /** V(a) − V(b) in V, or null when its ends are in parts of the circuit not connected to each other. */
  voltage: number | null;
}

export type CircuitSolution = { ok: true; pieces: Map<Id, PieceState> } | { ok: false; error: string };

/** Pieces that let no current through: ideal voltmeters, capacitors once charged, open switches. */
const isOpen = (c: Component) => c.kind === "voltmeter" || c.kind === "capacitor" || (c.kind === "switch" && !c.closed);

/** Pieces with a fixed relation V(b) − V(a) = emf − r·i, whose current is an unknown of its own. */
const isSourceLike = (c: Component) => c.kind === "source" || c.kind === "ammeter" || (c.kind === "switch" && c.closed);

class Sets {
  private parent = new Map<string, string>();
  find(x: string): string {
    let root = x;
    while (this.parent.has(root) && this.parent.get(root) !== root) root = this.parent.get(root)!;
    this.parent.set(x, root);
    return root;
  }
  join(a: string, b: string) {
    const [ra, rb] = [this.find(a), this.find(b)];
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/**
 * Solves the circuit by modified nodal analysis. Segments are ideal wires
 * that join points into one node; ammeters and closed switches are ideal too.
 * A source whose current comes out of its positive end is a generator, and
 * one the others push current through backwards is a receptor: no special case.
 */
export function solveCircuit(doc: FigureDoc): CircuitSolution {
  const pieces = doc.elements.filter((e): e is Component => e.type === "component");
  const out = new Map<Id, PieceState>();
  if (pieces.length === 0) return { ok: true, pieces: out };

  const wires = new Sets();
  for (const e of doc.elements) if (e.type === "segment") wires.join(e.a, e.b);
  const nodeOf = (point: Id) => wires.find(point);

  // Parts joined by pieces that conduct: each one gets its own ground.
  const parts = new Sets();
  const fixed = new Map<Id, number>();
  for (const c of pieces) {
    const [i, j] = [nodeOf(c.a), nodeOf(c.b)];
    if (isOpen(c)) continue;
    if (i === j) {
      if (!isSourceLike(c)) continue;
      // Both ends on one node: a source shorted through its internal resistance, or nothing at all.
      if (c.kind === "source" && c.value !== 0) {
        if (c.internal <= 0) return { ok: false, error: "Há um gerador ideal em curto-circuito: um fio liga os seus dois polos." };
        fixed.set(c.id, c.value / c.internal);
      }
      continue;
    }
    parts.join(i, j);
  }

  const nodes = [...new Set(pieces.flatMap((c) => [nodeOf(c.a), nodeOf(c.b)]))];
  const grounds = new Set<string>();
  const seen = new Set<string>();
  for (const n of nodes) {
    const part = parts.find(n);
    if (seen.has(part)) continue;
    seen.add(part);
    grounds.add(n);
  }
  const unknown = new Map<string, number>();
  for (const n of nodes) if (!grounds.has(n)) unknown.set(n, unknown.size);
  const sourceRows = new Map<Id, number>();
  for (const c of pieces) {
    if (isSourceLike(c) && !isOpen(c) && nodeOf(c.a) !== nodeOf(c.b)) sourceRows.set(c.id, unknown.size + sourceRows.size);
  }
  const size = unknown.size + sourceRows.size;
  const A = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const rhs = new Array<number>(size).fill(0);
  const at = (node: string) => unknown.get(node);

  for (const c of pieces) {
    const [i, j] = [nodeOf(c.a), nodeOf(c.b)];
    if (isOpen(c) || i === j) continue;
    const [vi, vj] = [at(i), at(j)];
    if (c.kind === "resistor" || c.kind === "lamp") {
      const g = 1 / c.value;
      if (vi !== undefined) A[vi][vi] += g;
      if (vj !== undefined) A[vj][vj] += g;
      if (vi !== undefined && vj !== undefined) {
        A[vi][vj] -= g;
        A[vj][vi] -= g;
      }
      continue;
    }
    // The current leaves node i into the piece and comes out at j.
    const k = sourceRows.get(c.id)!;
    if (vi !== undefined) A[vi][k] += 1;
    if (vj !== undefined) A[vj][k] -= 1;
    if (vj !== undefined) A[k][vj] += 1;
    if (vi !== undefined) A[k][vi] -= 1;
    A[k][k] += c.kind === "source" ? c.internal : 0;
    rhs[k] = c.kind === "source" ? c.value : 0;
  }

  const x = solveLinear(A, rhs);
  if (!x) {
    return {
      ok: false,
      error: "O circuito não tem solução única: há um laço só de geradores ideais, amperímetros e chaves fechadas, ou geradores ideais diferentes em paralelo.",
    };
  }
  const potential = (node: string) => {
    const v = at(node);
    return v === undefined ? 0 : x[v];
  };
  for (const c of pieces) {
    const [i, j] = [nodeOf(c.a), nodeOf(c.b)];
    const voltage = parts.find(i) === parts.find(j) || i === j ? potential(i) - potential(j) : null;
    let current = 0;
    if (fixed.has(c.id)) current = fixed.get(c.id)!;
    else if (!isOpen(c) && i !== j) {
      if (c.kind === "resistor" || c.kind === "lamp") current = (potential(i) - potential(j)) / c.value;
      else current = x[sourceRows.get(c.id)!];
    }
    out.set(c.id, { current: clean(current), voltage: voltage === null ? null : clean(voltage) });
  }
  return { ok: true, pieces: out };
}

/** Rounding noise like 1e-17 reads as zero, so a piece with no current shows none. */
const clean = (v: number) => (Math.abs(v) < 1e-10 ? 0 : v);

/** Gaussian elimination with partial pivoting; null when the system has no single solution. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = A.map((row, i) => [...row, b[i]]);
  const big = Math.max(1, ...A.flat().map(Math.abs));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-11 * big) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

// Drawing

/** The usual name of each kind, numbered when the kind repeats. */
export const COMPONENT_LETTER: Record<ComponentKind, string> = {
  resistor: "R",
  lamp: "L",
  source: "ε",
  switch: "Ch",
  ammeter: "A",
  voltmeter: "V",
  capacitor: "C",
};

/** Units of a piece's value, as written after it. */
const VALUE_UNIT: Partial<Record<ComponentKind, string>> = { resistor: "Ω", lamp: "Ω", source: "V", capacitor: "μF" };

export const hasValue = (kind: ComponentKind) => kind in VALUE_UNIT;

/** What a piece's label says by default: "R₁ = 10 Ω", "ε = 12 V (r = 1 Ω)", or only the name of a meter or switch. */
export function componentText(c: Pick<Component, "kind" | "name" | "value" | "internal">, locale: Locale = "pt-BR"): string {
  const unit = VALUE_UNIT[c.kind];
  if (!unit) return c.name;
  const value = `${formatNumber(c.value, 3, locale)} ${unit}`;
  const named = c.name ? `${c.name} = ${value}` : value;
  return c.kind === "source" && c.internal > 0 ? `${named} (r = ${formatNumber(c.internal, 3, locale)} Ω)` : named;
}

/** A piece laid out on paper: marks in pt (Y up) from the middle of its wire, `mid` in world units. */
export interface PieceDrawing {
  mid: Vec;
  marks: Mark[];
  /** Along the wire from a to b, on paper, Y up. */
  dir: Vec;
  /** Length of the wire on paper, in pt. */
  length: number;
}

/** Turns marks drawn along the x axis into the direction of the wire. */
function turn(marks: Mark[], dir: Vec): Mark[] {
  const n = { x: -dir.y, y: dir.x };
  const T = (p: Vec): Vec => ({ x: p.x * dir.x + p.y * n.x, y: p.x * dir.y + p.y * n.y });
  return marks.map((m): Mark => {
    switch (m.kind) {
      case "line":
        return { ...m, a: T(m.a), b: T(m.b) };
      case "curve":
        return { ...m, points: m.points.map(T) };
      case "text":
      case "dot":
      case "ring":
        return { ...m, at: T(m.at) };
      case "head":
        return { ...m, tip: T(m.tip), dir: T(m.dir) };
      case "box":
        return m;
    }
  });
}

/** Where the piece's wire runs on paper, or null when its ends meet. */
function frame(doc: FigureDoc, c: Component, k: number): { mid: Vec; dir: Vec; length: number } | null {
  const pts = pointMap(doc);
  const [a, b] = [pts.get(c.a), pts.get(c.b)];
  if (!a || !b) return null;
  const u = figureUnits(doc);
  const d = { x: (b.x - a.x) * u.x * k, y: (b.y - a.y) * u.y * k };
  const length = Math.hypot(d.x, d.y);
  if (length < 1e-6) return null;
  return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dir: { x: d.x / length, y: d.y / length }, length };
}

/** The symbol of a piece with its wires to both ends. `k` is pt per cm on paper. */
export function componentDrawing(doc: FigureDoc, c: Component, k: number): PieceDrawing | null {
  const f = frame(doc, c, k);
  if (!f) return null;
  const half = f.length / 2;
  // A short wire takes a smaller symbol, so both wires still show.
  const s = Math.min(c.size, f.length * 0.7);
  const w = c.stroke.width;
  const marks: Mark[] = [];
  const line = (a: Vec, b: Vec, width = w) => marks.push({ kind: "line", a, b, width });
  const leads = (r: number) => {
    line({ x: -half, y: 0 }, { x: -r, y: 0 });
    line({ x: r, y: 0 }, { x: half, y: 0 });
  };
  const circle = (r: number) => marks.push({ kind: "ring", at: { x: 0, y: 0 }, r, width: w });
  switch (c.kind) {
    case "resistor": {
      leads(s / 2);
      if (c.shape === "box") {
        const h = s * 0.2;
        marks.push({ kind: "curve", points: [{ x: -s / 2, y: -h }, { x: s / 2, y: -h }, { x: s / 2, y: h }, { x: -s / 2, y: h }, { x: -s / 2, y: -h }], width: w });
      } else {
        const h = s * 0.2;
        const points: Vec[] = [{ x: -s / 2, y: 0 }];
        for (let i = 0; i < 6; i++) points.push({ x: -s / 2 + ((2 * i + 1) * s) / 12, y: i % 2 === 0 ? h : -h });
        points.push({ x: s / 2, y: 0 });
        marks.push({ kind: "curve", points, width: w });
      }
      break;
    }
    case "lamp": {
      const r = s * 0.34;
      leads(r);
      circle(r);
      const q = r * Math.SQRT1_2;
      line({ x: -q, y: -q }, { x: q, y: q });
      line({ x: -q, y: q }, { x: q, y: -q });
      break;
    }
    case "ammeter":
    case "voltmeter": {
      const r = s * 0.38;
      leads(r);
      circle(r);
      marks.push({ kind: "text", at: { x: 0, y: 0 }, node: { word: c.kind === "ammeter" ? "A" : "V" }, size: r * 1.15 });
      break;
    }
    case "source": {
      // The long thin plate is the positive end, toward b.
      const g = s * 0.12;
      leads(g);
      line({ x: g, y: -s * 0.4 }, { x: g, y: s * 0.4 });
      line({ x: -g, y: -s * 0.2 }, { x: -g, y: s * 0.2 }, w * 2.5);
      break;
    }
    case "capacitor": {
      const g = s * 0.1;
      leads(g);
      line({ x: g, y: -s * 0.34 }, { x: g, y: s * 0.34 });
      line({ x: -g, y: -s * 0.34 }, { x: -g, y: s * 0.34 });
      break;
    }
    case "switch": {
      const e = s * 0.45;
      leads(e);
      const r = Math.max(1, w * 1.4);
      marks.push({ kind: "dot", at: { x: -e, y: 0 }, r, open: true });
      marks.push({ kind: "dot", at: { x: e, y: 0 }, r, open: true });
      const angle = c.closed ? 0 : Math.PI / 6;
      line({ x: -e, y: 0 }, { x: -e + 2 * e * Math.cos(angle) + (c.closed ? -r : 0), y: 2 * e * Math.sin(angle) });
      break;
    }
  }
  return { mid: f.mid, marks: turn(marks, f.dir), dir: f.dir, length: f.length };
}

/** Which side of its wire a piece's label is on: 1 left of a→b, −1 right, as drawn. */
function labelSide(doc: FigureDoc, c: Component, dir: Vec): number {
  const place = labelPlacement(doc, c);
  if (!place) return -1;
  const n = { x: -dir.y, y: dir.x };
  return place.offset.x * n.x + place.offset.y * n.y >= 0 ? 1 : -1;
}

/** Units stay upright, a space after the number; math mode would drop a plain space. */
const unitWord = (u: string): MathNode => (u === "Ω" ? " Ω" : { word: ` ${u}` });

/** A value as a switched-on circuit writes it: "i = 0,5 A", or "i ≈ 0,33 A" when rounded. */
function quantity(symbol: string, value: number, unit: string, decimals: number, locale: Locale): MathNode {
  const factor = 10 ** decimals;
  const exact = Math.abs(value - Math.round(value * factor) / factor) <= 1e-9 * Math.max(1, Math.abs(value));
  const number = formatNumber(value, decimals, locale);
  const head = symbol ? `${symbol} ${exact ? "=" : "≈"} ` : exact ? "" : "≈ ";
  return { row: [`${head}${number}`, unitWord(unit)] };
}

/** What the circuit writes by a piece when it is on. */
function valueLines(c: Component, state: PieceState, circuit: Circuit, locale: Locale): MathNode[] {
  const d = circuit.decimals;
  const i = Math.abs(state.current);
  const u = state.voltage === null ? null : Math.abs(state.voltage);
  switch (c.kind) {
    case "ammeter":
      return [quantity("", i, "A", d, locale)];
    case "voltmeter":
      return [u === null ? "—" : quantity("", u, "V", d, locale)];
    case "capacitor":
      return u === null ? [] : [quantity("Q", c.value * u, "μC", d, locale)];
    case "switch":
      return [];
    case "resistor":
    case "lamp":
    case "source": {
      const out: MathNode[] = [];
      if (circuit.values.current) out.push(quantity("i", i, "A", d, locale));
      if (circuit.values.voltage && u !== null) out.push(quantity("U", u, "V", d, locale));
      if (circuit.values.power && u !== null) out.push(quantity("P", u * i, "W", d, locale));
      // Current running into the positive end: the others force it through, as a receptor.
      if (c.kind === "source" && state.current < -1e-9) out.push({ word: "receptor" });
      return out;
    }
  }
}

interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const overlaps = (a: Rect, b: Rect) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

/** Whether a line from p to q passes through the rectangle (Liang–Barsky). */
function crosses(r: Rect, p: Vec, q: Vec): boolean {
  let [t0, t1] = [0, 1];
  const d = { x: q.x - p.x, y: q.y - p.y };
  const sides: [number, number][] = [
    [-d.x, p.x - r.minX],
    [d.x, r.maxX - p.x],
    [-d.y, p.y - r.minY],
    [d.y, r.maxY - p.y],
  ];
  for (const [den, num] of sides) {
    if (Math.abs(den) < 1e-12) {
      if (num < 0) return false;
      continue;
    }
    const t = num / den;
    if (den < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * The room around a circuit on paper, in pt with Y up: what a block of
 * values must keep off, which are the wires, the symbols, the pieces' labels
 * and the blocks already placed.
 */
class Room {
  private taken: Rect[] = [];
  private wires: [Vec, Vec][] = [];
  private readonly at: (w: Vec) => Vec;

  constructor(private readonly doc: FigureDoc, k: number) {
    const u = figureUnits(doc);
    this.at = (w) => ({ x: w.x * u.x * k, y: w.y * u.y * k });
    const pts = pointMap(doc);
    for (const e of doc.elements) {
      if (e.type !== "segment" && e.type !== "component") continue;
      const [a, b] = [pts.get(e.a), pts.get(e.b)];
      if (a && b) this.wires.push([this.at(a), this.at(b)]);
      if (e.type !== "component") continue;
      const label = this.labelRect(e);
      if (label) this.taken.push(label);
      if (a && b) {
        const m = this.at({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        const r = Math.max(e.size / 2, componentReach(e));
        this.taken.push({ minX: m.x - r, minY: m.y - r, maxX: m.x + r, maxY: m.y + r });
      }
    }
  }

  private labelRect(c: Component): Rect | null {
    const place = labelPlacement(this.doc, c);
    if (!place || !c.label) return null;
    const p = this.at(place.anchor);
    const center = { x: p.x + place.offset.x, y: p.y + place.offset.y };
    const w = estimateTextWidth(labelText(this.doc, c), c.label.size) / 2;
    const h = c.label.size * 0.6;
    return { minX: center.x - w, minY: center.y - h, maxX: center.x + w, maxY: center.y + h };
  }

  private free(r: Rect): boolean {
    const pad = { minX: r.minX - 1, minY: r.minY - 1, maxX: r.maxX + 1, maxY: r.maxY + 1 };
    return !this.taken.some((t) => overlaps(pad, t)) && !this.wires.some(([p, q]) => crosses(pad, p, q));
  }

  /**
   * Where a block of values goes, as its center from the middle of the
   * piece's wire: on the side away from the label, out from the symbol; or
   * farther, or past the label on the other side, when something is there.
   */
  place(c: Component, f: { mid: Vec; dir: Vec }, side: number, beside: number, width: number, height: number): Vec {
    const mid = this.at(f.mid);
    const block = (n: Vec, d: number) => {
      // The block touches its distance at its nearest edge, whichever way the wire runs.
      const toEdge = Math.abs(n.x) * (width / 2) + Math.abs(n.y) * (height / 2);
      const o = scale(n, d + toEdge);
      return { o, rect: { minX: mid.x + o.x - width / 2, minY: mid.y + o.y - height / 2, maxX: mid.x + o.x + width / 2, maxY: mid.y + o.y + height / 2 } };
    };
    const normal = (s: number) => ({ x: -f.dir.y * s, y: f.dir.x * s });
    const label = this.labelRect(c);
    // Past the label: as far along the normal as its farthest corner.
    const pastLabel = (n: Vec) =>
      label ? Math.max(...[label.minX, label.maxX].flatMap((x) => [label.minY, label.maxY].map((y) => (x - mid.x) * n.x + (y - mid.y) * n.y))) + 3 : beside;
    const candidates = [
      ...[0, 4, 8, 14, 22, 32].map((extra) => block(normal(side), beside + extra)),
      ...[0, 6, 14].map((extra) => block(normal(-side), pastLabel(normal(-side)) + extra)),
    ];
    const chosen = candidates.find((cand) => this.free(cand.rect)) ?? candidates[0];
    this.taken.push(chosen.rect);
    // Back in the frame of the marks, which turn() leaves as they are: offsets on paper.
    return { x: chosen.o.x, y: chosen.o.y };
  }
}

/**
 * What a circuit adds to each piece: arrows for the current, and the values
 * when it is on, on the side of the wire away from the piece's label.
 */
export function circuitDrawings(doc: FigureDoc, circuit: Circuit, k: number): PieceDrawing[] {
  if (!circuit.on && circuit.current === "none") return [];
  const solution = solveCircuit(doc);
  if (!solution.ok) return [];
  const locale = doc.locale ?? "pt-BR";
  const out: PieceDrawing[] = [];
  const room = new Room(doc, k);
  for (const c of doc.elements) {
    if (c.type !== "component") continue;
    const state = solution.pieces.get(c.id);
    const f = frame(doc, c, k);
    if (!state || !f) continue;
    const marks: Mark[] = [];
    const side = -labelSide(doc, c, f.dir);
    const reach = componentReach(c) + 3;
    const sx = Math.min(c.size, f.length * 0.7) / 2;
    let beside = reach;
    if (circuit.current !== "none" && Math.abs(state.current) > 1e-9 && c.kind !== "voltmeter" && c.kind !== "capacitor") {
      // The conventional current goes the way of the sign of i; electrons go against it.
      const forward = (state.current > 0) === (circuit.current === "conventional") ? 1 : -1;
      const head = 5;
      const lead = f.length / 2 - sx;
      if (lead >= head * 2.4) {
        const x = -(sx + lead / 2);
        marks.push({ kind: "head", tip: { x: x + (forward * head) / 2, y: 0 }, dir: { x: forward, y: 0 }, length: head });
      } else {
        const y = side * reach;
        const span = Math.max(sx, 8);
        marks.push({ kind: "line", a: { x: -span * forward, y }, b: { x: span * forward - forward * head * 0.8, y }, width: 0.6 });
        marks.push({ kind: "head", tip: { x: span * forward, y }, dir: { x: forward, y: 0 }, length: head });
        beside = reach + 5;
      }
    }
    const lines = circuit.on ? valueLines(c, state, circuit, locale) : [];
    const turned = turn(marks, f.dir);
    if (lines.length > 0) {
      const gap = circuit.size * 1.25;
      const width = Math.max(...lines.map((l) => mathWidth(l, circuit.size)));
      const height = gap * lines.length;
      const center = room.place(c, f, side, beside, width, height);
      lines.forEach((node, i) => {
        turned.push({ kind: "text", at: { x: center.x, y: center.y + height / 2 - gap * (i + 0.5) }, node, size: circuit.size });
      });
    }
    if (turned.length > 0) out.push({ mid: f.mid, marks: turned, dir: f.dir, length: f.length });
  }
  return out;
}
