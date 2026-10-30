import { LIMITS } from "./defaults";
import { parseExpr, type Expr } from "../plot";
import type { Id } from "./types";
import { add, dist, polar, type Vec } from "./vec";

/** A point to create. */
export interface ParsedPoint {
  x: number;
  y: number;
  label?: string;
}

/**
 * A point the input refers to: a new one, or an existing point named in the
 * figure. Segments refer to nodes by index.
 */
export type InputNode = ({ kind: "new" } & ParsedPoint) | { kind: "existing"; id: Id; x: number; y: number };

/** A free text to create. */
export interface ParsedText {
  text: string;
  x: number;
  y: number;
}

/** A function graph to create, written f(x) = … or y = …. */
export interface ParsedFunction {
  /** "f" for f(x) = …, empty for y = …. */
  name: string;
  expr: string;
}

/** A vertical line to create, written x = 2. */
export interface ParsedLine {
  x: number;
}

/** An interval to mark on the number line, written [-2; 3[ or ]-∞; 1]. Null ends are infinite. */
export interface ParsedInterval {
  from: number | null;
  to: number | null;
  /** Whether each end belongs to the interval. */
  closed: [boolean, boolean];
}

/** A point to create on a graph, written P = f(2) or f(2). */
export interface ParsedGraphPoint {
  graph: Id;
  x: number;
  /** Empty for the next free name. */
  label: string;
}

export type InputTokenKind = "name" | "point" | "ref" | "connector" | "text" | "error";

/** A span of the input text, used to color it as the teacher types. */
export interface InputToken {
  kind: InputTokenKind;
  start: number;
  end: number;
}

export interface InputError {
  message: string;
  start: number;
  end: number;
}

export interface ParsedInput {
  nodes: InputNode[];
  /** Pairs of node indices to join with a segment. */
  segments: [number, number][];
  /** Free texts, written "texto"@(x;y). */
  texts: ParsedText[];
  /** Graphs of functions, written f(x) = x^2 or y = 2x + 1. The whole input is then the function. */
  functions: ParsedFunction[];
  /** Vertical lines, written x = 2. The whole input is then the line. */
  lines: ParsedLine[];
  /** Points on graphs, written P = f(2). The whole input is then the point. */
  graphPoints: ParsedGraphPoint[];
  /** Intervals on the number line, written [-2; 3[. The whole input is then the interval. */
  intervals: ParsedInterval[];
  tokens: InputToken[];
  errors: InputError[];
}

export interface InputContext {
  /** Points already in the figure, in figure order. Their labels can be used as names. */
  points: { id: Id; x: number; y: number; label?: string }[];
  /** Last selected point: where a +displacement starts when nothing comes before it. */
  selected?: Vec;
  /** Graphs in the figure, by the name on their label, for P = f(2). */
  graphs?: { id: Id; name: string }[];
}

const NAME = /[A-Za-zα-ωΑ-Ω][A-Za-z0-9′'₀-₉]*/uy;
const NUMBER = /[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)/y;

const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);

/**
 * Parses the point input bar.
 *
 * - `(X;Y)` or `X;Y`: absolute point. Decimal comma or dot.
 * - `(R:θ)`: polar, R units at θ degrees from the origin.
 * - `+(X;Y)` and `+(R:θ)`: displacement from the previous point. At the
 *   start, from the selected point, or else the last point of the figure.
 * - `Nome=` before a point names it. A bare name refers to an existing point.
 * - `--` joins its neighbors with a segment, with or without spaces.
 *   A `--` at the very end closes the contour.
 * - Spaces without `--` separate independent points or chains.
 * - `"texto"@(X;Y)` places a free text centered at a point; any point form works after `@`.
 */
export function parseInput(text: string, ctx: InputContext = { points: [] }): ParsedInput {
  const whole =
    parseFunctionInput(text) ?? parseLineInput(text) ?? parseGraphPointInput(text, ctx) ?? parseIntervalInput(text);
  if (whole) return whole;
  const nodes: InputNode[] = [];
  const segments: [number, number][] = [];
  const texts: ParsedText[] = [];
  const tokens: InputToken[] = [];
  const errors: InputError[] = [];

  const names = new Map<string, number | { id: Id; x: number; y: number }>();
  for (const p of ctx.points) if (p.label) names.set(p.label, { id: p.id, x: p.x, y: p.y });

  let i = 0;
  let chainStart: number | null = null;
  let chainLength = 0;
  let last: number | null = null;
  let pendingConnector: { start: number; end: number } | null = null;

  const skipSpaces = () => {
    while (isSpace(text[i])) i++;
  };

  const fail = (start: number, message: string) => {
    // Resume after the broken piece: at the next space or connector.
    let end = Math.max(i, start + 1);
    while (end < text.length && !isSpace(text[end]) && !text.startsWith("--", end)) end++;
    errors.push({ message, start, end });
    tokens.push({ kind: "error", start, end });
    i = end;
    chainStart = null;
    chainLength = 0;
    pendingConnector = null;
  };

  const readNumber = (): number | null => {
    NUMBER.lastIndex = i;
    const m = NUMBER.exec(text);
    if (!m) return null;
    const n = Number(m[0].replace(",", "."));
    if (!Number.isFinite(n) || Math.abs(n) > LIMITS.coordinate) return null;
    i += m[0].length;
    return n;
  };

  const position = (index: number): Vec => {
    const n = nodes[index];
    return { x: n.x, y: n.y };
  };

  const origin = (): Vec | undefined => {
    if (last !== null) return position(last);
    if (ctx.selected) return ctx.selected;
    const p = ctx.points[ctx.points.length - 1];
    return p ? { x: p.x, y: p.y } : undefined;
  };

  /** Reads one point or name. Returns the node index, or null after reporting an error. */
  const readItem = (): number | null => {
    const start = i;
    let label: string | undefined;

    NAME.lastIndex = i;
    const name = NAME.exec(text);
    if (name) {
      const afterName = i + name[0].length;
      let j = afterName;
      while (isSpace(text[j])) j++;
      if (text[j] === "=") {
        label = name[0];
        tokens.push({ kind: "name", start, end: j + 1 });
        i = j + 1;
        skipSpaces();
      } else {
        i = afterName;
        const target = names.get(name[0]);
        if (target === undefined) {
          fail(start, `Não há ponto chamado "${name[0]}". Para criar, use ${name[0]}=(x;y).`);
          return null;
        }
        tokens.push({ kind: "ref", start, end: i });
        if (typeof target === "number") return target;
        nodes.push({ kind: "existing", ...target });
        names.set(name[0], nodes.length - 1);
        return nodes.length - 1;
      }
    }

    const p = readPosition(start, label ? `Depois de ${label}= vem um ponto, como (2;3).` : undefined);
    if (!p) return null;
    nodes.push({ kind: "new", x: roundTiny(p.x), y: roundTiny(p.y), ...(label ? { label } : {}) });
    const index = nodes.length - 1;
    if (label) names.set(label, index);
    return index;
  };

  /** Reads a position: (x;y), (R:θ) or a displacement. Returns null after reporting an error. */
  const readPosition = (start: number, formError = "Use (x;y), (R:θ), +(x;y) ou +(R:θ)."): Vec | null => {
    const pointStart = i;
    // A leading + makes it a displacement: +(1;2), +1;2, +(3:60).
    const isRelative = text[i] === "+";
    if (isRelative) {
      i++;
      skipSpaces();
    }
    const paren = text[i] === "(";
    if (paren) {
      i++;
      skipSpaces();
    }
    const a = readNumber();
    skipSpaces();
    const sep = text[i];
    if (a === null || (sep !== ";" && sep !== ":")) {
      fail(start, formError);
      return null;
    }
    i++;
    skipSpaces();
    const b = readNumber();
    skipSpaces();
    if (b === null) {
      fail(start, sep === ";" ? "Falta a coordenada y. Exemplo: (2;3)." : "Falta o ângulo θ, em graus. Exemplo: (3:60).");
      return null;
    }
    if (paren) {
      if (text[i] !== ")") {
        fail(start, "Falta fechar o parêntese.");
        return null;
      }
      i++;
    }
    tokens.push({ kind: "point", start: pointStart, end: i });

    let p: Vec = sep === ";" ? { x: a, y: b } : polar(a, b);
    if (isRelative) {
      const from = origin();
      if (!from) {
        errors.push({ message: "Não há ponto anterior para o deslocamento partir.", start: pointStart, end: i });
        tokens.push({ kind: "error", start: pointStart, end: i });
        return null;
      }
      p = add(from, p);
    }
    return p;
  };

  /** Reads "texto"@position. Text ends the current chain. */
  const readText = () => {
    const start = i;
    const close = text.slice(i + 1).search(/["”]/);
    if (close < 0) {
      errors.push({ message: "Falta fechar as aspas do texto.", start, end: text.length });
      tokens.push({ kind: "error", start, end: text.length });
      i = text.length;
      return;
    }
    const content = text.slice(i + 1, i + 1 + close).trim();
    i += close + 2;
    if (content === "") {
      fail(start, "O texto entre aspas está vazio.");
      return;
    }
    skipSpaces();
    if (text[i] !== "@") {
      fail(start, `Diga onde fica o texto: "${content}"@(x;y).`);
      return;
    }
    i++;
    tokens.push({ kind: "text", start, end: i });
    skipSpaces();
    const p = readPosition(start, `Depois de @ vem um ponto, como (2;3).`);
    if (!p) return;
    texts.push({ text: content.slice(0, LIMITS.labelLength), x: roundTiny(p.x), y: roundTiny(p.y) });
    chainStart = null;
    chainLength = 0;
  };

  /**
   * A -- with no point after it closes the contour: at the end of the input,
   * or right before a free text ("…--C=(0;3)-- "Figura 1"@(3;-1)").
   */
  const closeContour = () => {
    if (!pendingConnector) return;
    const c: { start: number; end: number } = pendingConnector;
    pendingConnector = null;
    if (chainStart === null || last === null || chainLength < 3) {
      errors.push({ message: "Um -- sem ponto depois fecha o contorno: ligue ao menos três pontos antes.", ...c });
      tokens.push({ kind: "error", ...c });
    } else if (last !== chainStart) {
      segments.push([last, chainStart]);
    }
    chainStart = null;
    chainLength = 0;
  };

  for (;;) {
    skipSpaces();
    if (i >= text.length) break;

    if (text.startsWith("--", i)) {
      const start = i;
      i += 2;
      if (last === null || chainStart === null || pendingConnector) {
        errors.push({ message: "Coloque um ponto antes de --.", start, end: i });
        tokens.push({ kind: "error", start, end: i });
        continue;
      }
      pendingConnector = { start, end: i };
      tokens.push({ kind: "connector", start, end: i });
      continue;
    }

    if (text[i] === '"' || text[i] === "“") {
      closeContour();
      readText();
      continue;
    }

    const index = readItem();
    if (index === null) continue;
    if (pendingConnector && last !== null) {
      if (last !== index) segments.push([last, index]);
      chainLength++;
    } else {
      chainStart = index;
      chainLength = 1;
    }
    pendingConnector = null;
    last = index;
  }

  closeContour();

  // Drop segments that would have no length.
  const kept = segments.filter(([p, q]) => dist(position(p), position(q)) > 0);
  return {
    nodes,
    segments: kept,
    texts,
    functions: [],
    lines: [],
    graphPoints: [],
    intervals: [],
    tokens: tokens.sort((x, y) => x.start - y.start),
    errors,
  };
}

/** Removes floating point noise like 2.9999999999999996. */
function roundTiny(n: number): number {
  return Math.round(n * 1e9) / 1e9;
}

/** `f(x) = …` always; `y = …` unless what follows is a point, like y=(1;2). */
const FUNCTION_INPUT = /^(\s*)([A-Za-z])\s*\(\s*x\s*\)\s*=|^(\s*)[yY]\s*=(?![^;:]*[;:])/;

/**
 * A function typed in the point input: f(x) = x^2 - 1, g(x)=2sen(x) or
 * y = 2x + 1. Returns null for anything else, which is read as points.
 */
function parseFunctionInput(text: string): ParsedInput | null {
  const m = FUNCTION_INPUT.exec(text);
  if (!m) return null;
  const head = m[0].length;
  const start = (m[1] ?? m[3]).length;
  const expr = text.slice(head);
  const result = emptyInput();
  result.tokens.push({ kind: "name", start, end: head });
  const parsed = parseExpr(expr);
  if (parsed.ok) {
    result.functions.push({ name: m[2] ?? "", expr: expr.trim() });
    if (expr.trim()) result.tokens.push({ kind: "text", start: head, end: text.length });
  } else {
    const at = head + Math.min(parsed.at, Math.max(expr.length - 1, 0));
    result.errors.push({ message: parsed.error, start: at, end: Math.max(at + 1, text.length) });
    result.tokens.push({ kind: "error", start: at, end: Math.max(at + 1, text.length) });
  }
  return result;
}

const emptyInput = (): ParsedInput => ({
  nodes: [],
  segments: [],
  texts: [],
  functions: [],
  lines: [],
  graphPoints: [],
  intervals: [],
  tokens: [],
  errors: [],
});

const hasX = (e: Expr): boolean =>
  e.kind === "x" ||
  (e.kind === "neg" && hasX(e.arg)) ||
  (e.kind === "call" && hasX(e.arg)) ||
  (e.kind === "bin" && (hasX(e.a) || hasX(e.b)));

/** A number written as an expression, like 2, -1,5 or pi/2, starting at `offset` in the input. */
function constant(text: string, offset: number): { value: number } | InputError {
  const parsed = parseExpr(text);
  if (!parsed.ok) {
    const at = offset + Math.min(parsed.at, Math.max(text.length - 1, 0));
    return { message: parsed.error, start: at, end: Math.max(at + 1, offset + text.length) };
  }
  const value = parsed.fn(0);
  if (hasX(parsed.expr) || !Number.isFinite(value)) {
    return { message: "Use um número aqui, como 2 ou pi/2.", start: offset, end: offset + text.length };
  }
  return { value: roundTiny(value) };
}

function withValue(result: ParsedInput, value: { value: number } | InputError, start: number, end: number) {
  if ("value" in value) {
    if (end > start) result.tokens.push({ kind: "text", start, end });
    return value.value;
  }
  result.errors.push(value);
  result.tokens.push({ kind: "error", start: value.start, end: value.end });
  return null;
}

/** `x = …` with a number after, never a point like x=(1;2). */
const LINE_INPUT = /^(\s*)x\s*=(?![^;:]*[;:])/;

/** The vertical line x = 2, or x = pi/2. Returns null for anything else. */
function parseLineInput(text: string): ParsedInput | null {
  const m = LINE_INPUT.exec(text);
  if (!m) return null;
  const head = m[0].length;
  const result = emptyInput();
  result.tokens.push({ kind: "name", start: m[1].length, end: head });
  const rest = text.slice(head);
  if (rest.trim() === "") return result;
  const x = withValue(result, constant(rest, head), head, text.length);
  if (x !== null) result.lines.push({ x });
  return result;
}

/** `P = f(2)` or `f(2)`: a name, then a graph's name and a number in parentheses. */
const GRAPH_POINT_INPUT = /^(\s*)(?:([A-Za-zα-ωΑ-Ω][A-Za-z0-9′'₀-₉]*)\s*=\s*)?([A-Za-z][A-Za-z0-9₀-₉]*)\s*\(([^;:()]*(?:\([^;:()]*\)[^;:()]*)*)\)\s*$/u;

/** A point on a graph of the figure, like P = f(2). Returns null for anything else. */
function parseGraphPointInput(text: string, ctx: InputContext): ParsedInput | null {
  const m = GRAPH_POINT_INPUT.exec(text);
  if (!m) return null;
  const [, lead, label = "", name, arg] = m;
  const graph = ctx.graphs?.find((g) => g.name === name);
  // f(x) = … is a function, and other names are left to the point reader to complain about.
  if (!graph || arg.trim() === "x") return null;
  const result = emptyInput();
  const nameStart = text.indexOf(name, lead.length + (label ? label.length : 0));
  if (label) result.tokens.push({ kind: "name", start: lead.length, end: lead.length + label.length });
  result.tokens.push({ kind: "ref", start: nameStart, end: nameStart + name.length });
  const argStart = text.indexOf("(", nameStart) + 1;
  const x = withValue(result, constant(arg, argStart), argStart, argStart + arg.length);
  if (x !== null) result.graphPoints.push({ graph: graph.id, x, label: label.slice(0, LIMITS.labelLength) });
  return result;
}

/** `[a; b]` with either bracket turned: [ closes the start, ] opens it, and the other way at the end. */
const INTERVAL_INPUT = /^(\s*)([[\]])([^;[\]]*);([^;[\]]*)([[\]])\s*$/;

/** -∞, +∞, -inf, inf: an end that runs off the number line. */
const INFINITY = /^\s*([+-]?)\s*(?:∞|inf)\s*$/i;

/** An interval on the number line, like [-2; 3[ or ]-∞; 1/2]. Returns null for anything else. */
function parseIntervalInput(text: string): ParsedInput | null {
  const m = INTERVAL_INPUT.exec(text);
  if (!m) return null;
  const [, lead, open, first, second, close] = m;
  const result = emptyInput();
  const start = lead.length;
  const firstAt = start + 1;
  const secondAt = firstAt + first.length + 1;
  const closeAt = text.trimEnd().length - 1;
  result.tokens.push({ kind: "name", start, end: firstAt }, { kind: "name", start: closeAt, end: closeAt + 1 });
  const end = (raw: string, at: number, side: "-" | "+"): number | null | undefined => {
    const inf = INFINITY.exec(raw);
    if (inf) {
      if (inf[1] !== (side === "-" ? "-" : "+") && !(side === "+" && inf[1] === "")) {
        result.errors.push({ message: side === "-" ? "O início só pode ser -∞." : "O fim só pode ser +∞.", start: at, end: at + raw.length });
        result.tokens.push({ kind: "error", start: at, end: at + raw.length });
        return undefined;
      }
      result.tokens.push({ kind: "text", start: at, end: at + raw.length });
      return null;
    }
    const v = withValue(result, constant(raw, at), at, at + raw.length);
    return v === null ? undefined : v;
  };
  const from = end(first, firstAt, "-");
  const to = end(second, secondAt, "+");
  if (from === undefined || to === undefined) return result;
  if (from !== null && to !== null && !(from < to)) {
    result.errors.push({ message: "O início do intervalo precisa ser menor que o fim.", start, end: text.length });
    return result;
  }
  // An infinite end is never included, whatever the bracket says.
  result.intervals.push({ from, to, closed: [open === "[" && from !== null, close === "]" && to !== null] });
  return result;
}
