import { findRoots, type Expr } from "../../plot";
import { formatNumber } from "../labels";
import type { Locale } from "../messages";
import { fromNumber, qNode, type Exact } from "./exact";
import type { MathNode } from "./marks";

/**
 * Equations and inequalities typed on one line: the relation between the
 * sides, the set where it holds, and how that set is written.
 */

export type Relation = "=" | "<" | "≤" | ">" | "≥";

/** Typed as two keys, as keyboards have no ≤ or ≥. */
const RELATIONS: [RegExp, Relation][] = [
  [/<=|=<|≤/, "≤"],
  [/>=|=>|≥/, "≥"],
  [/</, "<"],
  [/>/, ">"],
  [/=/, "="],
];

/** Writes >= and <= as the signs they stand for. */
export const joinRelationSigns = (text: string) => text.replace(/>=|=>/g, "≥").replace(/<=|=</g, "≤");

/** The two sides and the relation between them, or null without one. A string says what is wrong. */
export function splitRelation(text: string): { lhs: string; rhs: string; rel: Relation } | string | null {
  const t = joinRelationSigns(text);
  const found = RELATIONS.map(([re, rel]) => ({ rel, at: t.search(re) })).filter((f) => f.at >= 0);
  if (found.length === 0) return null;
  const first = found.reduce((a, b) => (b.at < a.at ? b : a));
  const lhs = t.slice(0, first.at);
  const rhs = t.slice(first.at + 1);
  if (/[<>=≤≥]/.test(rhs)) return "Use um só sinal de igual ou de desigualdade.";
  if (lhs.trim() === "" || rhs.trim() === "") return "Falta um dos lados da relação.";
  return { lhs, rhs, rel: first.rel };
}

/** Whether a value of lhs − rhs satisfies the relation. */
export function satisfies(rel: Relation, d: number): boolean {
  const zero = Math.abs(d) < 1e-9;
  switch (rel) {
    case "=":
      return zero;
    case "<":
      return d < 0 && !zero;
    case "≤":
      return d < 0 || zero;
    case ">":
      return d > 0 && !zero;
    case "≥":
      return d > 0 || zero;
  }
}

/** A set of reals made of stretches between breakpoints, which may hold or not at each point and between them. */
export interface PieceSet {
  points: Exact[];
  /** Whether each breakpoint is in the set. */
  at: boolean[];
  /** Whether the stretches before, between and after the breakpoints are, `points.length + 1` of them. */
  between: boolean[];
}

const sortUnique = (values: Exact[]): Exact[] => {
  const out: Exact[] = [];
  for (const v of [...values].sort((a, b) => a.value - b.value)) {
    if (!out.some((o) => Math.abs(o.value - v.value) < 1e-9)) out.push(v);
  }
  return out;
};

/** Test points inside each stretch around sorted breakpoints. */
export function stretchMiddles(points: { value: number }[]): number[] {
  const n = points.length;
  if (n === 0) return [0];
  return [points[0].value - 1, ...points.slice(1).map((p, i) => (points[i].value + p.value) / 2), points[n - 1].value + 1];
}

/** The set where `holds` is true, read at the breakpoints and once inside each stretch between them. */
export function pieceSet(breakpoints: Exact[], holds: (x: number) => boolean): PieceSet {
  const points = sortUnique(breakpoints);
  return { points, at: points.map((p) => holds(p.value)), between: stretchMiddles(points).map(holds) };
}

/** Whether x is in the set. */
export function inPieces(set: PieceSet, x: number): boolean {
  const i = set.points.findIndex((p) => Math.abs(p.value - x) < 1e-9);
  if (i >= 0) return set.at[i];
  const after = set.points.filter((p) => p.value < x).length;
  return set.between[after];
}

/** Only the part of a set from `from` up to `to`, which is left out unless `toClosed`. Null ends are infinite. */
export function clipPieces(set: PieceSet, from: Exact | null, to: Exact | null, toClosed = false): PieceSet {
  const ends = [from, to].filter((e): e is Exact => e !== null);
  const points = sortUnique([...set.points, ...ends]);
  const inside = (x: number) => (from === null || x >= from.value - 1e-9) && (to === null || x < to.value - 1e-9 || (toClosed && x <= to.value + 1e-9));
  return pieceSet(points, (x) => inside(x) && inPieces(set, x));
}

const MINUS = (node: MathNode): MathNode => ({ row: ["−", node] });

type End = { node: MathNode; closed: boolean } | null;

/**
 * The set as maximal intervals and lone points, left to right. It is walked
 * as alternating atoms: the stretch before the first breakpoint, the point,
 * the next stretch, and so on.
 */
function stretches(set: PieceSet): ({ from: End; to: End } | { point: MathNode })[] {
  const n = set.points.length;
  const member = (atom: number) => (atom % 2 === 0 ? set.between[atom / 2] : set.at[(atom - 1) / 2]);
  const out: ({ from: End; to: End } | { point: MathNode })[] = [];
  let atom = 0;
  while (atom <= 2 * n) {
    if (!member(atom)) {
      atom++;
      continue;
    }
    const start = atom;
    while (atom + 1 <= 2 * n && member(atom + 1)) atom++;
    const end = atom;
    atom++;
    if (start === end && start % 2 === 1) {
      out.push({ point: set.points[(start - 1) / 2].node });
      continue;
    }
    const from: End = start % 2 === 1 ? { node: set.points[(start - 1) / 2].node, closed: true } : start === 0 ? null : { node: set.points[start / 2 - 1].node, closed: false };
    const to: End = end % 2 === 1 ? { node: set.points[(end - 1) / 2].node, closed: true } : end === 2 * n ? null : { node: set.points[end / 2].node, closed: false };
    out.push({ from, to });
  }
  return out;
}

/** Written as in Brazilian books, ]−∞; 2] ∪ {3}, or (−∞, 2] ∪ {3} in English. */
export function setNode(set: PieceSet, locale: Locale): MathNode {
  const sep = locale === "en" ? ", " : "; ";
  if (set.between.every(Boolean)) {
    const missing = set.points.filter((_, i) => !set.at[i]);
    if (missing.length === 0) return "ℝ";
    return { row: ["ℝ − {", ...missing.flatMap((p, i) => (i > 0 ? [sep, p.node] : [p.node])), "}"] };
  }
  if (!set.between.some(Boolean) && !set.at.some(Boolean)) return "∅";
  if (!set.between.some(Boolean)) {
    // Only points, as an equation's roots: {1; 3}.
    const points = set.points.filter((_, i) => set.at[i]);
    return { row: ["{", ...points.flatMap((p, i) => (i > 0 ? [sep, p.node] : [p.node])), "}"] };
  }
  const open = locale === "en" ? ["(", ")"] : ["]", "["];
  const parts = stretches(set).map((s): MathNode => {
    if ("point" in s) return { row: ["{", s.point, "}"] };
    const left: MathNode = { delim: s.from?.closed ? "[" : open[0], side: "open" };
    const right: MathNode = { delim: s.to?.closed ? "]" : open[1], side: "close" };
    return { row: [left, s.from === null ? "−∞" : s.from.node, sep, s.to === null ? "+∞" : s.to.node, right] };
  });
  return { row: parts.flatMap((p, i) => (i > 0 ? [" ∪ ", p] : [p])) };
}

const PI_DENOMINATORS = [1, 2, 3, 4, 6, 12];

/** A value found by search, written exactly when it is a simple fraction or a fraction of π. */
export function niceNumber(value: number, locale: Locale): Exact {
  if (Math.abs(value) < 1e-9) return { value: 0, node: "0" };
  const plain = fromNumber(value);
  if (plain && plain.d <= 12) return { value, node: qNode(plain, locale) };
  for (const d of PI_DENOMINATORS) {
    const k = (value / Math.PI) * d;
    const n = Math.round(k);
    if (n !== 0 && Math.abs(k - n) < 1e-7) {
      const g = gcdOf(Math.abs(n), d);
      const [top, bottom] = [Math.abs(n) / g, d / g];
      const word: MathNode = top === 1 ? "π" : `${top}π`;
      const node: MathNode = bottom === 1 ? word : { frac: [word, String(bottom)] };
      return { value, node: n < 0 ? MINUS(node) : node };
    }
  }
  const square = fromNumber(value * value);
  if (square && square.d <= 12 && square.n <= 1000) {
    const whole = Math.round(Math.sqrt(square.n));
    if (whole * whole !== square.n && square.d === 1) {
      const node: MathNode = { sqrt: String(square.n) };
      return { value, node: value < 0 ? MINUS(node) : node };
    }
  }
  return { value, node: formatNumber(value, 2, locale) };
}

const gcdOf = (a: number, b: number): number => (b === 0 ? a : gcdOf(b, a % b));

/** Zeros of a function on an interval, written exactly where they can be. */
export function zerosIn(fn: (x: number) => number, from: number, to: number, locale: Locale): Exact[] {
  return findRoots(fn, [from, to]).map((v) => niceNumber(v, locale));
}

const FUNCTION_WORDS: Record<string, string> = { sin: "sen", cos: "cos", tan: "tg", ln: "ln", log: "log" };

/** Lower binds looser: a sum inside a product needs parentheses. */
const precedence = (e: Expr): number => {
  if (e.kind === "bin") return e.op === "+" || e.op === "-" ? 1 : e.op === "^" ? 3 : 2;
  if (e.kind === "neg") return 1;
  return 4;
};

const wrap = (node: MathNode): MathNode => ({ row: ["(", node, ")"] });

/** An expression as it is written in a book: 2x, sen(x), |x − 1|, x², a fraction. */
export function exprNode(e: Expr, locale: Locale): MathNode {
  const at = (child: Expr, min: number) => (precedence(child) < min ? wrap(exprNode(child, locale)) : exprNode(child, locale));
  switch (e.kind) {
    case "num":
      return niceNumber(e.value, locale).node;
    case "x":
      return "x";
    case "neg":
      return { row: ["−", at(e.arg, 2)] };
    case "call": {
      const inner = exprNode(e.arg, locale);
      if (e.fn === "abs") return { row: ["|", inner, "|"] };
      if (e.fn === "sqrt") return { sqrt: inner };
      if (e.fn === "exp") return { sup: ["e", inner] };
      return { row: [{ word: FUNCTION_WORDS[e.fn] }, wrap(inner)] };
    }
    case "bin": {
      switch (e.op) {
        case "+":
        case "-": {
          const right = e.b.kind === "neg" ? e.b.arg : e.b;
          const minus = (e.op === "-") !== (e.b.kind === "neg");
          return { row: [exprNode(e.a, locale), minus ? " − " : " + ", at(right, minus ? 2 : 1)] };
        }
        case "*": {
          // 2x, 3sen(x), 2(x + 1): a number in front is written against what it multiplies.
          const implicit = e.a.kind === "num" && e.b.kind !== "num";
          return { row: [at(e.a, 2), implicit ? "" : " · ", at(e.b, 2)] };
        }
        case "/":
          return { frac: [exprNode(e.a, locale), exprNode(e.b, locale)] };
        case "^":
          return { sup: [at(e.a, 4), exprNode(e.b, locale)] };
      }
    }
  }
}

/** The sign of a relation, as printed. */
export const relationText = (rel: Relation) => ` ${rel} `;
