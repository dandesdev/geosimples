/**
 * Expressions in x, as typed by a teacher: `x^2 - 1`, `2x + 1`, `3sen(x)`,
 * `raiz(x)`, `|x - 2|`, `1/x`, `1,5x`. No eval: the text is parsed into a
 * tree and compiled into a plain function of x.
 *
 * Supported: + - * / ^ (right associative, -x^2 is -(x²)), implicit
 * multiplication (2x, 3sen(x), (x+1)(x-1), 2pi), parentheses, |…| for the
 * absolute value, the constants pi (π) and e, and the functions sqrt/raiz,
 * abs, ln, log (base 10), exp, sin/sen, cos, tan/tg, in radians.
 * A decimal comma is read as a point, and ² ³ as powers.
 */

export type Expr =
  | { kind: "num"; value: number }
  | { kind: "x" }
  | { kind: "neg"; arg: Expr }
  | { kind: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Expr; b: Expr }
  | { kind: "call"; fn: FnName; arg: Expr };

export type FnName = "sqrt" | "abs" | "ln" | "log" | "exp" | "sin" | "cos" | "tan";

export type ParseResult =
  | { ok: true; expr: Expr; fn: (x: number) => number }
  | { ok: false; error: string; /** Character offset in the typed text. */ at: number };

/** Names a teacher may type, longest first so "sqrt" wins over "s…". */
const NAMES: [string, { fn: FnName } | { constant: number } | { x: true }][] = [
  ["sqrt", { fn: "sqrt" }],
  ["raiz", { fn: "sqrt" }],
  ["abs", { fn: "abs" }],
  ["exp", { fn: "exp" }],
  ["log", { fn: "log" }],
  ["sin", { fn: "sin" }],
  ["sen", { fn: "sin" }],
  ["cos", { fn: "cos" }],
  ["tan", { fn: "tan" }],
  ["ln", { fn: "ln" }],
  ["tg", { fn: "tan" }],
  ["pi", { constant: Math.PI }],
  ["x", { x: true }],
  ["e", { constant: Math.E }],
];

type Token =
  | { t: "num"; value: number; at: number }
  | { t: "x"; at: number }
  | { t: "const"; value: number; at: number }
  | { t: "fn"; fn: FnName; at: number }
  | { t: "op"; op: "+" | "-" | "*" | "/" | "^"; at: number }
  | { t: "("; at: number }
  | { t: ")"; at: number }
  | { t: "|"; at: number }
  | { t: "end"; at: number };

class ParseError extends Error {
  constructor(
    message: string,
    public at: number,
  ) {
    super(message);
  }
}

/** Same length as the input, so token offsets point into what was typed. */
function prepare(text: string): string {
  return text
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[−–]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/");
}

function tokenize(text: string): Token[] {
  const s = prepare(text);
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
      if (!m) throw new ParseError("Número incompleto.", i);
      out.push({ t: "num", value: Number(m[0]), at: i });
      i += m[0].length;
    } else if (c === "²" || c === "³") {
      out.push({ t: "op", op: "^", at: i });
      out.push({ t: "num", value: c === "²" ? 2 : 3, at: i });
      i++;
    } else if (c === "π") {
      out.push({ t: "const", value: Math.PI, at: i });
      i++;
    } else if ("+-*/^".includes(c)) {
      out.push({ t: "op", op: c as "+", at: i });
      i++;
    } else if (c === "(" || c === ")" || c === "|") {
      out.push({ t: c, at: i });
      i++;
    } else if (/[a-zA-Z]/.test(c)) {
      // A run of letters is split into known names: "xsen" is x·sen, "2pix" is 2·π·x.
      const run = /^[a-zA-Z]+/.exec(s.slice(i))![0].toLowerCase();
      let j = 0;
      while (j < run.length) {
        const hit = NAMES.find(([name]) => run.startsWith(name, j));
        if (!hit) {
          const word = run.slice(j);
          throw new ParseError(`Não conheço "${word}". Use x, números, pi, e e funções como sen, cos, raiz.`, i + j);
        }
        const [name, meaning] = hit;
        const at = i + j;
        if ("fn" in meaning) out.push({ t: "fn", fn: meaning.fn, at });
        else if ("constant" in meaning) out.push({ t: "const", value: meaning.constant, at });
        else out.push({ t: "x", at });
        j += name.length;
      }
      i += run.length;
    } else {
      throw new ParseError(`O símbolo "${c}" não vale numa função.`, i);
    }
  }
  out.push({ t: "end", at: s.length });
  return out;
}

/** Recursive descent over the tokens. */
class Parser {
  private i = 0;
  /** Open |…|: inside one, a | closes it instead of starting another. */
  private openAbs = 0;
  constructor(private tokens: Token[]) {}

  private peek() {
    return this.tokens[this.i];
  }
  private next() {
    return this.tokens[this.i++];
  }

  parse(): Expr {
    if (this.peek().t === "end") throw new ParseError("Digite uma expressão em x, como x^2 - 1.", 0);
    const e = this.sum();
    const t = this.peek();
    if (t.t === ")") throw new ParseError("Há um ) sem ( correspondente.", t.at);
    if (t.t !== "end") throw new ParseError("Não entendi esta parte.", t.at);
    return e;
  }

  private sum(): Expr {
    let e = this.product();
    for (;;) {
      const t = this.peek();
      if (t.t === "op" && (t.op === "+" || t.op === "-")) {
        this.next();
        e = { kind: "bin", op: t.op, a: e, b: this.product() };
      } else return e;
    }
  }

  /** Whether the next token can start a factor with no * before it: 2x, 3sen(x), (x+1)(x-1). */
  private startsFactor(): boolean {
    const t = this.peek().t;
    // Inside |…| a | closes it; outside, 2|x| multiplies.
    return t === "num" || t === "x" || t === "const" || t === "fn" || t === "(" || (t === "|" && this.openAbs === 0);
  }

  private product(): Expr {
    let e = this.unary();
    for (;;) {
      const t = this.peek();
      if (t.t === "op" && (t.op === "*" || t.op === "/")) {
        this.next();
        e = { kind: "bin", op: t.op, a: e, b: this.unary() };
      } else if (this.startsFactor()) {
        e = { kind: "bin", op: "*", a: e, b: this.power() };
      } else return e;
    }
  }

  private unary(): Expr {
    const t = this.peek();
    if (t.t === "op" && (t.op === "-" || t.op === "+")) {
      this.next();
      const arg = this.unary();
      return t.op === "-" ? { kind: "neg", arg } : arg;
    }
    return this.power();
  }

  private power(): Expr {
    const base = this.primary();
    const t = this.peek();
    if (t.t === "op" && t.op === "^") {
      this.next();
      // Right associative, and the exponent may carry its own sign: 2^-x.
      return { kind: "bin", op: "^", a: base, b: this.unary() };
    }
    return base;
  }

  private primary(): Expr {
    const t = this.next();
    switch (t.t) {
      case "num":
      case "const":
        return { kind: "num", value: t.value };
      case "x":
        return { kind: "x" };
      case "fn": {
        // sen(x) or sen x: without parentheses the function takes the next factor.
        const arg = this.peek().t === "(" ? this.primary() : this.power();
        return { kind: "call", fn: t.fn, arg };
      }
      case "(": {
        const e = this.sum();
        const close = this.next();
        if (close.t !== ")") throw new ParseError("Falta fechar o parêntese.", close.at);
        return e;
      }
      case "|": {
        this.openAbs++;
        const e = this.sum();
        this.openAbs--;
        const close = this.next();
        if (close.t !== "|") throw new ParseError("Falta fechar o módulo com |.", close.at);
        return { kind: "call", fn: "abs", arg: e };
      }
      case "end":
        throw new ParseError("A expressão termina antes da hora.", t.at);
      default:
        throw new ParseError("Não entendi esta parte.", t.at);
    }
  }
}

const FNS: Record<FnName, (v: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
};

/** Turns the tree into a function of x. Undefined points (√-1, 1/0) give NaN or ±Infinity. */
export function compile(e: Expr): (x: number) => number {
  switch (e.kind) {
    case "num": {
      const v = e.value;
      return () => v;
    }
    case "x":
      return (x) => x;
    case "neg": {
      const a = compile(e.arg);
      return (x) => -a(x);
    }
    case "call": {
      const a = compile(e.arg);
      const fn = FNS[e.fn];
      return (x) => fn(a(x));
    }
    case "bin": {
      const a = compile(e.a);
      const b = compile(e.b);
      switch (e.op) {
        case "+":
          return (x) => a(x) + b(x);
        case "-":
          return (x) => a(x) - b(x);
        case "*":
          return (x) => a(x) * b(x);
        case "/":
          return (x) => a(x) / b(x);
        case "^":
          return (x) => pow(a(x), b(x));
      }
    }
  }
}

/** Like Math.pow, but odd roots of negatives stay real: x^(1/3) at -8 is -2. */
function pow(base: number, exp: number): number {
  if (base < 0 && !Number.isInteger(exp)) {
    const inverse = 1 / exp;
    if (Number.isInteger(Math.round(inverse)) && Math.abs(inverse - Math.round(inverse)) < 1e-9 && Math.round(inverse) % 2 !== 0) {
      return -Math.pow(-base, exp);
    }
  }
  return Math.pow(base, exp);
}

/** Longest expression accepted, in characters. */
export const MAX_EXPR_LENGTH = 200;

export function parseExpr(text: string): ParseResult {
  if (text.length > MAX_EXPR_LENGTH) {
    return { ok: false, error: `Expressão longa demais (até ${MAX_EXPR_LENGTH} caracteres).`, at: MAX_EXPR_LENGTH };
  }
  try {
    const expr = new Parser(tokenize(text)).parse();
    return { ok: true, expr, fn: compile(expr) };
  } catch (err) {
    if (err instanceof ParseError) return { ok: false, error: err.message, at: err.at };
    throw err;
  }
}
