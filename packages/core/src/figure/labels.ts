import { DEFAULT_LABEL } from "./defaults";
import { angleArc, centroid, pointMap } from "./geometry";
import type { Element, FigureDoc, Id, Label, LabelFont, Point } from "./types";
import { add, dist, len, mid, perp, polar, scale, sub, unit, type Vec } from "./vec";

/** Formats a number the Brazilian way: decimal comma, no trailing zeros. */
export function formatNumber(n: number, decimals = 2): string {
  const factor = 10 ** decimals;
  const rounded = Math.round(n * factor) / factor;
  const text = (Object.is(rounded, -0) ? 0 : rounded).toFixed(decimals);
  return text.replace(/\.?0+$/, "").replace(".", ",");
}

const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GREEK = "αβγδεζηθικλμνξοπρστυφχψω";

/** A, B, …, Z, AA, AB, … */
export function sequenceName(i: number, alphabet: string): string {
  const n = alphabet.length;
  return (i >= n ? sequenceName(Math.floor(i / n) - 1, alphabet) : "") + alphabet[i % n];
}

export type LabelScheme =
  | "latin"
  | "latin-lower"
  | "greek"
  | "numbered"
  | "coordinates"
  | "length"
  | "measure";

export function labelFor(
  scheme: LabelScheme,
  index: number,
  el: Element,
  doc: FigureDoc,
  decimals = 2,
): string | null {
  const pts = pointMap(doc);
  switch (scheme) {
    case "latin":
      return sequenceName(index, LATIN);
    case "latin-lower":
      return sequenceName(index, LATIN.toLowerCase());
    case "greek":
      return sequenceName(index, GREEK);
    case "numbered":
      return `P${index + 1}`;
    case "coordinates":
      return el.type === "point"
        ? `(${formatNumber(el.x, decimals)}; ${formatNumber(el.y, decimals)})`
        : null;
    case "length": {
      if (el.type !== "segment") return null;
      const a = pts.get(el.a);
      const b = pts.get(el.b);
      return a && b ? formatNumber(dist(a, b), decimals) : null;
    }
    case "measure": {
      if (el.type !== "angle") return null;
      const a = pts.get(el.a);
      const v = pts.get(el.vertex);
      const b = pts.get(el.b);
      const arc = a && v && b ? angleArc(a, v, b, el.reflex) : null;
      return arc ? `${formatNumber(arc.measure, Math.min(decimals, 1))}°` : null;
    }
  }
}

export function withText(label: Label | undefined, text: string, base: Omit<Label, "text"> = DEFAULT_LABEL): Label {
  return { ...(label ?? { ...base, text: "" }), text };
}

/** Next free point name: A, B, …, Z, AA, … skipping names already in use. */
export function nextPointNames(doc: FigureDoc, count: number, alsoTaken: string[] = []): string[] {
  const used = new Set([
    ...doc.elements.flatMap((e) => (e.type === "point" && e.label?.text ? [e.label.text] : [])),
    ...alsoTaken,
  ]);
  const names: string[] = [];
  for (let i = 0; names.length < count; i++) {
    const name = sequenceName(i, LATIN);
    if (!used.has(name)) {
      names.push(name);
      used.add(name);
    }
  }
  return names;
}

/** Where a label goes: a world anchor plus an offset in pt. */
export interface LabelPlacement {
  anchor: Vec;
  offset: Vec;
}

/** Neighbors of a point through segments and polygon edges. */
function neighborsOf(doc: FigureDoc, id: Id, pts: Map<Id, Point>): Vec[] {
  const out: Vec[] = [];
  for (const el of doc.elements) {
    if (el.type === "segment") {
      const other = el.a === id ? el.b : el.b === id ? el.a : null;
      const p = other ? pts.get(other) : undefined;
      if (p) out.push(p);
    } else if (el.type === "polygon") {
      const i = el.vertices.indexOf(id);
      if (i < 0) continue;
      const n = el.vertices.length;
      for (const j of [(i + n - 1) % n, (i + 1) % n]) {
        const p = pts.get(el.vertices[j]);
        if (p) out.push(p);
      }
    }
  }
  return out;
}

export function labelPlacement(doc: FigureDoc, el: Element): LabelPlacement | null {
  const label = el.label;
  if (!label || label.text === "") return null;
  const pts = pointMap(doc);
  const fixed = label.angle === null ? null : polar(1, label.angle);

  switch (el.type) {
    case "point": {
      let dir = fixed;
      if (!dir) {
        // Point away from the shapes that use this point, so A, B, C sit outside a triangle.
        const pull = neighborsOf(doc, el.id, pts).reduce(
          (acc, n) => add(acc, unit(sub(n, el))),
          { x: 0, y: 0 },
        );
        dir = len(pull) > 1e-6 ? unit(scale(pull, -1)) : { x: 0, y: 1 };
      }
      return { anchor: { x: el.x, y: el.y }, offset: scale(dir, label.distance + el.size) };
    }
    case "segment": {
      const a = pts.get(el.a);
      const b = pts.get(el.b);
      if (!a || !b) return null;
      const m = mid(a, b);
      let dir = fixed;
      if (!dir) {
        const normal = unit(perp(sub(b, a)));
        const c = centroid(Array.from(pts.values()));
        const away = sub(m, c);
        dir = len(away) > 1e-6 && away.x * normal.x + away.y * normal.y < 0 ? scale(normal, -1) : normal;
      }
      return { anchor: m, offset: scale(dir, label.distance) };
    }
    case "angle": {
      const a = pts.get(el.a);
      const v = pts.get(el.vertex);
      const b = pts.get(el.b);
      const arc = a && v && b ? angleArc(a, v, b, el.reflex) : null;
      if (!v || !arc) return null;
      const dir = fixed ?? polar(1, arc.start + arc.sweep / 2);
      const outer = el.radius + (el.arcs - 1) * 2.5;
      return { anchor: v, offset: scale(dir, outer + label.distance) };
    }
    case "circle": {
      const c = pts.get(el.center);
      if (!c) return null;
      const deg = label.angle ?? 45;
      return {
        anchor: add(c, polar(el.radius, deg)),
        offset: polar(label.distance, deg),
      };
    }
    case "polygon": {
      const vs = el.vertices.map((id) => pts.get(id)).filter((p): p is Point => !!p);
      if (vs.length < 3) return null;
      return { anchor: centroid(vs), offset: fixed ? scale(fixed, label.distance) : { x: 0, y: 0 } };
    }
  }
}

const GREEK_TEX: Record<string, string> = {
  α: "\\alpha", β: "\\beta", γ: "\\gamma", δ: "\\delta", ε: "\\varepsilon",
  ζ: "\\zeta", η: "\\eta", θ: "\\theta", ι: "\\iota", κ: "\\kappa",
  λ: "\\lambda", μ: "\\mu", ν: "\\nu", ξ: "\\xi", ο: "o", π: "\\pi",
  ρ: "\\rho", σ: "\\sigma", τ: "\\tau", υ: "\\upsilon", φ: "\\varphi",
  χ: "\\chi", ψ: "\\psi", ω: "\\omega",
  Γ: "\\Gamma", Δ: "\\Delta", Θ: "\\Theta", Λ: "\\Lambda", Ξ: "\\Xi",
  Π: "\\Pi", Σ: "\\Sigma", Φ: "\\Phi", Ψ: "\\Psi", Ω: "\\Omega",
};
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** Geometry symbols a teacher may type. pdflatex stops on them unless they become commands. */
const SYMBOL_TEX: Record<string, string> = {
  "∠": "\\angle", "△": "\\triangle", "⊥": "\\perp", "∥": "\\parallel", "≅": "\\cong",
  "≡": "\\equiv", "∼": "\\sim", "≈": "\\approx", "≠": "\\neq", "≤": "\\leq", "≥": "\\geq",
  "×": "\\times", "·": "\\cdot", "±": "\\pm", "−": "-", "∞": "\\infty", "→": "\\to",
  "∈": "\\in", "∩": "\\cap", "∪": "\\cup", "√": "\\surd",
};
const SYMBOLS = Object.keys(SYMBOL_TEX).join("");
/** Signs math mode already puts space around. */
const OPERATORS = "=+-≅≡∼≈≠≤≥×·±−→∈∩∪⊥∥";

const MATH_SAFE = new RegExp(`^[A-Za-z0-9α-ωΑ-Ω′'₀-₉⁰-⁹¹²³°,.;:()+\\-=\\s${SYMBOLS}]*$`, "u");

/**
 * How a label is typeset. Names and numbers (A', A₁, x², 3,5, 60°) are math,
 * like $A$ in LaTeX. Words ("2,5 cm", "setor") and sans-serif labels are text,
 * because math mode would set words in italic and ignore \sffamily.
 */
export function labelMode(text: string, font: LabelFont = "serif"): "math" | "text" {
  if (font === "sans") return "text";
  return MATH_SAFE.test(text) && !/[a-z]{2}/.test(text) ? "math" : "text";
}

/** A piece of label text with one style, for the SVG. */
export interface LabelRun {
  text: string;
  italic: boolean;
}

/**
 * Splits a label the way LaTeX sets it: in math, Latin letters and lowercase
 * Greek are italic, while digits, signs and uppercase Greek stay upright.
 */
export function labelRuns(text: string, font: LabelFont = "serif"): LabelRun[] {
  if (labelMode(text, font) === "text") return [{ text, italic: false }];
  const runs: LabelRun[] = [];
  for (const ch of Array.from(text)) {
    const italic = /[A-Za-zα-ω]/u.test(ch);
    const last = runs[runs.length - 1];
    if (last && last.italic === italic) last.text += ch;
    else runs.push({ text: ch, italic });
  }
  return runs;
}

/** Converts a plain label to LaTeX, in math or text mode as labelMode decides. */
export function labelToLatex(text: string, font: LabelFont = "serif"): string {
  return labelMode(text, font) === "math" ? `$${mathLatex(text)}$` : textLatex(text);
}

/** Reads a run of subscript or superscript digits starting at i. */
function scriptDigits(chars: string[], i: number, set: string): string {
  let digits = "";
  while (i < chars.length && set.includes(chars[i])) digits += set.indexOf(chars[i++]);
  return digits;
}

function mathLatex(text: string): string {
  let out = "";
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const command = GREEK_TEX[ch] ?? SYMBOL_TEX[ch];
    if (command) {
      // The space ends the command name (\pi r) and math mode ignores it.
      out += command + (i < chars.length - 1 ? " " : "");
    } else if (SUB.includes(ch) || SUP.includes(ch)) {
      const set = SUB.includes(ch) ? SUB : SUP;
      const digits = scriptDigits(chars, i, set);
      i += digits.length - 1;
      out += `${set === SUB ? "_" : "^"}{${digits}}`;
    } else if (ch === "°") {
      out += "^\\circ";
    } else if (ch === "′") {
      out += "'";
    } else if (ch === "," || ch === ";" || ch === ":") {
      // Braces stop math from adding its own space after punctuation, so 3,5
      // and (1; 2) are spaced as typed.
      out += `{${ch}}`;
    } else if (ch === " ") {
      // Math already spaces relations and signs (=, +, ≅) like a typed space would.
      if (!OPERATORS.includes(chars[i - 1] ?? "") && !OPERATORS.includes(chars[i + 1] ?? "")) out += "\\ ";
    } else {
      out += ch;
    }
  }
  return out;
}

function textLatex(text: string): string {
  let out = "";
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const command = GREEK_TEX[ch] ?? SYMBOL_TEX[ch];
    if (command) {
      out += `$${command}$`;
    } else if (SUB.includes(ch) || SUP.includes(ch)) {
      const set = SUB.includes(ch) ? SUB : SUP;
      const digits = scriptDigits(chars, i, set);
      i += digits.length - 1;
      out += `\\text${set === SUB ? "sub" : "super"}script{${digits}}`;
    } else if (ch === "°") {
      out += "$^\\circ$";
    } else if (ch === "′") {
      out += "'";
    } else if (ch === '"') {
      // Straight quotes become `` and '', which also keeps babel's " shorthands out.
      const prev = chars[i - 1];
      out += prev === undefined || /[\s([{]/.test(prev) ? "``" : "''";
    } else {
      out += TEXT_ESCAPES[ch] ?? ch;
    }
  }
  return out;
}

/** Characters that are LaTeX commands, or print as other glyphs in its default OT1 encoding (< as ¡). */
const TEXT_ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "^": "\\textasciicircum{}",
  "~": "$\\sim$",
  "<": "\\textless{}",
  ">": "\\textgreater{}",
  "|": "\\textbar{}",
  "{": "\\{",
  "}": "\\}",
  "#": "\\#",
  $: "\\$",
  "%": "\\%",
  "&": "\\&",
  _: "\\_",
};

/** Rough text width in pt, used to size the figure around labels. */
export function estimateTextWidth(text: string, size: number): number {
  return Array.from(text).length * size * 0.55;
}

