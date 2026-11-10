import type { Locale } from "../messages";
import type { Board, FigureDoc } from "../types";
import { addition, device, division, euclid, multiplication, readDecimal, subtraction, type Decimal, type DeviceKind, type LayoutContext } from "./arithmetic";
import { layoutOf, mathWidth, type BoardLayout, type Mark } from "./marks";
import { modulusTable, readVaral, signSketch, signTable, varal, type VaralSpec } from "./number-line";

export * from "./marks";
export { joinRelationSigns } from "./relation";

/** Longest text a board may be typed from. */
export const MAX_BOARD_SOURCE = 200;

/** Longest text written in a gap, like "?" or "___". */
export const MAX_GAP_TEXT = 12;

/** The largest whole number the factoring and MDC devices take. */
const MAX_DEVICE_NUMBER = 1e9;
const MAX_DIGITS = 18;

export type BoardSpec =
  | { kind: "add"; numbers: Decimal[] }
  | { kind: "sub"; a: Decimal; b: Decimal }
  | { kind: "mul"; a: Decimal; b: Decimal }
  | { kind: "div"; a: Decimal; b: Decimal }
  | { kind: "device"; device: DeviceKind; numbers: number[] }
  | { kind: "euclid"; a: number; b: number }
  | { kind: "varal"; spec: VaralSpec }
  | { kind: "sign"; expr: string }
  | { kind: "table"; expr: string }
  | { kind: "modulus"; equation: string };

/** Lowercase and without accents, for the words a board starts with. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const COLUMN_SUM = new RegExp(`^${NUMBER}(?:\\s*\\+\\s*${NUMBER})+$`);
const BINARY = new RegExp(`^(${NUMBER})\\s*([-−×x*÷/])\\s*(${NUMBER})$`);
const WITH_WORD = new RegExp(`^(${NUMBER})\\s*([-−×x*÷/:+])\\s*(${NUMBER})$`);

function readArithmetic(text: string, withWord: boolean): BoardSpec | string | null {
  const t = text.trim();
  if (COLUMN_SUM.test(t)) {
    const numbers = t.split("+").map((n) => readDecimal(n)!);
    if (numbers.length > 8) return "Some até 8 números de uma vez.";
    return { kind: "add", numbers };
  }
  const m = (withWord ? WITH_WORD : BINARY).exec(t);
  if (!m) return null;
  const a = readDecimal(m[1])!;
  const b = readDecimal(m[3])!;
  if ((a.int + a.frac).length > MAX_DIGITS || (b.int + b.frac).length > MAX_DIGITS) return `Use números de até ${MAX_DIGITS} algarismos.`;
  switch (m[2]) {
    case "+":
      return { kind: "add", numbers: [a, b] };
    case "-":
    case "−":
      return { kind: "sub", a, b };
    case "×":
    case "x":
    case "*":
      return { kind: "mul", a, b };
    default:
      return { kind: "div", a, b };
  }
}

function readWholeNumbers(text: string): number[] | string {
  const parts = text.replace(/[()]/g, " ").split(/[;,\s]+/).filter((p) => p !== "");
  if (parts.length === 0) return "Faltam os números.";
  const numbers = parts.map(Number);
  if (numbers.some((n) => !Number.isInteger(n) || n < 1)) return "Use números inteiros positivos.";
  if (numbers.some((n) => n > MAX_DEVICE_NUMBER)) return "Use números de até 1 000 000 000.";
  return numbers;
}

/** Reads what the teacher typed. Null when it isn't a board; a string says what is wrong. */
export function parseBoard(source: string, locale: Locale = "pt-BR"): BoardSpec | string | null {
  const text = source.trim();
  const head = /^([\p{L}]+)\s*(.*)$/su.exec(text);
  const word = head ? fold(head[1]) : "";
  const rest = head ? head[2].trim() : "";
  const needsRest = (spec: () => BoardSpec | string, example: string) => (rest === "" ? `Falta o que vem depois. Exemplo: ${example}.` : spec());
  const numbers = (kind: DeviceKind) => {
    const list = readWholeNumbers(rest);
    if (typeof list === "string") return list;
    if (kind === "factor" && list.length !== 1) return "Fatore um número por vez. Para vários, use mmc.";
    if (kind !== "factor" && list.length < 2) return "Use ao menos dois números, como mmc(12; 18).";
    if (list.length > 6) return "Use até 6 números.";
    return { kind: "device" as const, device: kind, numbers: list };
  };
  switch (word) {
    case "conta":
      return readArithmetic(rest, true) ?? "Escreva a conta assim: conta 1234:5, conta 12+34, conta 7x8.";
    case "fatorar":
    case "fatoracao":
      return needsRest(() => numbers("factor"), "fatorar 360");
    case "mmc":
      return needsRest(() => numbers("lcm"), "mmc(12; 18)");
    case "mdc":
      return needsRest(() => numbers("gcd"), "mdc(12; 18)");
    case "euclides": {
      const list = readWholeNumbers(rest);
      if (typeof list === "string") return list;
      if (list.length !== 2) return "O algoritmo de Euclides usa dois números, como euclides(48; 18).";
      return { kind: "euclid", a: list[0], b: list[1] };
    }
    case "varal": {
      const parsed = readVaral(rest, locale);
      return parsed === null ? "Escreva os intervalos com U, n ou - entre eles: varal [1;3] n ]2;5[." : typeof parsed === "string" ? parsed : { kind: "varal", spec: parsed };
    }
    case "sinal":
      return needsRest(() => ({ kind: "sign", expr: rest }), "sinal x²-4");
    case "quadro":
      return needsRest(() => ({ kind: "table", expr: rest }), "quadro (x-1)(x+2)/(x-3)");
    case "modular":
    case "modulo":
      return needsRest(() => ({ kind: "modulus", equation: rest }), "modular |x-1| + |x+2| = 5 ou modular |x-2| < 3");
  }
  const arithmetic = readArithmetic(text, false);
  if (arithmetic !== null) return arithmetic;
  if (/^[[\]]/.test(text)) {
    const parsed = readVaral(text, locale);
    return parsed === null || typeof parsed === "string" ? parsed : { kind: "varal", spec: parsed };
  }
  if (/\|.*\|.*[=<>≤≥]/.test(text)) return { kind: "modulus", equation: text };
  return null;
}

const RUNNERS = {
  sign: signSketch,
  table: signTable,
  modulus: modulusTable,
};

function layoutSpec(spec: BoardSpec, ctx: LayoutContext): Mark[] | string {
  switch (spec.kind) {
    case "add":
      return addition(spec.numbers, ctx);
    case "sub":
      return subtraction(spec.a, spec.b, ctx);
    case "mul":
      return multiplication(spec.a, spec.b, ctx);
    case "div":
      return division(spec.a, spec.b, ctx);
    case "device":
      return device(spec.numbers, spec.device, ctx);
    case "euclid":
      return euclid(spec.a, spec.b, ctx);
    case "varal":
      return varal(spec.spec, ctx);
    case "sign":
      return RUNNERS.sign(spec.expr, ctx);
    case "table":
      return RUNNERS.table(spec.expr, ctx);
    case "modulus":
      return RUNNERS.modulus(spec.equation, ctx);
  }
}

type BoardOptions = Pick<Board, "source" | "method" | "places" | "marks" | "size" | "signSide" | "intervals">;

function run(board: BoardOptions, locale: Locale): Mark[] | string {
  const spec = parseBoard(board.source, locale);
  if (spec === null) return "Não entendi essa conta ou tabela.";
  if (typeof spec === "string") return spec;
  return layoutSpec(spec, {
    size: board.size,
    locale,
    method: board.method,
    places: board.places,
    marks: board.marks,
    signSide: board.signSide,
    intervals: board.intervals,
  });
}

const NEUTRAL: BoardOptions = { source: "", method: "long", places: 0, marks: true, size: 12, signSide: "left", intervals: "thick" };

/** What is wrong with a board's text, or null when it can be drawn. */
export function boardError(source: string, locale: Locale = "pt-BR"): string | null {
  const out = run({ ...NEUTRAL, source }, locale);
  return typeof out === "string" ? out : null;
}

/** Results left out of a "gaps" board by its seed: about one in three, and always at least one. */
function isGap(seed: number, index: number): boolean {
  return (seed * 7 + index * 13 + 2) % 3 === 0;
}

type TextMark = Extract<Mark, { kind: "text" }>;

/** The results a "gaps" board can leave out, in order: the numbers a student writes. */
const slotsOf = (marks: Mark[]): TextMark[] => marks.filter((m): m is TextMark => m.kind === "text" && m.role === "result");

/** Which results are left out, by their order: the ones picked by hand, or drawn by the seed. */
export function gapIndexes(board: Pick<Board, "gaps" | "seed">, count: number): Set<number> {
  if (board.gaps !== null) return new Set(board.gaps.filter((i) => i < count));
  const drawn = new Set(Array.from({ length: count }, (_, i) => i).filter((i) => isGap(board.seed, i)));
  if (drawn.size === 0 && count > 0) drawn.add(0);
  return drawn;
}

/** The room a result takes, for its box and for picking it in the preview. */
const slotSize = (m: TextMark) => ({ w: Math.max(mathWidth(m.node, m.size) + m.size * 0.2, m.size * 0.85), h: m.size * 1.15 });

function applyShow(marks: Mark[], board: Pick<Board, "show" | "seed" | "gaps" | "gapStyle" | "gapText">): Mark[] {
  if (board.show === "full") return marks;
  if (board.show === "blank") return marks.filter((m) => m.kind === "head" || m.kind === "box" || !m.role);
  const without = marks.filter((m) => m.kind === "head" || m.kind === "box" || m.role !== "carry");
  const slots = slotsOf(without);
  const picked = gapIndexes(board, slots.length);
  const gaps = new Set(slots.filter((_, i) => picked.has(i)));
  return without.flatMap((m): Mark[] => {
    if (m.kind !== "text" || !gaps.has(m)) return [m];
    if (board.gapStyle === "blank") return [];
    if (board.gapStyle === "text") return board.gapText.trim() === "" ? [] : [{ kind: "text", at: m.at, node: board.gapText, size: m.size }];
    return [{ kind: "box", at: m.at, ...slotSize(m) }];
  });
}

/** The board's marks and their room, or null if its text can't be drawn. */
export function boardLayout(board: Board, doc?: Pick<FigureDoc, "locale">): BoardLayout | null {
  const marks = run(board, doc?.locale ?? "pt-BR");
  if (typeof marks === "string") return null;
  return layoutOf(applyShow(marks, board));
}

/** A result a "gaps" board can leave out, in pt from the board's corner, Y up. */
export interface BoardSlot {
  index: number;
  at: { x: number; y: number };
  w: number;
  h: number;
  gap: boolean;
}

/** Every result of a board, and whether it is a gap now, for picking the gaps in the preview. */
export function boardSlots(board: Board, doc?: Pick<FigureDoc, "locale">): BoardSlot[] {
  const marks = run(board, doc?.locale ?? "pt-BR");
  if (typeof marks === "string") return [];
  const slots = slotsOf(marks);
  const picked = gapIndexes(board, slots.length);
  return slots.map((m, index) => ({ index, at: m.at, ...slotSize(m), gap: picked.has(index) }));
}
