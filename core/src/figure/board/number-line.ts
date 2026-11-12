import { compile, findRoots, parseExpr, type Expr } from "../../plot";
import type { Locale } from "../messages";
import type { Vec } from "../vec";
import { degree, polyAdd, polyEval, polyMul, polyNode, polyRoots, q, rationalOf, readExact, type Exact, type Poly, type Q } from "./exact";
import { layoutMath, layoutOf, mathWidth, type Mark, type MarkRole, type MathNode } from "./marks";
import { clipPieces, exprNode, inPieces, niceNumber, pieceSet, satisfies, setNode, splitRelation, stretchMiddles, zerosIn, type PieceSet, type Relation } from "./relation";

/**
 * The schematic number lines: only the order of the critical values matters,
 * so they sit evenly spaced and every chart lines up in columns.
 */

export interface LineContext {
  size: number;
  locale: Locale;
  /** A stretch of a set as a thick line, or as a wavy one. */
  intervals?: "thick" | "wave";
}

const text = (x: number, y: number, node: MathNode, size: number, role?: MarkRole): Mark => ({
  kind: "text",
  at: { x, y },
  node,
  size,
  ...(role ? { role } : {}),
});

const line = (a: Vec, b: Vec, more: { width?: number; dash?: "dashed"; role?: MarkRole } = {}): Mark => ({ kind: "line", a, b, ...more });

const sortUnique = (values: Exact[]): Exact[] => {
  const out: Exact[] = [];
  for (const v of [...values].sort((a, b) => a.value - b.value)) {
    if (!out.some((o) => Math.abs(o.value - v.value) < 1e-9)) out.push(v);
  }
  return out;
};

export interface IntervalEnd extends Exact {
  closed: boolean;
}

export interface VaralInterval {
  from: IntervalEnd | null;
  to: IntervalEnd | null;
}

export type VaralOp = "∪" | "∩" | "−";

export interface VaralSpec {
  terms: VaralInterval[];
  ops: VaralOp[];
}

const inInterval = (t: VaralInterval, x: number) => {
  const after = t.from === null || x > t.from.value + 1e-9 || (t.from.closed && Math.abs(x - t.from.value) < 1e-9);
  const before = t.to === null || x < t.to.value - 1e-9 || (t.to.closed && Math.abs(x - t.to.value) < 1e-9);
  return after && before;
};

/** Operators between intervals. Letters and words are there because keyboards have no ∪ or ∩. */
const VARAL_OPERATORS: [RegExp, VaralOp][] = [
  [/^(?:∪|uni[aã]o|[uU](?!\p{L}))/iu, "∪"],
  [/^(?:∩|interse[cç][aã]o|inter|[nN](?!\p{L}))/iu, "∩"],
  [/^(?:[-−\\∖]|menos)/iu, "−"],
];

const INTERVAL = /^([[\]])([^;[\]]*);([^;[\]]*)([[\]])/;
const INFINITE = /^\s*([+-]?)\s*(?:∞|inf)\s*$/i;

/** One interval as typed, like [1/2; 3[ or ]-∞; 2]. A string says what is wrong. */
function readInterval(m: RegExpExecArray, locale: Locale): VaralInterval | string {
  const [, open, first, second, close] = m;
  const end = (raw: string, closed: boolean): IntervalEnd | null | undefined => {
    if (INFINITE.test(raw)) return null;
    const exact = readExact(raw, locale);
    return exact ? { ...exact, closed } : undefined;
  };
  const from = end(first, open === "[");
  const to = end(second, close === "]");
  if (from === undefined || to === undefined) return "Use números nas pontas do intervalo, como [1/2; 3[.";
  if (from && to && !(from.value < to.value)) return "O início do intervalo precisa ser menor que o fim.";
  return { from, to };
}

/** Reads a chain like [1;3] ∩ ]2;5[. Null when the text isn't one. */
export function readVaral(text: string, locale: Locale): VaralSpec | string | null {
  const terms: VaralInterval[] = [];
  const ops: VaralOp[] = [];
  let rest = text.trim();
  for (;;) {
    const m = INTERVAL.exec(rest);
    if (!m) return terms.length === 0 ? null : "Depois do operador vem outro intervalo, como ]2; 5[.";
    const interval = readInterval(m, locale);
    if (typeof interval === "string") return interval;
    terms.push(interval);
    rest = rest.slice(m[0].length).trim();
    if (rest === "") break;
    const op = VARAL_OPERATORS.flatMap(([re, name]) => {
      const hit = re.exec(rest);
      return hit ? [{ name, length: hit[0].length }] : [];
    })[0];
    if (!op) return "Entre os intervalos, use U para união, n para interseção ou - para diferença.";
    ops.push(op.name);
    rest = rest.slice(op.length).trim();
  }
  return terms.length >= 2 ? { terms, ops } : null;
}

const letter = (i: number) => "ABCDEFGH"[i] ?? `A${i}`;

function columnsOf(count: number, nameWidth: number, gap: number) {
  return { x: (i: number) => nameWidth + (i + 1) * gap, right: nameWidth + (count + 1) * gap };
}

/** A stretch of a set along a line: thick, or a wave that rides on the line. */
function stretch(out: Mark[], x0: number, x1: number, y: number, size: number, style: LineContext["intervals"], role?: MarkRole) {
  const more = role ? { role } : {};
  if (style !== "wave") {
    out.push(line({ x: x0, y }, { x: x1, y }, { width: 2.2, ...more }));
    return;
  }
  const amplitude = size * 0.17;
  const wave = size * 0.6;
  const steps = Math.max(8, Math.ceil(((x1 - x0) / wave) * 12));
  const points: Vec[] = [];
  for (let k = 0; k <= steps; k++) {
    const x = x0 + ((x1 - x0) * k) / steps;
    points.push({ x, y: y + amplitude * Math.sin((2 * Math.PI * (x - x0)) / wave) });
  }
  out.push({ kind: "curve", points, width: 0.9, ...more });
}

interface SetDrawing {
  /** The breakpoints, at their places along the line. */
  criticals: Exact[];
  holds: (x: number) => boolean;
  x: (i: number) => number;
  left: number;
  right: number;
  y: number;
  size: number;
  style?: LineContext["intervals"];
  role?: MarkRole;
  /** Balls at every breakpoint, or only where the set starts or stops. */
  everyBall?: boolean;
}

/** Draws a set on a line: thick or wavy where it holds, with closed and open balls at the ends. */
function drawSet(out: Mark[], s: SetDrawing) {
  const n = s.criticals.length;
  const middles = stretchMiddles(s.criticals);
  const r = s.size * 0.24;
  const more = s.role ? { role: s.role } : {};
  for (let i = 0; i <= n; i++) {
    if (!s.holds(middles[i])) continue;
    stretch(out, i === 0 ? s.left : s.x(i - 1), i === n ? s.right : s.x(i), s.y, s.size, s.style, s.role);
  }
  s.criticals.forEach((c, i) => {
    const here = s.holds(c.value);
    const [before, after] = [s.holds(middles[i]), s.holds(middles[i + 1])];
    // Inside a stretch nothing changes, so there is no end to mark.
    if (!s.everyBall && ((here && before && after) || (!here && !before && !after))) return;
    out.push({ kind: "dot", at: { x: s.x(i), y: s.y }, r, open: !here, ...more });
  });
}

/** The varal: one line per interval, the critical values in columns, the result at the bottom. */
export function varal(spec: VaralSpec, ctx: LineContext): Mark[] {
  const { size } = ctx;
  const criticals = sortUnique(spec.terms.flatMap((t) => [t.from, t.to].filter((e): e is IntervalEnd => e !== null)));
  const preds: ((x: number) => boolean)[] = spec.terms.map((t) => (x: number) => inInterval(t, x));
  const combined = (x: number) => {
    let value = preds[0](x);
    spec.ops.forEach((op, i) => {
      const next = preds[i + 1](x);
      value = op === "∪" ? value || next : op === "∩" ? value && next : value && !next;
    });
    return value;
  };
  const resultName = spec.terms.map((_, i) => letter(i)).reduce((acc, name, i) => `${acc}${spec.ops[i - 1]}${name}`);
  const nameWidth = mathWidth(resultName, size) + size;
  const gap = Math.max(size * 3.4, ...criticals.map((c) => mathWidth(c.node, size) + size));
  const { x, right } = columnsOf(criticals.length, nameWidth, gap);
  const rowH = size * 2.4;
  const rows = spec.terms.length + 1;
  const left = nameWidth;
  const out: Mark[] = [];
  const top = -size * 2;
  criticals.forEach((c, i) => {
    out.push(text(x(i), 0, c.node, size));
    out.push(line({ x: x(i), y: top + size * 0.7 }, { x: x(i), y: top - (rows - 1) * rowH }, { dash: "dashed", width: 0.4 }));
  });
  const drawRow = (i: number, name: MathNode, holds: (x: number) => boolean, role?: MarkRole) => {
    const y = top - i * rowH;
    out.push(text(mathWidth(name, size) / 2, y, name, size));
    out.push(line({ x: left, y }, { x: right, y }, { width: 0.5 }));
    out.push({ kind: "head", tip: { x: right + 6, y }, dir: { x: 1, y: 0 }, length: 6, open: true });
    drawSet(out, { criticals, holds, x, right, left, y, size, style: ctx.intervals, role });
  };
  spec.terms.forEach((_, i) => drawRow(i, letter(i), preds[i]));
  drawRow(rows - 1, resultName, combined, "result");
  return out;
}

/** Where a function is zero or undefined, in order, with its sign to tell them apart. */
interface Critical extends Exact {
  kind: "root" | "pole";
  multiplicity: number;
}

function criticalsOf(expr: Expr, fn: (x: number) => number, locale: Locale): Critical[] {
  const r = rationalOf(expr);
  if (r && r.den.length > 0) {
    const poles = polyRoots(r.den, locale).map((p): Critical => ({ ...p, kind: "pole" }));
    const roots = polyRoots(r.num, locale)
      .filter((root) => !poles.some((p) => Math.abs(p.value - root.value) < 1e-9))
      .map((p): Critical => ({ ...p, kind: "root" }));
    return [...roots, ...poles].sort((a, b) => a.value - b.value);
  }
  return findRoots(fn, [-20, 20]).map((value): Critical => ({ ...niceNumber(value, locale), kind: "root", multiplicity: 1 }));
}

const signAt = (fn: (x: number) => number, x: number): -1 | 0 | 1 | null => {
  const y = fn(x);
  if (!Number.isFinite(y)) return null;
  return y > 1e-12 ? 1 : y < -1e-12 ? -1 : 0;
};

/** A relation typed after the expression: its two sides as one function, lhs − rhs. */
function readSided(source: string): { expr: string; rel: Relation | null } | string {
  const relation = splitRelation(source);
  if (relation === null) return { expr: source, rel: null };
  if (typeof relation === "string") return relation;
  const zero = /^\s*0+(?:[.,]0*)?\s*$/.test(relation.rhs);
  return { expr: zero ? relation.lhs : `(${relation.lhs})-(${relation.rhs})`, rel: relation.rel };
}

/** The set where a function satisfies a relation: never at a pole. */
function solutionOf(fn: (x: number) => number, rel: Relation, breakpoints: Exact[]): PieceSet {
  return pieceSet(breakpoints, (x) => {
    const y = fn(x);
    return Number.isFinite(y) && satisfies(rel, y);
  });
}

/** Writes "S = …" under everything drawn so far. */
function writeSolution(out: Mark[], set: PieceSet, ctx: LineContext, gap = 1.3) {
  const node: MathNode = { row: ["S = ", setNode(set, ctx.locale)] };
  const bottom = layoutOf(out).box.minY;
  out.push(text(mathWidth(node, ctx.size) / 2, bottom - ctx.size * gap, node, ctx.size, "result"));
}

/** How a curve meets the line at a critical value: through a root, touching it, or along an asymptote. */
type Meet = { pole: true } | { pole: false; order: number };

/** Heights are in units of the sketch's arm, distances along the line in gaps. */
const SKETCH = {
  /** Height of a hump between two roots. */
  hump: 0.9,
  /** Where an outer branch ends. */
  end: 1.4,
  /** Curves near an asymptote stop at this height. */
  clip: 1.9,
  /** How fast a curve climbs an asymptote. */
  pole: 0.12,
};

const meetFactor = (m: Meet, d: number) => (m.pole ? d : Math.pow(d, m.order));

/** The hump between two critical values, t from 0 to 1. Both humps at a simple root climb as steeply. */
function between(l: Meet, r: Meet): (t: number) => number {
  const bump = (t: number) => meetFactor(l, t) * meetFactor(r, 1 - t);
  let peak = 0;
  for (let k = 1; k < 50; k++) peak = Math.max(peak, bump(k / 50));
  const n = (l.pole || r.pole ? 0.5 : SKETCH.hump) / peak;
  return (t) =>
    n * bump(t) +
    (l.pole ? (SKETCH.pole * (r.pole ? 1 : meetFactor(r, 1 - t))) / (t + 0.015) : 0) +
    (r.pole ? (SKETCH.pole * (l.pole ? 1 : meetFactor(l, t))) / (1 - t + 0.015) : 0);
}

/**
 * The branch beyond the last critical value, u gaps away from it, and how far
 * it goes. Past a root it leaves at the slope of the hump on the other side,
 * so the curve doesn't bend at the root; past an asymptote it flattens out.
 */
function outside(m: Meet, slope: number): { h: (u: number) => number; length: number } {
  if (m.pole) return { h: (u) => 0.22 + 0.1 / (u + 0.015), length: 0.7 };
  if (m.order === 1) {
    const length = Math.min(0.36, (0.9 * SKETCH.end) / slope);
    return { h: (u) => slope * u + (SKETCH.end - slope * length) * (u / length) ** 2, length };
  }
  return { h: (u) => SKETCH.end * (u / 0.36) ** m.order, length: 0.36 };
}

/** Points of a curve, cut where it climbs past the clip height along an asymptote. */
function clipped(points: { x: number; h: number }[]): { x: number; h: number }[][] {
  const runs: { x: number; h: number }[][] = [];
  let run: { x: number; h: number }[] = [];
  points.forEach((p, i) => {
    const prev = points[i - 1];
    const inside = p.h <= SKETCH.clip;
    if (prev && inside !== prev.h <= SKETCH.clip) {
      const t = (SKETCH.clip - prev.h) / (p.h - prev.h);
      run.push({ x: prev.x + (p.x - prev.x) * t, h: SKETCH.clip });
      if (!inside) {
        runs.push(run);
        run = [];
      }
    }
    if (inside) run.push(p);
  });
  if (run.length > 1) runs.push(run);
  return runs.filter((r) => r.length > 1);
}

/** A sketch of the curve over the line, with the signs. With a relation, the set where it holds. */
export function signSketch(source: string, ctx: LineContext): Mark[] | string {
  const sided = readSided(source);
  if (typeof sided === "string") return sided;
  const parsed = parseExpr(sided.expr);
  if (!parsed.ok) return parsed.error;
  const { size, locale } = ctx;
  const crit = criticalsOf(parsed.expr, parsed.fn, locale);
  const signs = stretchMiddles(crit).map((x) => signAt(parsed.fn, x));
  const r = rationalOf(parsed.expr);
  const isLine = !!r && r.den.length === 1 && degree(r.num) === 1;
  const n = crit.length;
  const gap = Math.max(size * 4.5, ...crit.map((c) => mathWidth(c.node, size) + size * 1.5));
  const outer = gap * 0.8;
  const x = (i: number) => outer + gap * i;
  const right = n === 0 ? outer * 2 + gap : x(n - 1) + outer;
  const arm = size * 2.2;
  const out: Mark[] = [];
  out.push(line({ x: 0, y: 0 }, { x: right, y: 0 }));
  out.push({ kind: "head", tip: { x: right + 6, y: 0 }, dir: { x: 1, y: 0 }, length: 6, open: true });
  out.push(text(right + size * 0.9, -size * 0.6, "x", size));

  const solution = sided.rel ? solutionOf(parsed.fn, sided.rel, crit) : null;
  if (solution) drawSet(out, { criticals: crit, holds: (v) => inPieces(solution, v), x, left: 0, right, y: 0, size, style: ctx.intervals, role: "result", everyBall: true });
  crit.forEach((c, i) => {
    // Beside the root, on the side where the curve is above the line, so it doesn't run through the number.
    const [before, after] = [signs[i], signs[i + 1]];
    const half = mathWidth(c.node, size) / 2 + size * 0.2;
    const across = c.kind === "pole" || before === after ? 0 : (after ?? 0) > 0 ? half : -half;
    const under = before === -1 && after === -1 && c.kind !== "pole" ? size * 1.1 : -size * 1.1;
    const tall = layoutMath(c.node, size).down - size * 0.55;
    out.push(text(x(i) + across, under - Math.max(0, tall) * Math.sign(-under), c.node, size));
    out.push(line({ x: x(i), y: -size * 0.22 }, { x: x(i), y: size * 0.22 }));
    if (c.kind === "pole") out.push(line({ x: x(i), y: -arm * SKETCH.clip }, { x: x(i), y: arm * SKETCH.clip }, { dash: "dashed", width: 0.4 }));
    if (!solution) out.push({ kind: "dot", at: { x: x(i), y: 0 }, r: size * 0.2, open: c.kind === "pole" });
  });

  const curve = (points: { x: number; h: number }[], s: number) => {
    for (const run of clipped(points)) out.push({ kind: "curve", points: run.map((p) => ({ x: p.x, y: s * p.h * arm })), width: 1.1, role: "result" });
  };
  const signLabel = (cx: number, s: number, lift = 0) => out.push(text(cx, s * (lift + size * 0.75), s > 0 ? "+" : "−", size, "result"));

  if (isLine && n === 1) {
    const s = signs[1] === 1 ? 1 : -1;
    out.push(line({ x: x(0) - gap * 0.6, y: -s * arm * 0.8 }, { x: x(0) + gap * 0.6, y: s * arm * 0.8 }, { width: 1.1, role: "result" }));
    signLabel(x(0) - outer * 0.7, -s);
    signLabel(x(0) + outer * 0.7, s);
    if (solution) writeSolution(out, solution, ctx);
    return out;
  }
  if (n === 0) {
    const s = signs[0] ?? 0;
    if (s !== 0) {
      // A polynomial of even degree without roots is a U; anything else, a flat line.
      const even = !!r && r.den.length === 1 && degree(r.num) >= 2 && degree(r.num) % 2 === 0;
      const points = Array.from({ length: 41 }, (_, k) => {
        const t = k / 40;
        return { x: outer * 0.3 + (right - outer * 0.6) * t, h: even ? 0.45 + 0.9 * (2 * t - 1) ** 2 : 0.7 };
      });
      curve(points, s);
      // Under the bottom of the U, which comes down closer to the line than a hump.
      signLabel(right / 2, s, even ? -size * 0.35 : 0);
    }
    if (solution) writeSolution(out, solution, ctx);
    return out;
  }

  const meets: Meet[] = crit.map((c, i) => {
    if (c.kind === "pole") return { pole: true };
    const [before, after] = [signs[i], signs[i + 1]];
    if (before !== null && before === after) return { pole: false, order: 2 };
    return { pole: false, order: c.multiplicity >= 3 ? 3 : 1 };
  });
  const SAMPLES = 80;
  const humps = crit.slice(1).map((_, i) => between(meets[i], meets[i + 1]));
  // The slope each outer branch leaves its root at: the hump's next to it, or a steady one alone.
  const lone = 4 * SKETCH.hump;
  const slopeAt = (hump: ((t: number) => number) | undefined, atStart: boolean) =>
    hump ? Math.abs(atStart ? (hump(0.001) - hump(0)) / 0.001 : (hump(1) - hump(0.999)) / 0.001) : lone;
  for (let i = 0; i <= n; i++) {
    const s = signs[i] ?? 0;
    if (s === 0) continue;
    if (i > 0 && i < n) {
      const hump = humps[i - 1];
      const points = Array.from({ length: SAMPLES + 1 }, (_, k) => ({ x: x(i - 1) + gap * (k / SAMPLES), h: hump(k / SAMPLES) }));
      curve(points, s);
      signLabel((x(i - 1) + x(i)) / 2, s);
      continue;
    }
    const first = i === 0;
    const at = first ? 0 : n - 1;
    const branch = outside(meets[at], slopeAt(first ? humps[0] : humps[humps.length - 1], first));
    const dir = first ? -1 : 1;
    const points = Array.from({ length: SAMPLES + 1 }, (_, k) => {
      const u = branch.length * (k / SAMPLES);
      return { x: x(at) + dir * u * gap, h: branch.h(u) };
    });
    if (first) points.reverse();
    curve(points, s);
    const u = meets[at].pole ? 0.5 : Math.min(branch.length + 0.25, 0.62);
    signLabel(x(at) + dir * u * gap, s, meets[at].pole ? branch.h(u) * arm : 0);
  }
  if (solution) writeSolution(out, solution, ctx);
  return out;
}

interface Factor {
  poly: Poly;
  /** Name in the first column. */
  node: MathNode;
  /** Power; negative when it divides. */
  power: number;
}

const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

function factorsOf(e: Expr, out: Factor[], negative: boolean, locale: Locale): boolean {
  if (e.kind === "bin" && e.op === "*") return factorsOf(e.a, out, negative, locale) && factorsOf(e.b, out, negative, locale);
  if (e.kind === "bin" && e.op === "/") return factorsOf(e.a, out, negative, locale) && factorsOf(e.b, out, !negative, locale);
  if (e.kind === "neg") {
    out.push({ poly: [q(-1)], node: "−1", power: 1 });
    return factorsOf(e.arg, out, negative, locale);
  }
  let base: Expr = e;
  let exponent = 1;
  if (e.kind === "bin" && e.op === "^" && e.b.kind === "num" && Number.isInteger(e.b.value) && e.b.value > 0 && e.b.value <= 12) {
    base = e.a;
    exponent = e.b.value;
  }
  const r = rationalOf(base);
  if (!r || r.den.length !== 1 || qValue(r.den[0]) !== 1) return false;
  const name = polyNode(r.num, locale);
  // A power of a sum needs its parentheses: (x − 1)², not x − 1².
  const terms = r.num.filter((c) => c.n !== 0).length;
  const inside: MathNode = exponent > 1 && terms > 1 ? { row: ["(", name, ")"] } : name;
  out.push({
    poly: r.num,
    node: exponent > 1 ? { row: [inside, String(exponent).replace(/\d/g, (d) => SUPS[Number(d)])] } : inside,
    power: negative ? -exponent : exponent,
  });
  return true;
}

const qValue = (c: Q) => c.n / c.d;

/**
 * The sign chart of a product or quotient: a row per factor and the
 * expression's sign at the bottom, each over an axis; the critical values sit
 * on the first one, the x axis. With a relation, each axis shows where its
 * row satisfies it, the last one the solution.
 */
export function signTable(source: string, ctx: LineContext): Mark[] | string {
  const sided = splitRelation(source);
  if (typeof sided === "string") return sided;
  if (sided && !/^\s*0+(?:[.,]0*)?\s*$/.test(sided.rhs)) return "No quadro de sinais, deixe 0 de um lado, como (x-1)(x+2) ≥ 0.";
  const parsed = parseExpr(sided ? sided.lhs : source);
  if (!parsed.ok) return parsed.error;
  const { size, locale } = ctx;
  const factors: Factor[] = [];
  if (!factorsOf(parsed.expr, factors, false, locale) || factors.length === 0) {
    return "O quadro de sinais usa produtos e quocientes de polinômios, como (x-1)(x+2)/(x-3).";
  }
  const shown = factors.filter((f) => !(f.poly.length === 1 && f.poly[0].n === f.poly[0].d));
  const perFactor = shown.map((f) => polyRoots(f.poly, locale));
  const crit = sortUnique(perFactor.flat());
  const mids = stretchMiddles(crit);
  const solution = sided ? solutionOf(parsed.fn, sided.rel, crit) : null;
  const names: MathNode[] = [...shown.map((f) => f.node), "f(x)"];
  const nameWidth = Math.max(...names.map((n) => mathWidth(n, size))) + size;
  const gap = Math.max(size * 3.4, ...crit.map((c) => mathWidth(c.node, size) + size));
  const x = (i: number) => nameWidth + gap * (i + 1);
  const width = nameWidth + gap * (crit.length + 1);
  const rowH = size * 1.85;
  const rows = shown.length + 1;
  const out: Mark[] = [];
  const factorSign = (f: Factor, at: number) => {
    const v = polyEval(f.poly, at);
    const s = v > 1e-12 ? 1 : v < -1e-12 ? -1 : 0;
    return Math.abs(f.power) % 2 === 0 && s !== 0 ? 1 : s;
  };
  const isZero = (f: Factor, at: number) => Math.abs(polyEval(f.poly, at)) < 1e-9;
  const signNode = (s: number) => (s > 0 ? "+" : "−");
  const constantSign = factors.filter((f) => f.poly.length === 1).reduce((acc, f) => acc * Math.sign(polyEval(f.poly, 0)), 1);

  // Every line under a row is an axis, the one under x too: the values sit on it, and it ends in an arrow.
  const headerY = -rowH * 0.55;
  const lineY = (r: number) => headerY - r * rowH;
  const rowY = (r: number) => headerY - (r + 0.5) * rowH;
  const axis = (y: number, strong: boolean) => {
    out.push(line({ x: 0, y }, { x: width + 4, y }, strong ? {} : { width: 0.5 }));
    out.push({ kind: "head", tip: { x: width + 10, y }, dir: { x: 1, y: 0 }, length: 6, open: true });
  };
  out.push(text(nameWidth / 2, 0, "x", size));
  crit.forEach((c, i) => out.push(text(x(i), Math.max(0, layoutMath(c.node, size).down - size * 0.55), c.node, size)));
  axis(headerY, true);
  for (let r = 1; r <= rows; r++) axis(lineY(r), r >= rows - 1);
  out.push(line({ x: nameWidth, y: rowH * 0.55 }, { x: nameWidth, y: lineY(rows) }));
  const columnCenter = (i: number) => nameWidth + gap * (i + 0.5);
  // Dashed through the rows only where nothing is written on it: a 0 or ∄ would read struck through.
  const rowDash = (i: number, r: number) => out.push(line({ x: x(i), y: lineY(r) }, { x: x(i), y: lineY(r + 1) }, { dash: "dashed", width: 0.4 }));
  crit.forEach((_, i) => out.push(line({ x: x(i), y: headerY - size * 0.2 }, { x: x(i), y: headerY + size * 0.2 }, { width: 0.6 })));

  /** With a relation, each row's axis shows where that row satisfies it, as a varal does. */
  const paint = (r: number, holds: (v: number) => boolean) => {
    if (!sided) return;
    drawSet(out, { criticals: crit, holds, x, left: nameWidth, right: width, y: lineY(r + 1), size, style: ctx.intervals, role: "result" });
  };
  shown.forEach((f, r) => {
    out.push(text(mathWidth(f.node, size) / 2 + size / 2, rowY(r), f.node, size));
    mids.forEach((m, i) => out.push(text(columnCenter(i), rowY(r), signNode(factorSign(f, m)), size, "result")));
    crit.forEach((c, i) => {
      if (!isZero(f, c.value)) {
        rowDash(i, r);
        return;
      }
      out.push(text(x(i), rowY(r), f.power < 0 ? "∄" : "0", size * 0.9, "result"));
    });
    // A factor that divides is never zero in the set: its zero is a hole.
    paint(r, (v) => (isZero(f, v) ? f.power > 0 && satisfies(sided!.rel, 0) : satisfies(sided!.rel, factorSign(f, v))));
  });
  const last = shown.length;
  out.push(text(mathWidth("f(x)", size) / 2 + size / 2, rowY(last), "f(x)", size));
  mids.forEach((m, i) => {
    const s = shown.reduce((acc, f) => acc * factorSign(f, m), constantSign);
    out.push(text(columnCenter(i), rowY(last), signNode(s), size, "result"));
  });
  crit.forEach((c, i) => {
    const zero = shown.filter((f) => isZero(f, c.value));
    if (zero.length === 0) {
      rowDash(i, last);
      return;
    }
    out.push(text(x(i), rowY(last), zero.some((f) => f.power < 0) ? "∄" : "0", size * 0.9, "result"));
  });
  if (solution) {
    paint(last, (v) => inPieces(solution, v));
    writeSolution(out, solution, ctx, 1.1);
  }
  return out;
}

const exprKey = (e: Expr) => JSON.stringify(e);

/** The arguments of every |…| in an expression, each once. */
function modulesIn(e: Expr, out: Expr[]) {
  switch (e.kind) {
    case "call":
      if (e.fn === "abs" && !out.some((m) => exprKey(m) === exprKey(e.arg))) out.push(e.arg);
      modulesIn(e.arg, out);
      return;
    case "neg":
      modulesIn(e.arg, out);
      return;
    case "bin":
      modulesIn(e.a, out);
      modulesIn(e.b, out);
      return;
  }
}

/** The expression with each |m| opened as m or −m, by the sign the column gives it. */
function opened(e: Expr, modules: Expr[], sign: (i: number) => 1 | -1): Expr {
  const again = (x: Expr) => opened(x, modules, sign);
  switch (e.kind) {
    case "call": {
      if (e.fn !== "abs") return { ...e, arg: again(e.arg) };
      const i = modules.findIndex((m) => exprKey(m) === exprKey(e.arg));
      const inner = again(e.arg);
      return sign(i) > 0 ? inner : { kind: "neg", arg: inner };
    }
    case "neg":
      return { kind: "neg", arg: again(e.arg) };
    case "bin":
      return { ...e, a: again(e.a), b: again(e.b) };
    default:
      return e;
  }
}

/** A polynomial, or null when the expression has functions, |…| left or x in a denominator. */
function polynomialOf(e: Expr): Poly | null {
  const r = rationalOf(e);
  if (!r || r.den.length !== 1 || r.den[0].n === 0) return null;
  return polyMul(r.num, [q(r.den[0].d, r.den[0].n)]);
}

const usesTrig = (e: Expr): boolean =>
  e.kind === "call" ? ["sin", "cos", "tan"].includes(e.fn) || usesTrig(e.arg) : e.kind === "neg" ? usesTrig(e.arg) : e.kind === "bin" ? usesTrig(e.a) || usesTrig(e.b) : false;

/** "… em [0; 2pi]" at the end: where to look, for equations that repeat forever, like with sen. */
function readDomain(source: string, locale: Locale): { text: string; domain: [Exact, Exact] | null } | string {
  const m = /\s+(?:em|in|para x em|x ∈|x em)\s*(\[[^\]]*\]|\][^[]*\[|\[[^[]*\[|\][^\]]*\])\s*$/i.exec(source);
  if (!m) return { text: source, domain: null };
  const interval = INTERVAL.exec(m[1]);
  if (!interval) return "Escreva o intervalo assim: em [0; 2pi].";
  const read = readInterval(interval, locale);
  if (typeof read === "string") return read;
  if (!read.from || !read.to) return "Use um intervalo com começo e fim, como [0; 2pi].";
  return { text: source.slice(0, m.index), domain: [read.from, read.to] };
}

const REAL_LINE = 1e6;

/**
 * Equations and inequalities with modules in columns: each module opened
 * over the stretch of the line where its sign is known, of any degree and
 * with functions like sen, and the set that solves it at the end.
 */
export function modulusTable(source: string, ctx: LineContext): Mark[] | string {
  const { size, locale } = ctx;
  const withDomain = readDomain(source, locale);
  if (typeof withDomain === "string") return withDomain;
  const relation = splitRelation(withDomain.text);
  if (relation === null) return "Escreva uma equação ou inequação, como |x-1| + |x+2| = 5 ou |x-2| < 3.";
  if (typeof relation === "string") return relation;
  const [lhs, rhs] = [parseExpr(relation.lhs), parseExpr(relation.rhs)];
  if (!lhs.ok) return lhs.error;
  if (!rhs.ok) return rhs.error;
  const rel = relation.rel;
  const modules: Expr[] = [];
  modulesIn(lhs.expr, modules);
  modulesIn(rhs.expr, modules);
  if (modules.length === 0) return "Use ao menos um módulo, como |x-1|.";
  if (modules.length > 4) return "Use até 4 módulos diferentes.";

  const polys = modules.map(polynomialOf);
  const exact = polys.every((p) => p !== null) && polynomialOf(opened(lhs.expr, modules, () => 1)) !== null && polynomialOf(opened(rhs.expr, modules, () => 1)) !== null;
  const trig = usesTrig(lhs.expr) || usesTrig(rhs.expr);
  // Equations that repeat forever, like with sen, are solved over one stretch.
  const domain: [Exact, Exact] | null =
    withDomain.domain ?? (exact ? null : trig ? [{ value: 0, node: "0" }, { value: 2 * Math.PI, node: "2π" }] : [{ value: -10, node: "−10" }, { value: 10, node: "10" }]);
  const [from, to] = domain ? [domain[0].value, domain[1].value] : [-REAL_LINE, REAL_LINE];
  const within = (v: number) => v > from + 1e-9 && v < to - 1e-9;
  const searchFrom = domain ? from : -100;
  const searchTo = domain ? to : 100;

  const crit = sortUnique(
    modules.flatMap((m, i) => {
      const p = polys[i];
      return p ? polyRoots(p, locale) : zerosIn(compile(m), searchFrom, searchTo, locale);
    }),
  ).filter((c) => within(c.value));
  if (crit.length > 8) return "O módulo muda de sinal vezes demais aqui: escolha um intervalo menor, como em [0; 2pi].";
  const borders: (Exact | null)[] = [domain ? domain[0] : null, ...crit, domain ? domain[1] : null];
  const columnCount = crit.length + 1;
  const middle = (c: number) => {
    const lo = borders[c]?.value ?? (borders[c + 1]?.value ?? 0) - 2;
    const hi = borders[c + 1]?.value ?? lo + 4;
    return (lo + hi) / 2;
  };
  const columns = Array.from({ length: columnCount }, (_, c) => {
    const m = middle(c);
    const sign = (i: number): 1 | -1 => (compile(modules[i])(m) >= 0 ? 1 : -1);
    const left = opened(lhs.expr, modules, sign);
    const right = opened(rhs.expr, modules, sign);
    return { sign, left, right, difference: compile({ kind: "bin", op: "-", a: left, b: right }) };
  });

  const written = (e: Expr): MathNode => {
    const p = exact ? polynomialOf(e) : null;
    return p ? polyNode(p, locale) : exprNode(e, locale);
  };
  const absNode = (m: Expr): MathNode => ({ row: ["|", written(m), "|"] });
  const moduleCells = modules.map((m, i) => columns.map((col) => written(col.sign(i) > 0 ? m : { kind: "neg", arg: m })));
  const relationRow = columns.map((col): MathNode => ({ row: [written(col.left), ` ${rel} `, written(col.right)] }));

  // The zeros of each opened equation; those in their own column solve the original one.
  const inColumn = (c: number, v: number) => {
    const lo = borders[c]?.value ?? -Infinity;
    const hi = borders[c + 1]?.value ?? Infinity;
    return v >= lo - 1e-9 && (v < hi - 1e-9 || (c === columnCount - 1 && v <= hi + 1e-9));
  };
  const zerosOf = columns.map((col): Exact[] | "all" => {
    if (exact) {
      const d = polyAdd(polynomialOf(col.left)!, polynomialOf(col.right)!, -1);
      if (degree(d) < 0) return "all";
      return degree(d) === 0 ? [] : polyRoots(d, locale);
    }
    return zerosIn(col.difference, searchFrom, searchTo, locale);
  });
  const solved = zerosOf.flatMap((z, c) => (z === "all" ? [] : z.filter((v) => inColumn(c, v.value))));
  const original = (v: number) => compile(lhs.expr)(v) - compile(rhs.expr)(v);
  const ends = domain ? [domain[0], domain[1]] : [];
  const solutionSet = pieceSet([...solved, ...crit, ...ends], (v) => {
    if (v < from - 1e-9 || v > to + 1e-9) return false;
    const d = original(v);
    return Number.isFinite(d) && satisfies(rel, d);
  });

  const outcomes = columns.map((_, c): MathNode => {
    const zeros = zerosOf[c];
    if (rel === "=") {
      if (zeros === "all") return { row: [{ word: locale === "en" ? "whole interval" : "todo o intervalo" }] };
      if (zeros.length === 0) return "∅";
      const listed = zeros.slice(0, 4);
      const parts: MathNode[] = [];
      listed.forEach((root, i) => {
        if (i > 0) parts.push("; ");
        parts.push({ row: ["x = ", root.node, inColumn(c, root.value) ? "" : " ∉"] });
      });
      if (zeros.length > listed.length) parts.push(" …");
      return { row: parts };
    }
    return setNode(clipPieces(solutionSet, borders[c], borders[c + 1], c === columnCount - 1), locale);
  });

  const headers = columns.map((_, c): MathNode => {
    const lo = borders[c];
    const hi = borders[c + 1];
    const lastColumn = c === columnCount - 1;
    if (!lo && !hi) return "ℝ";
    if (!lo) return { row: ["x < ", hi!.node] };
    if (!hi) return { row: ["x ≥ ", lo.node] };
    return { row: [lo.node, " ≤ x ", lastColumn ? "≤ " : "< ", hi.node] };
  });
  const firstNames: MathNode[] = [
    ...modules.map(absNode),
    { word: rel === "=" ? (locale === "en" ? "Equation" : "Equação") : locale === "en" ? "Inequality" : "Inequação" },
    { word: locale === "en" ? "Solution" : "Solução" },
  ];
  const nameWidth = Math.max(...firstNames.map((n) => mathWidth(n, size))) + size;
  const everyCell: MathNode[] = [...headers, ...moduleCells.flat(), ...relationRow, ...outcomes];
  const gap = Math.max(size * 5, ...everyCell.map((n) => mathWidth(n, size) + size));
  const x = (c: number) => nameWidth + gap * c;
  const center = (c: number) => x(c) + gap / 2;
  const width = x(columnCount);
  const rowH = size * 2.05;
  const rows = firstNames.length;
  const out: Mark[] = [];

  // The line along the top, the critical values at the column borders.
  const axis = rowH * 0.1;
  out.push(line({ x: nameWidth, y: axis }, { x: width, y: axis }));
  out.push({ kind: "head", tip: { x: width + 6, y: axis }, dir: { x: 1, y: 0 }, length: 6, open: true });
  borders.forEach((b, i) => {
    if (!b) return;
    out.push(text(x(i), axis + size * 0.95, b.node, size));
    if (i > 0 && i < borders.length - 1) out.push(line({ x: x(i), y: axis + size * 0.2 }, { x: x(i), y: -(rows + 1) * rowH }, { dash: "dashed", width: 0.4 }));
  });
  headers.forEach((h, c) => out.push(text(center(c), -rowH * 0.5, h, size * 0.9)));
  const rowY = (r: number) => -(r + 1.5) * rowH;
  for (let r = 0; r <= rows; r++) {
    const y = -(r + 1) * rowH;
    out.push(line({ x: 0, y }, { x: width, y }, r === 0 || r === rows ? {} : { width: 0.4 }));
  }
  out.push(line({ x: nameWidth, y: -rowH }, { x: nameWidth, y: -(rows + 1) * rowH }));
  firstNames.forEach((n, r) => out.push(text(mathWidth(n, size) / 2 + size / 2, rowY(r), n, size)));
  moduleCells.forEach((cells, r) => cells.forEach((cell, c) => out.push(text(center(c), rowY(r), cell, size, "result"))));
  relationRow.forEach((e, c) => out.push(text(center(c), rowY(modules.length), e, size, "result")));
  outcomes.forEach((o, c) => out.push(text(center(c), rowY(modules.length + 1), o, size, "result")));

  if (rel !== "=") {
    // The set on its own line, its ends evenly spaced like the other charts.
    const changes = solutionSet.points.filter((_, i) => {
      const mids = stretchMiddles(solutionSet.points);
      return !(solutionSet.at[i] === inPieces(solutionSet, mids[i]) && solutionSet.at[i] === inPieces(solutionSet, mids[i + 1]));
    });
    const y = -(rows + 2.6) * rowH;
    const step = Math.max(size * 4, ...changes.map((c) => mathWidth(c.node, size) + size));
    const lineLeft = nameWidth;
    const px = (i: number) => lineLeft + step * (i + 1);
    const lineRight = px(changes.length - 1) + step;
    out.push(text(mathWidth("S", size) / 2 + size / 2, y, "S", size));
    out.push(line({ x: lineLeft, y }, { x: lineRight, y }, { width: 0.5 }));
    out.push({ kind: "head", tip: { x: lineRight + 6, y }, dir: { x: 1, y: 0 }, length: 6, open: true });
    changes.forEach((c, i) => out.push(text(px(i), y + size * 1.1, c.node, size, "result")));
    drawSet(out, { criticals: changes, holds: (v) => inPieces(solutionSet, v), x: px, left: lineLeft, right: lineRight, y, size, style: ctx.intervals, role: "result" });
  }
  writeSolution(out, solutionSet, ctx, rel === "=" ? 1.4 : 1.3);
  return out;
}

