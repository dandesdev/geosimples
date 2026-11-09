import { estimateTextWidth, mathLatex } from "../labels";
import type { Dash } from "../types";
import type { Vec } from "../vec";

/**
 * What a board draws, in pt from its top left corner with Y up. The SVG and
 * the TikZ each write these marks, so both come out the same. Math stays a
 * tree until then: the SVG sets it from text and lines, and TikZ writes LaTeX.
 */

export type MathNode =
  | string
  /** Upright letters, like the MMC of "MMC = 12". */
  | { word: string }
  | { row: MathNode[] }
  | { frac: [MathNode, MathNode] }
  | { sqrt: MathNode }
  | { sup: [MathNode, MathNode] };

/** Results are what a "blank" board hides and a "gaps" board may leave as a box to fill in. */
export type MarkRole = "result" | "carry";

export type Mark =
  | { kind: "line"; a: Vec; b: Vec; width?: number; dash?: Dash; role?: MarkRole }
  | { kind: "curve"; points: Vec[]; width?: number; dash?: Dash; role?: MarkRole }
  | { kind: "text"; at: Vec; node: MathNode; size: number; role?: MarkRole }
  | { kind: "dot"; at: Vec; r: number; open: boolean; role?: MarkRole }
  | { kind: "ring"; at: Vec; r: number; role?: MarkRole }
  /** An arrowhead with its tip at `tip`, along `dir`. */
  | { kind: "head"; tip: Vec; dir: Vec; length: number }
  /** An empty square where a result was left out. */
  | { kind: "box"; at: Vec; w: number; h: number };

export interface MathBox {
  w: number;
  up: number;
  down: number;
  parts: MathPart[];
}

export type MathPart =
  | { kind: "text"; x: number; y: number; text: string; size: number; word: boolean }
  | { kind: "line"; a: Vec; b: Vec };

/** Spaces around signs are thin, as in math; a whole letter's width leaves them too far apart. */
function textWidth(text: string, size: number): number {
  const spaces = Array.from(text).filter((c) => c === " ").length;
  return estimateTextWidth(text.replace(/ /g, ""), size) + spaces * size * 0.24;
}

const shift = (parts: MathPart[], dx: number, dy: number): MathPart[] =>
  parts.map((p) =>
    p.kind === "text"
      ? { ...p, x: p.x + dx, y: p.y + dy }
      : { ...p, a: { x: p.a.x + dx, y: p.a.y + dy }, b: { x: p.b.x + dx, y: p.b.y + dy } },
  );

/** Lays math out from its left end, on its middle line at y = 0. */
export function layoutMath(node: MathNode, size: number): MathBox {
  if (typeof node === "string" || "word" in node) {
    const text = typeof node === "string" ? node : node.word;
    // Capitals in an upright word are wider than the average letter.
    const w = typeof node === "string" ? textWidth(text, size) : Array.from(text).reduce((acc, c) => acc + size * (/[A-Z]/.test(c) ? 0.75 : 0.5), 0);
    return { w, up: size * 0.55, down: size * 0.55, parts: [{ kind: "text", x: w / 2, y: 0, text, size, word: typeof node !== "string" }] };
  }
  if ("row" in node) {
    let w = 0;
    let up = 0;
    let down = 0;
    const parts: MathPart[] = [];
    for (const child of node.row) {
      const b = layoutMath(child, size);
      parts.push(...shift(b.parts, w, 0));
      w += b.w;
      up = Math.max(up, b.up);
      down = Math.max(down, b.down);
    }
    return { w, up, down, parts };
  }
  if ("frac" in node) {
    const inner = size * 0.85;
    const a = layoutMath(node.frac[0], inner);
    const b = layoutMath(node.frac[1], inner);
    const w = Math.max(a.w, b.w) + 2;
    const gap = 1.2;
    return {
      w,
      up: gap + a.down + a.up,
      down: gap + b.up + b.down,
      parts: [
        ...shift(a.parts, (w - a.w) / 2, gap + a.down),
        ...shift(b.parts, (w - b.w) / 2, -(gap + b.up)),
        { kind: "line", a: { x: 0, y: 0 }, b: { x: w, y: 0 } },
      ],
    };
  }
  if ("sqrt" in node) {
    const a = layoutMath(node.sqrt, size);
    const hook = size * 0.55;
    const top = a.up + 1.2;
    const w = hook + a.w + 1;
    return {
      w,
      up: top + 0.5,
      down: a.down,
      parts: [
        ...shift(a.parts, hook, 0),
        { kind: "line", a: { x: 0, y: -a.down * 0.1 }, b: { x: hook * 0.3, y: -a.down * 0.3 } },
        { kind: "line", a: { x: hook * 0.3, y: -a.down * 0.3 }, b: { x: hook * 0.55, y: -a.down } },
        { kind: "line", a: { x: hook * 0.55, y: -a.down }, b: { x: hook, y: top } },
        { kind: "line", a: { x: hook, y: top }, b: { x: w, y: top } },
      ],
    };
  }
  const base = layoutMath(node.sup[0], size);
  const exp = layoutMath(node.sup[1], size * 0.7);
  const lift = size * 0.42;
  return {
    w: base.w + exp.w,
    up: Math.max(base.up, lift + exp.up),
    down: base.down,
    parts: [...base.parts, ...shift(exp.parts, base.w, lift)],
  };
}

export const mathWidth = (node: MathNode, size: number) => layoutMath(node, size).w;

function inner(node: MathNode): string {
  if (typeof node === "string") return mathLatex(node);
  // \\mbox and not \\mathrm: math mode drops accented letters like the ç of Equação.
  if ("word" in node) return `\\mbox{${node.word}}`;
  if ("row" in node) return node.row.map(inner).join("");
  if ("frac" in node) return `\\frac{${inner(node.frac[0])}}{${inner(node.frac[1])}}`;
  if ("sqrt" in node) return `\\sqrt{${inner(node.sqrt)}}`;
  return `{${inner(node.sup[0])}}^{${inner(node.sup[1])}}`;
}

export const mathToLatex = (node: MathNode) => `$${inner(node)}$`;

export interface BoardLayout {
  marks: Mark[];
  box: { minX: number; minY: number; maxX: number; maxY: number };
}

/** The room the marks take. */
export function layoutOf(marks: Mark[]): BoardLayout {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  const at = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const m of marks) {
    switch (m.kind) {
      case "line":
        at(m.a.x, m.a.y);
        at(m.b.x, m.b.y);
        break;
      case "curve":
        for (const p of m.points) at(p.x, p.y);
        break;
      case "text": {
        const b = layoutMath(m.node, m.size);
        at(m.at.x - b.w / 2, m.at.y - b.down);
        at(m.at.x + b.w / 2, m.at.y + b.up);
        break;
      }
      case "dot":
      case "ring":
        at(m.at.x - m.r, m.at.y - m.r);
        at(m.at.x + m.r, m.at.y + m.r);
        break;
      case "head":
        at(m.tip.x, m.tip.y);
        break;
      case "box":
        at(m.at.x - m.w / 2, m.at.y - m.h / 2);
        at(m.at.x + m.w / 2, m.at.y + m.h / 2);
        break;
    }
  }
  return { marks, box: { minX, minY, maxX, maxY } };
}
