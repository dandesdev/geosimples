import { DEFAULT_LABEL } from "./defaults";
import { angleArc, centroid, pointMap, signedArea2 } from "./geometry";
import type {
  Element,
  ElementType,
  FigureDoc,
  Id,
  Label,
  LabelMeasure,
  MeasureKind,
  Point,
} from "./types";
import { add, dist, len, mid, perp, polar, scale, sub, unit, type Vec } from "./vec";

/** Formats a number the Brazilian way: decimal comma, no trailing zeros. */
export function formatNumber(n: number, decimals = 2): string {
  const factor = 10 ** decimals;
  const rounded = Math.round(n * factor) / factor;
  const text = (Object.is(rounded, -0) ? 0 : rounded).toFixed(decimals);
  // Only zeros after the decimal point go: 90 with no decimals stays 90.
  return (text.includes(".") ? text.replace(/\.?0+$/, "") : text).replace(".", ",");
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

/** A label with static text. A live measure on the old label is dropped. */
export function withText(label: Label | undefined, text: string, base: Omit<Label, "text"> = DEFAULT_LABEL): Label {
  const next: Label = { ...(label ?? { ...base, text: "" }), text };
  delete next.measure;
  return next;
}

/** Measures each element type offers for live labels, the first being the usual one. */
export const MEASURES: Record<ElementType, readonly MeasureKind[]> = {
  point: [],
  segment: ["length"],
  angle: ["angle"],
  circle: ["radius"],
  polygon: ["area", "perimeter"],
  text: [],
};

/** Value of a measure in world units (degrees for angles), or null when it can't be measured. */
export function measureValue(doc: FigureDoc, el: Element, kind: MeasureKind): number | null {
  if (!MEASURES[el.type].includes(kind)) return null;
  const pts = pointMap(doc);
  switch (el.type) {
    case "segment": {
      const a = pts.get(el.a);
      const b = pts.get(el.b);
      return a && b ? dist(a, b) : null;
    }
    case "angle": {
      const a = pts.get(el.a);
      const v = pts.get(el.vertex);
      const b = pts.get(el.b);
      return (a && v && b && angleArc(a, v, b, el.reflex)?.measure) ?? null;
    }
    case "circle":
      return el.radius;
    case "polygon": {
      const vs = el.vertices.map((id) => pts.get(id)).filter((p): p is Point => !!p);
      if (vs.length < 3) return null;
      if (kind === "area") return Math.abs(signedArea2(vs)) / 2;
      return vs.reduce((acc, p, i) => acc + dist(p, vs[(i + 1) % vs.length]), 0);
    }
    default:
      return null;
  }
}

/** The number of a measure as shown: "5,3" or "60°". */
export function measureNumber(doc: FigureDoc, el: Element, m: LabelMeasure): string | null {
  const value = measureValue(doc, el, m.kind);
  if (value === null) return null;
  return formatNumber(value, m.decimals) + (m.kind === "angle" ? "°" : "");
}

/** A new live measure label setting, with the element's usual measure. */
export function newMeasure(el: Element, decimals: number): LabelMeasure | null {
  const kind = MEASURES[el.type][0];
  return kind ? { kind, decimals: Math.max(0, Math.min(4, Math.round(decimals))), prefix: "", suffix: "" } : null;
}

/** The text a label shows now: its measure computed from the figure, or its static text. */
export function labelText(doc: FigureDoc, el: Element): string {
  if (el.type === "text" || !el.label) return "";
  const m = el.label.measure;
  if (!m) return el.label.text;
  const value = measureNumber(doc, el, m);
  return value === null ? "" : m.prefix + value + m.suffix;
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
  if (el.type === "text") return null;
  const label = el.label;
  if (!label || labelText(doc, el) === "") return null;
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

/** Single letters with primes or subscripts are typeset in italic, like $A$ in LaTeX. */
export function isMathLabel(text: string): boolean {
  return /^[A-Za-zα-ωΑ-Ω][′'₀-₉]*$/u.test(text);
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

/**
 * Converts a plain label to LaTeX. Letters, numbers and measures go in math
 * mode (A', A₁, 3,5, 60°). Anything else is escaped text.
 */
export function labelToLatex(text: string): string {
  const body = mathBody(text);
  return body === null ? escapeLatex(text) : `$${body}$`;
}

/**
 * LaTeX of a free text. Only a single name like x or A₁ goes in math mode,
 * so "Figura 1" stays upright like in the preview.
 */
export function textToLatex(text: string): string {
  return isMathLabel(text) ? labelToLatex(text) : escapeLatex(text);
}

/**
 * LaTeX of a live measure label. The number is always math; a prefix like
 * "x = " joins it when it is math too, and units like " cm" stay upright.
 */
export function measureToLatex(m: LabelMeasure, number: string): string {
  const value = mathBody(number) ?? "";
  const unit = m.suffix === "" ? "" : `\\textrm{${escapeLatex(m.suffix)}}`;
  const prefix = m.prefix === "" ? "" : mathBody(m.prefix);
  if (prefix === null) return `${escapeLatex(m.prefix)}$${value}${unit}$`;
  return `$${prefix}${value}${unit}$`;
}

/** Math-mode LaTeX for text made of letters, numbers and measure signs, or null for other text. */
function mathBody(text: string): string | null {
  const mathSafe = /^[A-Za-z0-9α-ωΑ-Ω′'₀-₉⁰-⁹¹²³°,.;:()+\-=\s]*$/u;
  if (!mathSafe.test(text)) return null;
  let out = "";
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (GREEK_TEX[ch]) {
      out += GREEK_TEX[ch] + (/[A-Za-z]/.test(chars[i + 1] ?? "") ? " " : "");
    } else if (SUB.includes(ch)) {
      let digits = "";
      while (i < chars.length && SUB.includes(chars[i])) digits += SUB.indexOf(chars[i++]);
      i--;
      out += `_{${digits}}`;
    } else if (SUP.includes(ch)) {
      let digits = "";
      while (i < chars.length && SUP.includes(chars[i])) digits += SUP.indexOf(chars[i++]);
      i--;
      out += `^{${digits}}`;
    } else if (ch === "°") {
      out += "^\\circ";
    } else if (ch === "′") {
      out += "'";
    } else if (ch === ",") {
      // A decimal comma needs braces in math mode to avoid extra space.
      out += /\d/.test(chars[i + 1] ?? "") ? "{,}" : ",";
    } else if (ch === " ") {
      out += "\\ ";
    } else {
      out += ch;
    }
  }
  return out;
}

function escapeLatex(text: string): string {
  return text.replace(/[\\{}#$%&_^~]/g, (ch) => {
    switch (ch) {
      case "\\":
        return "\\textbackslash{}";
      case "^":
        return "\\textasciicircum{}";
      case "~":
        return "\\textasciitilde{}";
      default:
        return `\\${ch}`;
    }
  });
}

/** Rough text width in pt, used to size the figure around labels. */
export function estimateTextWidth(text: string, size: number): number {
  return Array.from(text).length * size * 0.55;
}

