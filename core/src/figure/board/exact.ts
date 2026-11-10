import { findRoots, parseExpr, type Expr } from "../../plot";
import { formatNumber } from "../labels";
import type { Locale } from "../messages";
import type { MathNode } from "./marks";

/** Exact numbers for the tables on the number line: fractions and square roots, never 0,333. */

export interface Q {
  n: number;
  d: number;
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export function q(n: number, d = 1): Q {
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d) || 1;
  return { n: (sign * n) / g || 0, d: Math.abs(d) / g };
}

export const qAdd = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const qSub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const qMul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
export const qDiv = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
export const qNum = (a: Q) => a.n / a.d;
const qSafe = (a: Q) => Number.isSafeInteger(a.n) && Number.isSafeInteger(a.d);

/** The fraction behind a decimal number, or null when it has no small denominator. */
export function fromNumber(v: number): Q | null {
  if (!Number.isFinite(v)) return null;
  for (let d = 1; d <= 1000; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v - n / d) < 1e-10 && Math.abs(n) < 1e9) return q(n, d);
  }
  return null;
}

const signed = (negative: boolean, node: MathNode): MathNode => (negative ? { row: ["−", node] } : node);

export function qNode(a: Q, locale: Locale = "pt-BR"): MathNode {
  const size = Math.abs(a.n);
  if (a.d === 1) return signed(a.n < 0, String(size));
  // A short exact decimal reads as written, like 2,5.
  if ([2, 4, 5, 8, 10, 20, 25, 50, 100].includes(a.d)) return signed(a.n < 0, formatNumber(size / a.d, 4, locale));
  return signed(a.n < 0, { frac: [String(size), String(a.d)] });
}

/** Polynomials with rational coefficients, lowest power first. */
export type Poly = Q[];

const trim = (p: Poly): Poly => {
  const out = [...p];
  while (out.length > 0 && out[out.length - 1].n === 0) out.pop();
  return out;
};

export const degree = (p: Poly) => trim(p).length - 1;
export const polyEval = (p: Poly, x: number) => p.reduceRight((acc, c) => acc * x + qNum(c), 0);

export function polyAdd(a: Poly, b: Poly, sign = 1): Poly {
  const out: Poly = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    out.push(qAdd(a[i] ?? q(0), qMul(b[i] ?? q(0), q(sign))));
  }
  return trim(out);
}

export function polyMul(a: Poly, b: Poly): Poly {
  if (a.length === 0 || b.length === 0) return [];
  const out: Poly = Array.from({ length: a.length + b.length - 1 }, () => q(0));
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] = qAdd(out[i + j], qMul(x, y)))));
  return trim(out);
}

export const polyConst = (c: Q): Poly => trim([c]);
export const POLY_X: Poly = [q(0), q(1)];

/** The rational function an expression is, or null when it has abs, sqrt, sen or a stray power. */
export function rationalOf(e: Expr): { num: Poly; den: Poly } | null {
  switch (e.kind) {
    case "num": {
      const v = fromNumber(e.value);
      return v ? { num: polyConst(v), den: [q(1)] } : null;
    }
    case "x":
      return { num: POLY_X, den: [q(1)] };
    case "neg": {
      const a = rationalOf(e.arg);
      return a && { num: polyMul(a.num, [q(-1)]), den: a.den };
    }
    case "call":
      return null;
    case "bin": {
      const a = rationalOf(e.a);
      if (!a) return null;
      if (e.op === "^") {
        if (e.b.kind !== "num" || !Number.isInteger(e.b.value) || Math.abs(e.b.value) > 12) return null;
        let num: Poly = [q(1)];
        let den: Poly = [q(1)];
        for (let i = 0; i < Math.abs(e.b.value); i++) {
          num = polyMul(num, a.num);
          den = polyMul(den, a.den);
        }
        return e.b.value < 0 ? { num: den, den: num } : { num, den };
      }
      const b = rationalOf(e.b);
      if (!b) return null;
      if (e.op === "*") return { num: polyMul(a.num, b.num), den: polyMul(a.den, b.den) };
      if (e.op === "/") return b.num.length === 0 ? null : { num: polyMul(a.num, b.den), den: polyMul(a.den, b.num) };
      return { num: polyAdd(polyMul(a.num, b.den), polyMul(b.num, a.den), e.op === "+" ? 1 : -1), den: polyMul(a.den, b.den) };
    }
  }
}

const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const power = (k: number) => String(k).replace(/\d/g, (d) => SUPS[Number(d)]);

/** A polynomial as it is written: 2x² − 3x + 1. */
export function polyNode(p: Poly, locale: Locale = "pt-BR"): MathNode {
  const t = trim(p);
  if (t.length === 0) return "0";
  const row: MathNode[] = [];
  for (let k = t.length - 1; k >= 0; k--) {
    const c = t[k];
    if (c.n === 0) continue;
    const size = q(Math.abs(c.n), c.d);
    const name = k === 0 ? "" : k === 1 ? "x" : `x${power(k)}`;
    const first = row.length === 0;
    row.push(first ? (c.n < 0 ? "−" : "") : c.n < 0 ? " − " : " + ");
    if (k === 0 || size.n !== 1 || size.d !== 1) row.push(qNode(size, locale));
    if (name) row.push(name);
  }
  return { row };
}

/** A real number with how it is written. */
export interface Exact {
  value: number;
  node: MathNode;
}

export interface Root extends Exact {
  multiplicity: number;
}

function divideOut(p: Poly, r: Q): Poly | null {
  const out: Poly = [];
  let carry = q(0);
  for (let i = p.length - 1; i >= 0; i--) {
    const c = qAdd(p[i], qMul(carry, r));
    if (i === 0) return c.n === 0 ? trim(out.reverse()) : null;
    out.push(c);
    carry = c;
  }
  return null;
}

const divisors = (n: number): number[] => {
  const out: number[] = [];
  for (let d = 1; d * d <= n && d < 2e5; d++) {
    if (n % d === 0) out.push(d, n / d);
  }
  return out;
};

function squareFree(n: number): [number, number] {
  let s = 1;
  let m = n;
  for (let f = 2; f * f <= m; f++) {
    while (m % (f * f) === 0) {
      m /= f * f;
      s *= f;
    }
  }
  return [s, m];
}

function quadraticRoots(p: Poly, locale: Locale): Root[] {
  const [c, b, a] = p;
  const disc = qSub(qMul(b, b), qMul(q(4), qMul(a, c)));
  if (disc.n < 0 || !qSafe(disc)) return [];
  const [s, m] = squareFree(disc.n * disc.d);
  // √disc = s√m / d, so the roots are (−b·d ± s√m) / (2a·d).
  const pp = qMul(q(-1), qMul(b, q(disc.d)));
  const rr = qMul(q(2), qMul(a, q(disc.d)));
  const lcm = (pp.d * rr.d) / gcd(pp.d, rr.d);
  let [P, S, R] = [(pp.n * lcm) / pp.d, s * lcm, (rr.n * lcm) / rr.d];
  const g = gcd(gcd(P, S), R) || 1;
  [P, S, R] = [P / g, S / g, R / g];
  if (R < 0) {
    P = -P;
    R = -R;
  }
  const root = (sign: 1 | -1): Root => {
    const radical: MathNode = { row: [S === 1 ? "" : String(S), { sqrt: String(m) }] };
    const top: MathNode =
      P === 0
        ? { row: [sign < 0 ? "−" : "", radical] }
        : { row: [qNode(q(P), locale), sign < 0 ? " − " : " + ", radical] };
    const node: MathNode = R === 1 ? top : { frac: [top, String(R)] };
    return { value: (P + sign * S * Math.sqrt(m)) / R, node, multiplicity: 1 };
  };
  return [root(-1), root(1)].sort((x, y) => x.value - y.value);
}

/** The real roots of a polynomial: rational ones and square roots exactly, higher degrees to two decimals. */
export function polyRoots(input: Poly, locale: Locale = "pt-BR"): Root[] {
  let p = trim(input);
  const roots: Root[] = [];
  const found = (r: Q, multiplicity: number) => roots.push({ value: qNum(r), node: qNode(r, locale), multiplicity });
  const extract = (r: Q) => {
    let k = 0;
    for (let next = divideOut(p, r); next; next = divideOut(p, r)) {
      p = next;
      k++;
      if (p.length === 0) break;
    }
    if (k > 0) found(r, k);
    return k > 0;
  };
  extract(q(0));
  if (p.length > 1) {
    // Rational root theorem, over whole coefficients.
    const scale = p.reduce((acc, c) => (acc * c.d) / gcd(acc, c.d), 1);
    const whole = p.map((c) => (c.n * scale) / c.d);
    if (whole.every((c) => Number.isSafeInteger(c))) {
      const tops = divisors(Math.abs(whole[0]));
      const bottoms = divisors(Math.abs(whole[whole.length - 1]));
      for (const t of new Set(tops)) {
        for (const b of new Set(bottoms)) {
          for (const sign of [1, -1]) {
            if (p.length > 1) extract(q(sign * t, b));
          }
        }
      }
    }
  }
  if (p.length === 3) roots.push(...quadraticRoots(p, locale));
  else if (p.length > 3) {
    const rest = [...p];
    for (const value of findRoots((x) => polyEval(rest, x), [-100, 100])) {
      roots.push({ value, node: formatNumber(value, 2, locale), multiplicity: 1 });
    }
  }
  return roots.sort((a, b) => a.value - b.value);
}

const CONSTANT_NAMES: [RegExp, string][] = [[/pi/gi, "π"]];

/** An end of an interval as typed: 1/2 stays a fraction and √2 a root, instead of becoming decimals. */
export function readExact(text: string, locale: Locale = "pt-BR"): Exact | null {
  const t = text.trim().replace(/−/g, "-");
  const fraction = /^([+-]?)(\d+(?:[.,]\d+)?)(?:\/(\d+(?:[.,]\d+)?))?$/.exec(t);
  if (fraction) {
    const num = fromNumber(Number(fraction[2].replace(",", ".")));
    const den = fraction[3] ? fromNumber(Number(fraction[3].replace(",", "."))) : q(1);
    if (num && den && den.n !== 0) {
      const v = qDiv(num, den);
      const value = fraction[1] === "-" ? q(-v.n, v.d) : v;
      // Written as a fraction, it stays one: 1/2 is not shown as 0,5.
      if (fraction[3] && value.d !== 1) {
        return { value: qNum(value), node: signed(value.n < 0, { frac: [String(Math.abs(value.n)), String(value.d)] }) };
      }
      return { value: qNum(value), node: qNode(value, locale) };
    }
  }
  const root = /^([+-]?)(\d*)\s*(?:√|sqrt|raiz)\s*\(?\s*(\d+)\s*\)?$/i.exec(t);
  if (root) {
    const times = root[2] ? Number(root[2]) : 1;
    const inside = Number(root[3]);
    const negative = root[1] === "-";
    return {
      value: (negative ? -1 : 1) * times * Math.sqrt(inside),
      node: signed(negative, { row: [root[2], { sqrt: String(inside) }] }),
    };
  }
  const parsed = parseExpr(t);
  if (!parsed.ok) return null;
  const value = parsed.fn(0);
  if (!Number.isFinite(value)) return null;
  return { value, node: CONSTANT_NAMES.reduce((s, [re, name]) => s.replace(re, name), t).replace(/-/g, "−") };
}
