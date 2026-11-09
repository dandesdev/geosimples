import type { Locale } from "../messages";
import { mathWidth, type Mark, type MarkRole, type MathNode } from "./marks";

/**
 * The written algorithms as they are taught in Brazil: operations in columns,
 * division with the chave, and the factorization, MMC and MDC devices.
 */

export interface LayoutContext {
  size: number;
  locale: Locale;
  method: "long" | "short";
  places: number;
  marks: boolean;
}

/** A number as typed, split at its decimal separator. */
export interface Decimal {
  int: string;
  frac: string;
}

export function readDecimal(text: string): Decimal | null {
  const m = /^(\d+)(?:[.,](\d+))?$/.exec(text.trim());
  if (!m) return null;
  return { int: m[1].replace(/^0+(?=\d)/, ""), frac: m[2] ?? "" };
}

const comma = (ctx: LayoutContext) => (ctx.locale === "en" ? "." : ",");
const cellOf = (ctx: LayoutContext) => ctx.size * 0.78;
const rowOf = (ctx: LayoutContext) => ctx.size * 1.42;

const text = (x: number, y: number, node: MathNode, size: number, role?: MarkRole): Mark => ({
  kind: "text",
  at: { x, y },
  node,
  size,
  ...(role ? { role } : {}),
});

const line = (x0: number, y0: number, x1: number, y1: number, width?: number): Mark => ({
  kind: "line",
  a: { x: x0, y: y0 },
  b: { x: x1, y: y1 },
  ...(width ? { width } : {}),
});

/** Columns counted from the right, so numbers line up by their last digit. */
function columns(width: number, ctx: LayoutContext) {
  const cell = cellOf(ctx);
  return {
    x: (p: number) => (width - 1 - p) * cell + cell / 2,
    /** The separator sits on the left edge of column `p`. */
    sep: (p: number) => (width - 1 - p) * cell,
    cell,
  };
}

/** The digits of a number on a row, with its separator after `frac` digits from the right. */
function writeDigits(out: Mark[], digits: string, frac: number, x: (p: number) => number, sep: (p: number) => number, y: number, ctx: LayoutContext, role?: MarkRole) {
  const n = digits.length;
  for (let i = 0; i < n; i++) out.push(text(x(n - 1 - i), y, digits[i], ctx.size, role));
  if (frac > 0) out.push(text(sep(frac - 1), y - ctx.size * 0.12, comma(ctx), ctx.size, role));
}

function alignDecimals(numbers: Decimal[]) {
  const frac = Math.max(...numbers.map((n) => n.frac.length));
  return { frac, digits: numbers.map((n) => n.int + n.frac.padEnd(frac, "0")) };
}

/** Sums in columns, with the carries above. */
export function addition(numbers: Decimal[], ctx: LayoutContext): Mark[] {
  const { frac, digits } = alignDecimals(numbers);
  const total = digits.reduce((acc, d) => acc + BigInt(d), 0n).toString();
  const width = Math.max(total.length, ...digits.map((d) => d.length)) + 1;
  const { x, sep, cell } = columns(width, ctx);
  const row = rowOf(ctx);
  const out: Mark[] = [];
  digits.forEach((d, i) => writeDigits(out, d, frac, x, sep, -(i + 1) * row, ctx));
  out.push(text(cell / 2, -digits.length * row, "+", ctx.size));
  const bottom = -(digits.length + 0.5) * row;
  out.push(line(0, bottom, width * cell, bottom));
  writeDigits(out, total, frac, x, sep, -(digits.length + 1) * row, ctx, "result");
  if (ctx.marks) {
    let carry = 0;
    for (let p = 0; p < width; p++) {
      const column = digits.reduce((acc, d) => acc + Number(d[d.length - 1 - p] ?? 0), carry);
      carry = Math.floor(column / 10);
      if (carry > 0 && p + 1 < width - 1) out.push(text(x(p + 1), -row * 0.1, String(carry), ctx.size * 0.68, "carry"));
    }
  }
  return out;
}

/** Subtraction in columns: a digit that lends is crossed out, with what it became above. */
export function subtraction(a: Decimal, b: Decimal, ctx: LayoutContext): Mark[] | string {
  const { frac, digits } = alignDecimals([a, b]);
  const [top, bottomDigits] = digits;
  if (BigInt(top) < BigInt(bottomDigits)) return "O resultado seria negativo: escreva o número maior primeiro.";
  const result = (BigInt(top) - BigInt(bottomDigits)).toString().padStart(frac + 1, "0");
  const width = Math.max(top.length, bottomDigits.length) + 1;
  const { x, sep, cell } = columns(width, ctx);
  const row = rowOf(ctx);
  const out: Mark[] = [];
  writeDigits(out, top, frac, x, sep, -row, ctx);
  writeDigits(out, bottomDigits, frac, x, sep, -2 * row, ctx);
  out.push(text(cell / 2, -2 * row, "−", ctx.size));
  const bottom = -2.5 * row;
  out.push(line(0, bottom, width * cell, bottom));
  writeDigits(out, result, frac, x, sep, -3 * row, ctx, "result");
  if (ctx.marks) {
    const work = Array.from(top).reverse().map(Number);
    const take = Array.from(bottomDigits).reverse().map(Number);
    const original = [...work];
    for (let p = 0; p < work.length; p++) {
      if (work[p] >= (take[p] ?? 0)) continue;
      let q = p + 1;
      while (work[q] === 0) q++;
      work[q]--;
      for (let j = q - 1; j > p; j--) work[j] = 9;
      work[p] += 10;
    }
    work.forEach((value, p) => {
      if (value === original[p]) return;
      const half = cell * 0.32;
      out.push({ kind: "line", a: { x: x(p) - half, y: -row - half }, b: { x: x(p) + half, y: -row + half }, width: 0.5, role: "carry" });
      out.push(text(x(p), -row * 0.1, String(value), ctx.size * 0.68, "carry"));
    });
  }
  return out;
}

/** Multiplication in columns, one partial product for each digit of the second factor. */
export function multiplication(a: Decimal, b: Decimal, ctx: LayoutContext): Mark[] {
  const [x1, x2] = [a.int + a.frac, b.int + b.frac].map((d) => d.replace(/^0+(?=\d)/, ""));
  const frac = a.frac.length + b.frac.length;
  const product = BigInt(x1) * BigInt(x2);
  const shown = product.toString().padStart(frac + 1, "0");
  const lower = Array.from(x2).reverse();
  const width = Math.max(shown.length, x1.length, x2.length) + 1;
  const { x, sep, cell } = columns(width, ctx);
  const row = rowOf(ctx);
  const out: Mark[] = [];
  writeDigits(out, x1, a.frac.length, x, sep, -row, ctx);
  writeDigits(out, x2, b.frac.length, x, sep, -2 * row, ctx);
  out.push(text(cell / 2, -2 * row, "×", ctx.size));
  let y = -2.5 * row;
  out.push(line(0, y, width * cell, y));
  if (lower.length === 1) {
    writeDigits(out, shown, frac, x, sep, -3 * row, ctx, "result");
    if (ctx.marks) {
      let carry = 0;
      Array.from(x1).reverse().forEach((d, p) => {
        const v = Number(d) * Number(x2) + carry;
        carry = Math.floor(v / 10);
        if (carry > 0 && p + 1 < x1.length) out.push(text(x(p + 1), -row * 0.1, String(carry), ctx.size * 0.68, "carry"));
      });
    }
    return out;
  }
  let r = 3;
  lower.forEach((digit, shift) => {
    const partial = (BigInt(x1) * BigInt(digit)).toString();
    const digits = shift > 0 && partial === "0" ? "0".repeat(x1.length) : partial;
    for (let i = 0; i < digits.length; i++) out.push(text(x(digits.length - 1 - i + shift), -r * row, digits[i], ctx.size, "result"));
    r++;
  });
  out.push(text(cell / 2, -(r - 1) * row, "+", ctx.size));
  y = -(r - 0.5) * row;
  out.push(line(0, y, width * cell, y));
  writeDigits(out, shown, frac, x, sep, -r * row, ctx, "result");
  return out;
}

/** Long division with the chave: the divisor on the right, over the quotient. */
export function division(dividend: Decimal, divisor: Decimal, ctx: LayoutContext): Mark[] | string {
  const casas = Math.max(dividend.frac.length, divisor.frac.length);
  const scale = (d: Decimal) => (d.int + d.frac.padEnd(casas, "0")).replace(/^0+(?=\d)/, "");
  const whole = scale(dividend);
  const by = BigInt(scale(divisor));
  if (by === 0n) return "Não existe divisão por zero.";
  const digits = whole + "0".repeat(ctx.places);
  const cell = cellOf(ctx);
  const row = rowOf(ctx);
  const out: Mark[] = [];
  const x = (i: number) => i * cell + cell / 2;
  for (let i = 0; i < digits.length; i++) out.push(text(x(i), 0, digits[i], ctx.size));
  if (ctx.places > 0) out.push(text(whole.length * cell, -ctx.size * 0.12, comma(ctx), ctx.size));

  let end = 0;
  let partial = BigInt(digits[0]);
  while (partial < by && end < whole.length - 1) partial = partial * 10n + BigInt(digits[++end]);
  const firstEnd = end;

  /** Writes a number so its last digit falls in column `last`. */
  const place = (value: string, last: number, y: number) => {
    for (let i = 0; i < value.length; i++) out.push(text(x(last - value.length + 1 + i), y, value[i], ctx.size, "result"));
  };

  const quotient: string[] = [];
  let r = 1;
  for (;;) {
    const digit = partial / by;
    const taken = digit * by;
    const rest = partial - taken;
    quotient.push(digit.toString());
    if (ctx.method === "long" && digit > 0n) {
      const shown = taken.toString();
      place(shown, end, -r * row);
      const from = end - shown.length;
      out.push(text(x(from), -r * row, "−", ctx.size, "result"));
      const y = -(r + 0.5) * row;
      out.push({ kind: "line", a: { x: x(from) - cell / 2, y }, b: { x: x(end) + cell / 2, y }, role: "result" });
      r++;
    }
    const next = end + 1;
    if (next >= digits.length) {
      place(rest.toString(), end, -r * row);
      break;
    }
    place(rest.toString() + digits[next], next, -r * row);
    r++;
    partial = rest * 10n + BigInt(digits[next]);
    end = next;
  }

  // The chave: a bar after the dividend, closed under the divisor.
  const bar = digits.length * cell + cell * 0.2;
  const shownDivisor = by.toString();
  const intDigits = whole.length - firstEnd;
  const quotientText = ctx.places > 0 ? `${quotient.slice(0, intDigits).join("")}${comma(ctx)}${quotient.slice(intDigits).join("")}` : quotient.join("");
  const left = bar + cell * 0.35;
  const quotientWidth = Math.max(shownDivisor.length, quotientText.length) * cell + cell * 0.4;
  out.push(line(bar, row * 0.55, bar, -row * 0.55));
  out.push(line(bar, -row * 0.55, left - cell * 0.35 + quotientWidth + cell * 0.35, -row * 0.55));
  Array.from(shownDivisor).forEach((d, i) => out.push(text(left + (i + 0.5) * cell, 0, d, ctx.size)));
  // The separator takes less room than a digit, as written by hand.
  let along = left;
  for (const d of quotientText) {
    const isDigit = /\d/.test(d);
    out.push(text(along + (isDigit ? cell / 2 : cell * 0.15), -row * 1.15, d, ctx.size, "result"));
    along += isDigit ? cell : cell * 0.3;
  }
  return out;
}

function smallestPrime(n: number): number {
  if (n % 2 === 0) return 2;
  for (let p = 3; p * p <= n; p += 2) if (n % p === 0) return p;
  return n;
}

/** Writes 2·2·3·5 as 2²·3·5. */
function powersNode(primes: number[]): MathNode {
  const counts = new Map<number, number>();
  for (const p of primes) counts.set(p, (counts.get(p) ?? 0) + 1);
  const row: MathNode[] = [];
  [...counts].forEach(([p, k], i) => {
    if (i > 0) row.push(" · ");
    row.push(k > 1 ? { sup: [String(p), String(k)] } : String(p));
  });
  return { row };
}

export type DeviceKind = "factor" | "lcm" | "gcd";

/**
 * The practical device: numbers on the left, primes on the right of a bar, a
 * row for each division. With several numbers, those a prime doesn't divide
 * come down as they are; for the MDC, the primes that divide them all are circled.
 */
export function device(numbers: number[], kind: DeviceKind, ctx: LayoutContext): Mark[] {
  const row = rowOf(ctx);
  const cell = cellOf(ctx);
  const rows: { values: number[]; prime: number | null; common: boolean }[] = [];
  let values = [...numbers];
  while (values.some((v) => v > 1)) {
    const prime = Math.min(...values.filter((v) => v > 1).map(smallestPrime));
    const common = values.every((v) => v % prime === 0);
    rows.push({ values, prime, common });
    values = values.map((v) => (v % prime === 0 ? v / prime : v));
  }
  rows.push({ values, prime: null, common: false });

  const count = numbers.length;
  const widest = Array.from({ length: count }, (_, j) => Math.max(...rows.map((r) => String(r.values[j]).length)));
  const columnsWidth = widest.reduce((a, w) => a + (w + 1) * cell, 0);
  const out: Mark[] = [];
  const bar = columnsWidth;
  rows.forEach((r, i) => {
    let right = 0;
    r.values.forEach((v, j) => {
      right += (widest[j] + 0.6) * cell;
      const shown = String(v);
      const role = i === 0 ? undefined : "result";
      Array.from(shown).forEach((d, k) => out.push(text(right - (shown.length - k - 0.5) * cell, -i * row, d, ctx.size, role)));
      if (j < count - 1) out.push(text(right + cell * 0.2, -i * row - ctx.size * 0.12, ",", ctx.size, role));
      right += cell * 0.4;
    });
    if (r.prime !== null) {
      const px = bar + cell * 0.7 + (String(r.prime).length * cell) / 2;
      out.push(text(px, -i * row, String(r.prime), ctx.size, "result"));
      if (kind === "gcd" && r.common) out.push({ kind: "ring", at: { x: px, y: -i * row }, r: ctx.size * 0.72, role: "result" });
    }
  });
  out.push(line(bar, row * 0.55, bar, -(rows.length - 1) * row - row * 0.45));

  const primes = rows.flatMap((r) => (r.prime === null ? [] : [r.prime]));
  const common = rows.flatMap((r) => (r.prime !== null && r.common ? [r.prime] : []));
  const y = -rows.length * row - ctx.size * 0.2;
  let summary: MathNode;
  if (kind === "factor") {
    summary = { row: [String(numbers[0]), " = ", powersNode(primes)] };
  } else if (kind === "lcm") {
    const value = primes.reduce((a, p) => a * p, 1);
    summary = { row: [{ word: ctx.locale === "en" ? "LCM" : "MMC" }, " = ", ...(primes.length > 1 ? [powersNode(primes), " = "] : []), String(value)] };
  } else {
    const value = common.reduce((a, p) => a * p, 1);
    summary = { row: [{ word: ctx.locale === "en" ? "GCD" : "MDC" }, " = ", ...(common.length > 1 ? [powersNode(common), " = "] : []), String(value)] };
  }
  const size = ctx.size * 0.95;
  out.push(text(mathWidth(summary, size) / 2, y, summary, size, "result"));
  return out;
}

/** Euclid's table: quotients above, successive divisors in the middle, remainders below. */
export function euclid(a: number, b: number, ctx: LayoutContext): Mark[] {
  const [first, second] = a >= b ? [a, b] : [b, a];
  const line_: number[] = [first, second];
  const quotients: number[] = [];
  while (line_[line_.length - 1] !== 0) {
    const n = line_.length;
    quotients.push(Math.floor(line_[n - 2] / line_[n - 1]));
    line_.push(line_[n - 2] % line_[n - 1]);
  }
  const middle = line_.slice(0, -1);
  const remainders = line_.slice(2);
  const count = middle.length;
  const widest = Math.max(...middle.map((v) => String(v).length));
  const w = (widest + 1.2) * cellOf(ctx);
  const h = rowOf(ctx) * 1.05;
  const out: Mark[] = [];
  for (let r = 0; r <= 3; r++) out.push(line(0, -r * h, count * w, -r * h, r === 0 || r === 3 ? undefined : 0.6));
  for (let c = 0; c <= count; c++) out.push(line(c * w, 0, c * w, -3 * h, 0.6));
  const cellAt = (c: number, r: number, value: string, role?: MarkRole) => out.push(text((c + 0.5) * w, -(r + 0.5) * h, value, ctx.size, role));
  quotients.forEach((q, i) => cellAt(i + 1, 0, String(q), "result"));
  middle.forEach((v, i) => cellAt(i, 1, String(v), i < 2 ? undefined : "result"));
  remainders.forEach((v, i) => cellAt(i, 2, String(v), "result"));
  const gcd = middle[middle.length - 1];
  const summary: MathNode = { row: [{ word: ctx.locale === "en" ? "GCD" : "MDC" }, `(${first}${ctx.locale === "en" ? "," : ";"} ${second}) = ${gcd}`] };
  const size = ctx.size * 0.95;
  out.push(text(mathWidth(summary, size) / 2, -3 * h - rowOf(ctx) * 0.8, summary, size, "result"));
  return out;
}
