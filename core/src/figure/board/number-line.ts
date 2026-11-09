import { findRoots, parseExpr, type Expr } from "../../plot";
import { formatNumber } from "../labels";
import type { Locale } from "../messages";
import type { Vec } from "../vec";
import { degree, polyAdd, polyConst, polyEval, polyMul, polyNode, polyRoots, q, rationalOf, readExact, type Exact, type Poly, type Q, POLY_X, fromNumber } from "./exact";
import { layoutMath, mathWidth, type Mark, type MarkRole, type MathNode } from "./marks";

/**
 * The schematic number lines: only the order of the critical values matters,
 * so they sit evenly spaced and every chart lines up in columns.
 */

export interface LineContext {
  size: number;
  locale: Locale;
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

/** Reads a chain like [1;3] ∩ ]2;5[. Null when the text isn't one. */
export function readVaral(text: string, locale: Locale): VaralSpec | string | null {
  const terms: VaralInterval[] = [];
  const ops: VaralOp[] = [];
  let rest = text.trim();
  const INTERVAL = /^([[\]])([^;[\]]*);([^;[\]]*)([[\]])/;
  const INFINITE = /^\s*([+-]?)\s*(?:∞|inf)\s*$/i;
  for (;;) {
    const m = INTERVAL.exec(rest);
    if (!m) return terms.length === 0 ? null : "Depois do operador vem outro intervalo, como ]2; 5[.";
    const [whole, open, first, second, close] = m;
    const end = (raw: string, closed: boolean): IntervalEnd | null | undefined => {
      if (INFINITE.test(raw)) return null;
      const exact = readExact(raw, locale);
      return exact ? { ...exact, closed } : undefined;
    };
    const from = end(first, open === "[");
    const to = end(second, close === "]");
    if (from === undefined || to === undefined) return "Use números nas pontas do intervalo, como [1/2; 3[.";
    if (from && to && !(from.value < to.value)) return "O início do intervalo precisa ser menor que o fim.";
    terms.push({ from, to });
    rest = rest.slice(whole.length).trim();
    if (rest === "") break;
    const op = rest[0];
    if (op !== "∪" && op !== "∩" && !"-−\\∖".includes(op)) return "Entre os intervalos, use ∪, ∩ ou −.";
    ops.push(op === "∪" || op === "∩" ? op : "−");
    rest = rest.slice(1).trim();
  }
  return terms.length >= 2 ? { terms, ops } : null;
}

const letter = (i: number) => "ABCDEFGH"[i] ?? `A${i}`;

function columnsOf(count: number, nameWidth: number, gap: number) {
  return { x: (i: number) => nameWidth + (i + 1) * gap, right: nameWidth + (count + 1) * gap };
}

/** Draws one row's set: thick where it holds, with closed and open balls at the ends. */
function drawSet(out: Mark[], criticals: Exact[], holds: (x: number) => boolean, x: (i: number) => number, right: number, left: number, y: number, size: number, role?: MarkRole) {
  const n = criticals.length;
  const middle = (i: number) => {
    if (n === 0) return 0;
    if (i === 0) return criticals[0].value - 1;
    if (i === n) return criticals[n - 1].value + 1;
    return (criticals[i - 1].value + criticals[i].value) / 2;
  };
  const r = size * 0.24;
  const thick = 2.2;
  for (let i = 0; i <= n; i++) {
    if (!holds(middle(i))) continue;
    out.push(line({ x: i === 0 ? left : x(i - 1), y }, { x: i === n ? right : x(i), y }, { width: thick, ...(role ? { role } : {}) }));
  }
  criticals.forEach((c, i) => {
    const here = holds(c.value);
    const [before, after] = [holds(middle(i)), holds(middle(i + 1))];
    // Inside a stretch nothing changes, so there is no end to mark.
    if ((here && before && after) || (!here && !before && !after)) return;
    out.push({ kind: "dot", at: { x: x(i), y }, r, open: !here, ...(role ? { role } : {}) });
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
    out.push({ kind: "head", tip: { x: right + 6, y }, dir: { x: 1, y: 0 }, length: 6 });
    drawSet(out, criticals, holds, x, right, left, y, size, role);
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
  return findRoots(fn, [-20, 20]).map((value): Critical => ({ value, node: formatNumber(value, 2, locale), kind: "root", multiplicity: 1 }));
}

const signAt = (fn: (x: number) => number, x: number): -1 | 0 | 1 | null => {
  const y = fn(x);
  if (!Number.isFinite(y)) return null;
  return y > 1e-12 ? 1 : y < -1e-12 ? -1 : 0;
};

function midpoints(criticals: Exact[]): number[] {
  const n = criticals.length;
  if (n === 0) return [0];
  return [
    criticals[0].value - 1,
    ...criticals.slice(1).map((c, i) => (criticals[i].value + c.value) / 2),
    criticals[n - 1].value + 1,
  ];
}

/** A sketch of the curve over the line, with the signs. */
export function signSketch(source: string, ctx: LineContext): Mark[] | string {
  const parsed = parseExpr(source);
  if (!parsed.ok) return parsed.error;
  const { size, locale } = ctx;
  const crit = criticalsOf(parsed.expr, parsed.fn, locale);
  const signs = midpoints(crit).map((x) => signAt(parsed.fn, x));
  const r = rationalOf(parsed.expr);
  const isLine = !!r && r.den.length === 1 && degree(r.num) === 1;
  const gap = Math.max(size * 4.5, ...crit.map((c) => mathWidth(c.node, size) + size * 1.5));
  const left = size * 0.6;
  const x = (i: number) => left + gap * (i + 1);
  const right = x(crit.length) + gap * 0.1;
  const arm = size * 2.2;
  const end = right - size * 0.6;
  const out: Mark[] = [];
  out.push(line({ x: 0, y: 0 }, { x: right, y: 0 }));
  out.push({ kind: "head", tip: { x: right + 6, y: 0 }, dir: { x: 1, y: 0 }, length: 6 });
  out.push(text(right + size * 0.9, -size * 0.6, "x", size));
  crit.forEach((c, i) => {
    // Beside the root, on the side where the curve is above the line, so it doesn't run through the number.
    const [before, after] = [signs[i], signs[i + 1]];
    const half = mathWidth(c.node, size) / 2 + size * 0.2;
    const across = c.kind === "pole" || before === after ? 0 : (after ?? 0) > 0 ? half : -half;
    const under = before === -1 && after === -1 && c.kind !== "pole" ? size * 1.1 : -size * 1.1;
    const tall = layoutMath(c.node, size).down - size * 0.55;
    out.push(text(x(i) + across, under - Math.max(0, tall) * Math.sign(-under), c.node, size));
    out.push(line({ x: x(i), y: -size * 0.22 }, { x: x(i), y: size * 0.22 }));
    if (c.kind === "pole") out.push(line({ x: x(i), y: -arm }, { x: x(i), y: arm }, { dash: "dashed", width: 0.4 }));
    out.push({ kind: "dot", at: { x: x(i), y: 0 }, r: size * 0.2, open: c.kind === "pole" });
  });

  if (isLine && crit.length === 1) {
    const s = signs[1] === 1 ? 1 : -1;
    out.push(line({ x: x(0) - gap * 0.8, y: (-s * arm) * 0.8 }, { x: x(0) + gap * 0.8, y: (s * arm) * 0.8 }, { width: 1.1, role: "result" }));
  } else {
    const samples = 28;
    const pieces = crit.length + 1;
    for (let i = 0; i < pieces; i++) {
      const s = signs[i] ?? 0;
      if (s === 0) continue;
      const first = i === 0;
      const last = i === pieces - 1;
      const x0 = first ? left : x(i - 1);
      const x1 = last ? end : x(i);
      const nearPole = (j: number) => crit[j]?.kind === "pole";
      const points: Vec[] = [];
      for (let k = 0; k <= samples; k++) {
        const t = k / samples;
        let h: number;
        if (crit.length === 0) h = 0.7;
        else if (first) h = nearPole(0) ? 0.22 + 1.45 * Math.pow(t, 5) : 1.15 * Math.pow(1 - t, 1.3);
        else if (last) h = nearPole(crit.length - 1) ? 0.22 + 1.45 * Math.pow(1 - t, 5) : 1.15 * Math.pow(t, 1.3);
        else {
          const [lp, rp] = [nearPole(i - 1), nearPole(i)];
          h = lp || rp ? 0.35 + (lp ? 1.25 * Math.pow(1 - t, 6) : 0) + (rp ? 1.25 * Math.pow(t, 6) : 0) : Math.sin(Math.PI * t) * 0.9;
        }
        points.push({ x: x0 + (x1 - x0) * t, y: s * h * arm });
      }
      out.push({ kind: "curve", points, width: 1.1, role: "result" });
    }
  }
  signs.forEach((s, i) => {
    if (s === null || s === 0) return;
    // On an outer stretch, out where the curve has already left the line and the sign fits under it.
    const cx = crit.length === 0 ? (left + end) / 2 : i === 0 ? left + (x(0) - left) * 0.3 : i === crit.length ? end - (end - x(crit.length - 1)) * 0.3 : (x(i - 1) + x(i)) / 2;
    out.push(text(cx, s * size * 0.75, s > 0 ? "+" : "−", size, "result"));
  });
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
  const inside: MathNode = base.kind === "bin" && exponent > 1 && r.num.length > 2 ? { row: ["(", name, ")"] } : name;
  out.push({
    poly: r.num,
    node: exponent > 1 ? { row: [inside, String(exponent).replace(/\d/g, (d) => SUPS[Number(d)])] } : inside,
    power: negative ? -exponent : exponent,
  });
  return true;
}

const qValue = (c: Q) => c.n / c.d;

/** The sign chart of a product or quotient: a row per factor, and the expression's sign at the bottom. */
export function signTable(source: string, ctx: LineContext): Mark[] | string {
  const parsed = parseExpr(source);
  if (!parsed.ok) return parsed.error;
  const { size, locale } = ctx;
  const factors: Factor[] = [];
  if (!factorsOf(parsed.expr, factors, false, locale) || factors.length === 0) {
    return "O quadro de sinais usa produtos e quocientes de polinômios, como (x-1)(x+2)/(x-3).";
  }
  const shown = factors.filter((f) => !(f.poly.length === 1 && f.poly[0].n === f.poly[0].d));
  const perFactor = shown.map((f) => polyRoots(f.poly, locale));
  const crit = sortUnique(perFactor.flat());
  const mids = midpoints(crit);
  const names: MathNode[] = [...shown.map((f) => f.node), "f(x)"];
  const nameWidth = Math.max(...names.map((n) => mathWidth(n, size))) + size;
  const gap = Math.max(size * 3.4, ...crit.map((c) => mathWidth(c.node, size) + size));
  const x = (i: number) => nameWidth + gap * (i + 1);
  const width = nameWidth + gap * (crit.length + 1);
  const rowH = size * 1.85;
  const rows = shown.length + 1;
  const out: Mark[] = [];
  out.push(text(nameWidth / 2, 0, "x", size));
  crit.forEach((c, i) => out.push(text(x(i), 0, c.node, size)));
  const headerY = -rowH * 0.55;
  out.push(line({ x: 0, y: headerY }, { x: width, y: headerY }));
  out.push(line({ x: nameWidth, y: rowH * 0.55 }, { x: nameWidth, y: headerY - rows * rowH }));
  const rowY = (r: number) => headerY - (r + 0.5) * rowH;
  for (let r = 1; r < rows; r++) {
    const y = headerY - r * rowH;
    out.push(line({ x: 0, y }, { x: width, y }, r === rows - 1 ? {} : { width: 0.4 }));
  }
  out.push(line({ x: 0, y: headerY - rows * rowH }, { x: width, y: headerY - rows * rowH }));
  const columnCenter = (i: number) => nameWidth + gap * (i + 0.5);
  // Dashed through the rows only where nothing is written on it: a 0 or ∄ would read struck through.
  const rowDash = (i: number, r: number) =>
    out.push(line({ x: x(i), y: headerY - r * rowH }, { x: x(i), y: headerY - (r + 1) * rowH }, { dash: "dashed", width: 0.4 }));
  const factorSign = (f: Factor, at: number) => {
    const v = polyEval(f.poly, at);
    const s = v > 1e-12 ? 1 : v < -1e-12 ? -1 : 0;
    return Math.abs(f.power) % 2 === 0 && s !== 0 ? 1 : s;
  };
  const signNode = (s: number) => (s > 0 ? "+" : "−");
  const constantSign = factors.filter((f) => f.poly.length === 1).reduce((acc, f) => acc * Math.sign(polyEval(f.poly, 0)), 1);
  shown.forEach((f, r) => {
    out.push(text(mathWidth(f.node, size) / 2 + size / 2, rowY(r), f.node, size));
    mids.forEach((m, i) => out.push(text(columnCenter(i), rowY(r), signNode(factorSign(f, m)), size, "result")));
    crit.forEach((c, i) => {
      if (Math.abs(polyEval(f.poly, c.value)) > 1e-9) {
        rowDash(i, r);
        return;
      }
      out.push(text(x(i), rowY(r), f.power < 0 ? "∄" : "0", size * 0.9, "result"));
    });
  });
  const last = rows - 1;
  out.push(text(mathWidth("f(x)", size) / 2 + size / 2, rowY(last), "f(x)", size));
  mids.forEach((m, i) => {
    const s = shown.reduce((acc, f) => acc * factorSign(f, m), constantSign);
    out.push(text(columnCenter(i), rowY(last), signNode(s), size, "result"));
  });
  crit.forEach((c, i) => {
    const zero = shown.filter((f) => Math.abs(polyEval(f.poly, c.value)) < 1e-9);
    if (zero.length === 0) return;
    out.push(text(x(i), rowY(last), zero.some((f) => f.power < 0) ? "∄" : "0", size * 0.9, "result"));
  });
  return out;
}

/** A sum of terms with |…|, as a polynomial once each module is opened with the signs of a column. */
function openModules(e: Expr, modules: Poly[], sign: (i: number) => 1 | -1): Poly | null {
  const again = (x: Expr) => openModules(x, modules, sign);
  switch (e.kind) {
    case "num": {
      const v = fromNumber(e.value);
      return v ? polyConst(v) : null;
    }
    case "x":
      return POLY_X;
    case "neg": {
      const a = again(e.arg);
      return a && polyMul(a, [q(-1)]);
    }
    case "call": {
      if (e.fn !== "abs") return null;
      const inner = rationalOf(e.arg);
      if (!inner || inner.den.length !== 1) return null;
      const key = polyKey(inner.num);
      const i = modules.findIndex((m) => polyKey(m) === key);
      return i < 0 ? null : polyMul(inner.num, [q(sign(i))]);
    }
    case "bin": {
      if (e.op === "/" || e.op === "^") {
        const r = rationalOf(e);
        return r && r.den.length === 1 ? r.num : null;
      }
      const [a, b] = [again(e.a), again(e.b)];
      if (!a || !b) return null;
      return e.op === "*" ? polyMul(a, b) : polyAdd(a, b, e.op === "+" ? 1 : -1);
    }
  }
}

const polyKey = (p: Poly) => p.map((c) => `${c.n}/${c.d}`).join(",");

function modulesOf(e: Expr, out: Poly[]): boolean {
  switch (e.kind) {
    case "call": {
      if (e.fn !== "abs") return false;
      const r = rationalOf(e.arg);
      if (!r || r.den.length !== 1 || degree(r.num) !== 1) return false;
      if (!out.some((m) => polyKey(m) === polyKey(r.num))) out.push(r.num);
      return true;
    }
    case "neg":
      return modulesOf(e.arg, out);
    case "bin":
      return modulesOf(e.a, out) && modulesOf(e.b, out);
    default:
      return true;
  }
}

/** Equations with modules in columns: each module opened over the stretch of the line it holds on. */
export function modulusTable(source: string, ctx: LineContext): Mark[] | string {
  const { size, locale } = ctx;
  const sides = source.split("=");
  if (sides.length !== 2) return "Escreva uma equação com um sinal de igual, como |x-1| + |x+2| = 5.";
  const [lhs, rhs] = sides.map((s) => parseExpr(s));
  if (!lhs.ok) return lhs.error;
  if (!rhs.ok) return rhs.error;
  const modules: Poly[] = [];
  if (!modulesOf(lhs.expr, modules) || !modulesOf(rhs.expr, modules) || modules.length === 0) {
    return "Use módulos de expressões do 1º grau, como |x-1| ou |2x+3|.";
  }
  const roots = modules.map((m) => polyRoots(m, locale)[0]);
  const crit = sortUnique(roots);
  const mids = midpoints(crit);
  const signsAt = (m: number) => (i: number): 1 | -1 => (polyEval(modules[i], m) >= 0 ? 1 : -1);

  // One row per module, then the equation opened in each column.
  const columnsData = mids.map((m) => {
    const sign = signsAt(m);
    const left = openModules(lhs.expr, modules, sign);
    const right = openModules(rhs.expr, modules, sign);
    return { sign, left, right };
  });
  if (columnsData.some((c) => !c.left || !c.right)) return "Por enquanto o quadro só abre somas e múltiplos de módulos do 1º grau.";

  const absNode = (m: Poly): MathNode => ({ row: ["|", polyNode(m, locale), "|"] });
  const moduleCells = modules.map((m) => mids.map((_, c) => polyNode(polyMul(m, [q(columnsData[c].sign(modules.indexOf(m)))]), locale)));
  const equations = columnsData.map((c): MathNode => ({ row: [polyNode(c.left!, locale), " = ", polyNode(c.right!, locale)] }));

  const inColumn = (c: number, v: number) => {
    const lo = c === 0 ? -Infinity : crit[c - 1].value;
    const hi = c === crit.length ? Infinity : crit[c].value;
    return v >= lo - 1e-9 && (v < hi - 1e-9 || c === crit.length);
  };
  const solutions: Exact[] = [];
  const outcomes = columnsData.map((c, col): MathNode => {
    const difference = polyAdd(c.left!, c.right!, -1);
    if (degree(difference) < 0) return { row: [{ word: locale === "en" ? "whole interval" : "todo o intervalo" }] };
    if (degree(difference) === 0) return "∅";
    const here = polyRoots(difference, locale);
    if (here.length === 0) return "∅";
    const parts: MathNode[] = [];
    here.forEach((root, i) => {
      if (i > 0) parts.push("; ");
      const valid = inColumn(col, root.value);
      parts.push({ row: ["x = ", root.node, valid ? "" : " ∉"] });
      if (valid) solutions.push(root);
    });
    return { row: parts };
  });

  const headers = mids.map((_, c): MathNode => {
    if (crit.length === 0) return "ℝ";
    if (c === 0) return { row: ["x < ", crit[0].node] };
    if (c === crit.length) return { row: ["x ≥ ", crit[crit.length - 1].node] };
    return { row: [crit[c - 1].node, " ≤ x < ", crit[c].node] };
  });
  const firstNames: MathNode[] = [
    ...modules.map(absNode),
    { word: locale === "en" ? "Equation" : "Equação" },
    { word: locale === "en" ? "Solution" : "Solução" },
  ];
  const nameWidth = Math.max(...firstNames.map((n) => mathWidth(n, size))) + size;
  const everyCell: MathNode[] = [...headers, ...moduleCells.flat(), ...equations, ...outcomes];
  const gap = Math.max(size * 5, ...everyCell.map((n) => mathWidth(n, size) + size));
  const x = (c: number) => nameWidth + gap * c;
  const center = (c: number) => x(c) + gap / 2;
  const width = x(mids.length);
  const rowH = size * 2.05;
  const rows = firstNames.length;
  const out: Mark[] = [];

  // The line along the top, the critical values at the column borders.
  const axis = rowH * 0.1;
  out.push(line({ x: nameWidth, y: axis }, { x: width, y: axis }));
  out.push({ kind: "head", tip: { x: width + 6, y: axis }, dir: { x: 1, y: 0 }, length: 6 });
  crit.forEach((c, i) => {
    out.push(text(x(i + 1), axis + size * 0.95, c.node, size));
    out.push(line({ x: x(i + 1), y: axis + size * 0.2 }, { x: x(i + 1), y: -(rows + 1) * rowH }, { dash: "dashed", width: 0.4 }));
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
  equations.forEach((e, c) => out.push(text(center(c), rowY(modules.length), e, size, "result")));
  outcomes.forEach((o, c) => out.push(text(center(c), rowY(modules.length + 1), o, size, "result")));

  const unique = sortUnique(solutions);
  const set: MathNode = unique.length === 0 ? "S = ∅" : { row: ["S = {", ...unique.flatMap((s, i) => (i > 0 ? ["; ", s.node] : [s.node])), "}"] };
  out.push(text(mathWidth(set, size) / 2, -(rows + 2.1) * rowH, set, size, "result"));
  return out;
}
