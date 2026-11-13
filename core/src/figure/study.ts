import { parseExpr, type Expr } from "../plot";
import { degree, polyRoots, qNum, rationalOf, type Root } from "./board/exact";
import { layoutMath, layoutOf, mathWidth, type Mark, type MathNode } from "./board/marks";
import { joinRelationSigns } from "./board/relation";
import type { Locale } from "./messages";
import type { Id, Study, StudyAxis, StudyBall, StudyPoint, StudySketch } from "./types";
import type { Vec } from "./vec";

/**
 * Estudo na reta: a number line with critical points and what goes around
 * them, as stored pieces the teacher fills in. Here: reading what was typed,
 * writing typed text as math, naming the pieces, and laying them out as
 * board marks, which the SVG and the TikZ both write.
 */

export const MAX_STUDY_POINTS = 10;
export const MAX_STUDY_SKETCHES = 6;
export const MAX_STUDY_TEXT = 60;

/** The least width of a stretch between points, in font sizes. */
export const STUDY_STRETCH = 5;
/** Bounds in pt for a stretch's least width and for how far a divider goes past its usual length. */
export const STUDY_LIMITS = { width: [6, 2000], drop: [-200, 2000] } as const;
/** How far a divider goes under the line, in font sizes, before its own `drop`. */
const DIVIDER = 6;

// ---------------------------------------------------------------------------
// Typed text as math

/**
 * What the teacher typed, with the signs a keyboard lacks: <= becomes ≤, ^2
 * becomes ², a minus is a real minus, and relations and sums get their spaces.
 */
export function prettyMath(typed: string): string {
  let s = joinRelationSigns(typed)
    .replace(/!=|=\/=/g, "≠")
    .replace(/\^2/g, "²")
    .replace(/\^3/g, "³")
    .replace(/\b(?:sqrt|raiz)\s*(?=[(\d])/gi, "√")
    .replace(/\b(?:infinito|inf)\b/gi, "∞")
    .replace(/\bpi\b/gi, "π")
    .replace(/\*/g, "·");
  // A hyphen between two letters joins a word; anywhere else it is a minus.
  s = s.replace(/-/g, (_, at: number, all: string) => (/\p{L}/u.test(all[at - 1] ?? "") && /\p{L}/u.test(all[at + 1] ?? "") ? "-" : "−"));
  s = s.replace(/\s*([≤≥<>=≠])\s*/g, " $1 ");
  // + and − after something they add to are binary; at the start or after a sign, they stay close.
  s = s.replace(/([\p{L}\p{N}²³)∞π′'])\s*([+−])\s*/gu, "$1 $2 ");
  return s.replace(/\s+/g, " ").trim();
}

const OPERAND = /\([^()]*\)|√?(?:\([^()]*\)|[\p{L}\p{N},.²³π∞′'₀-₉]+)/uy;

const unwrap = (token: string) => (token.startsWith("(") && token.endsWith(")") ? token.slice(1, -1) : token);

function operandNode(token: string): MathNode {
  if (token.startsWith("√")) return { sqrt: mathOf(unwrap(token.slice(1))) };
  if (token.startsWith("(")) return { row: ["(", mathOf(token.slice(1, -1)), ")"] };
  return token;
}

/** Typed math as a tree: a/b is a fraction and √3 a root; the rest stays text. */
function mathOf(s: string): MathNode {
  const items: MathNode[] = [];
  let text = "";
  const push = (node: MathNode) => {
    if (typeof node === "string") {
      text += node;
      return;
    }
    // Spaces at the end of a text are dropped when drawn; leading ones are kept as room, so they go first in their own piece.
    const tail = /\s+$/.exec(text)?.[0] ?? "";
    if (text.length > tail.length) items.push(text.slice(0, text.length - tail.length));
    if (tail) items.push(tail);
    text = "";
    items.push(node);
  };
  let i = 0;
  while (i < s.length) {
    OPERAND.lastIndex = i;
    const m = OPERAND.exec(s);
    if (!m) {
      text += s[i];
      i++;
      continue;
    }
    i += m[0].length;
    const slash = /^\s*\/\s*/.exec(s.slice(i));
    if (slash) {
      OPERAND.lastIndex = i + slash[0].length;
      const d = OPERAND.exec(s);
      if (d) {
        i = OPERAND.lastIndex;
        push({ frac: [mathOf(unwrap(m[0])), mathOf(unwrap(d[0]))] });
        continue;
      }
    }
    push(operandNode(m[0]));
  }
  if (text) items.push(text);
  return items.length === 1 ? items[0] : { row: items };
}

/** How a study writes a text the teacher typed. */
export const studyMath = (typed: string): MathNode => mathOf(prettyMath(typed));

/** Math written back as the teacher would type it, for a label they can edit. */
export function mathText(node: MathNode): string {
  if (typeof node === "string") return node;
  if ("word" in node) return node.word;
  if ("delim" in node) return node.delim;
  if ("row" in node) return node.row.map(mathText).join("");
  const wrap = (n: MathNode) => {
    const t = mathText(n);
    return /^[\p{L}\p{N},.√π]+$/u.test(t) ? t : `(${t})`;
  };
  if ("frac" in node) return `${wrap(node.frac[0])}/${wrap(node.frac[1])}`;
  if ("sqrt" in node) return `√${wrap(node.sqrt)}`;
  return `${wrap(node.sup[0])}^${wrap(node.sup[1])}`;
}

// ---------------------------------------------------------------------------
// Reading what was typed

/** A study as typed, before it gets ids and looks. Sketch roots are indexes into `points`. */
export interface StudySpec {
  points: { label: string }[];
  intervals: string[];
  sketches: { shape: StudySketch["shape"]; up: boolean; roots: number[]; label: string }[];
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** A curve to sketch, typed with x and some operation; a bare name like x₁ is a point's name instead. */
const looksLikeCurve = (item: string) => /x/i.test(item) && /[-+−^²³*/()|]/.test(item);

/** Each stretch as an interval of x, from the names of the points: x < a, a ≤ x < b, x ≥ b. */
export const intervalTexts = (labels: string[]): string[] => {
  if (labels.length === 0) return ["ℝ"];
  return [
    `x < ${labels[0]}`,
    ...labels.slice(1).map((label, i) => `${labels[i]} ≤ x < ${label}`),
    `x ≥ ${labels[labels.length - 1]}`,
  ];
};

function readCurves(items: string[], locale: Locale): StudySpec | string {
  if (items.length > MAX_STUDY_SKETCHES) return `Use até ${MAX_STUDY_SKETCHES} expressões.`;
  const curves: { label: string; up: boolean; shape: StudySketch["shape"]; roots: Root[] }[] = [];
  for (const item of items) {
    // A module is sketched by what is inside it, as the critical points are its zeros.
    const inside = item.replace(/^\s*\|(.*)\|\s*$/, "$1").trim();
    const parsed = parseExpr(inside);
    if (!parsed.ok) return `Não entendi ${item}: ${parsed.error}`;
    const r = rationalOf(parsed.expr as Expr);
    const d = r && degree(r.den) === 0 ? degree(r.num) : -1;
    if (!r || d < 1 || d > 2) return "No estudo, use expressões do 1º ou do 2º grau, como x-2 ou x²-5x+4.";
    const lead = qNum(r.num[d]) / qNum(r.den[0]);
    curves.push({ label: prettyMath(inside), up: lead > 0, shape: d === 1 ? "line" : "parabola", roots: polyRoots(r.num, locale) });
  }
  const all: Root[] = [];
  for (const root of curves.flatMap((c) => c.roots).sort((a, b) => a.value - b.value)) {
    if (!all.some((o) => Math.abs(o.value - root.value) < 1e-9)) all.push(root);
  }
  if (all.length > MAX_STUDY_POINTS) return `Essas expressões dão mais de ${MAX_STUDY_POINTS} pontos críticos.`;
  // Cut to what a study keeps, so the figure reads back from a file as it was made.
  const fit = (text: string) => text.slice(0, MAX_STUDY_TEXT);
  const labels = all.map((root) => fit(prettyMath(mathText(root.node))));
  const indexOf = (root: Root) => all.findIndex((o) => Math.abs(o.value - root.value) < 1e-9);
  return {
    points: labels.map((label) => ({ label })),
    intervals: intervalTexts(labels).map(fit),
    sketches: curves.map((c) => ({ shape: c.shape, up: c.up, label: fit(c.label), roots: c.roots.map(indexOf) })),
  };
}

/**
 * Reads `estudo …`: `estudo ?; ?; ?` has three blank points, `estudo a; b; c`
 * names them, and `estudo x-2; x²-5x+4` puts the zeros of the curves on the
 * line, sketches them and writes each stretch as an interval of x.
 * Null when the text isn't a study; a string says what is wrong.
 */
export function readStudy(source: string, locale: Locale = "pt-BR"): StudySpec | string | null {
  const head = /^([\p{L}]+)(?:\s+(.*))?$/su.exec(source.trim());
  if (!head || fold(head[1]) !== "estudo") return null;
  const rest = (head[2] ?? "").trim();
  if (rest === "") return { points: [{ label: "" }, { label: "" }], intervals: ["", "", ""], sketches: [] };
  const items = rest.includes(";") ? rest.split(";").map((t) => t.trim()) : looksLikeCurve(rest) ? [rest] : rest.split(/\s+/);
  const named = items.filter((t) => t !== "");
  if (named.length > 0 && named.every(looksLikeCurve)) return readCurves(named, locale);
  if (items.length > MAX_STUDY_POINTS) return `Use até ${MAX_STUDY_POINTS} pontos.`;
  if (items.some((t) => t.length > MAX_STUDY_TEXT)) return `Use nomes de até ${MAX_STUDY_TEXT} caracteres.`;
  return {
    points: items.map((t) => ({ label: t === "?" ? "" : t })),
    intervals: items.map(() => "").concat(""),
    sketches: [],
  };
}

// ---------------------------------------------------------------------------
// Pieces

/**
 * A piece of a study, by a path the selection keeps: `point:<id>`,
 * `divider:<id>`, `sketch:<id>`, and `interval:<id>` for the stretch after a
 * point (`interval:start` before the first). Ids, not positions, so a point
 * put in elsewhere leaves the selected piece where it is. These name pieces of
 * the study's own line; a piece of a line further in will be the path to that
 * line, then `/`, then the piece, so a path with a `/` is none of these.
 */
export type StudyPiece =
  | { kind: "point"; point: StudyPoint; index: number }
  | { kind: "divider"; point: StudyPoint; index: number }
  | { kind: "interval"; index: number }
  | { kind: "sketch"; sketch: StudySketch };

export const studyPaths = {
  point: (id: Id) => `point:${id}`,
  divider: (id: Id) => `divider:${id}`,
  sketch: (id: Id) => `sketch:${id}`,
  /** The stretch at `index`: 0 is before the first point. */
  interval: (study: Study, index: number) => `interval:${index === 0 ? "start" : study.axis.points[index - 1]?.id}`,
};

/** The piece a path names, or null when it is gone. */
export function studyPiece(study: Study, path: string): StudyPiece | null {
  if (path.includes("/")) return null;
  const [kind, key] = path.split(":") as [string, string | undefined];
  if (key === undefined) return null;
  if (kind === "point" || kind === "divider") {
    const index = study.axis.points.findIndex((p) => p.id === key);
    return index < 0 ? null : { kind, point: study.axis.points[index], index };
  }
  if (kind === "interval") {
    const index = key === "start" ? 0 : study.axis.points.findIndex((p) => p.id === key) + 1;
    return index <= 0 && key !== "start" ? null : { kind, index };
  }
  if (kind === "sketch") {
    const sketch = study.axis.sketches.find((s) => s.id === key);
    return sketch ? { kind, sketch } : null;
  }
  return null;
}

/** Every piece, in reading order: each stretch, then its point and divider, left to right; the sketches last. */
export function studyPieces(study: Study): string[] {
  const out = [studyPaths.interval(study, 0)];
  study.axis.points.forEach((p, i) => {
    out.push(studyPaths.point(p.id));
    if (p.divider) out.push(studyPaths.divider(p.id));
    out.push(studyPaths.interval(study, i + 1));
  });
  return [...out, ...study.axis.sketches.map((s) => studyPaths.sketch(s.id))];
}

/** What a piece is, for the panel's trail, like "Ponto 2 (b)". */
export function studyPieceName(study: Study, path: string): string {
  const piece = studyPiece(study, path);
  if (!piece) return "";
  const named = (base: string, text: string) => (text.trim() ? `${base} (${prettyMath(text)})` : base);
  switch (piece.kind) {
    case "point":
      return named(`Ponto ${piece.index + 1}`, piece.point.label);
    case "divider":
      return named(`Divisória do ponto ${piece.index + 1}`, piece.point.label);
    case "interval":
      return named(`Intervalo ${piece.index + 1}`, study.axis.intervals[piece.index] ?? "");
    case "sketch":
      return named(piece.sketch.shape === "line" ? "Esboço da reta" : "Esboço da parábola", piece.sketch.label);
  }
}

/** The text a piece shows and the teacher can type over, or null when it has none (a divider). */
export function studyPieceText(study: Study, path: string): string | null {
  const piece = studyPiece(study, path);
  if (!piece) return null;
  if (piece.kind === "point") return piece.point.label;
  if (piece.kind === "interval") return study.axis.intervals[piece.index] ?? "";
  if (piece.kind === "sketch") return piece.sketch.label;
  return null;
}

// ---------------------------------------------------------------------------
// Layout

/** Where a piece can be picked in the preview, in pt from the study's corner, Y up. */
export type StudyHit =
  | { kind: "rect"; minX: number; minY: number; maxX: number; maxY: number }
  | { kind: "line"; a: Vec; b: Vec }
  | { kind: "curve"; points: Vec[] };

export interface StudyPieceShape {
  path: string;
  hit: StudyHit;
  /** It has a text to type and none yet: the preview shows where it would go. */
  empty: boolean;
  /** Where its text is, for typing over it in place. */
  text?: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface StudyLayout {
  /** The marks of each piece; `part` null for what belongs to the study itself, like the line. */
  groups: { part: string | null; marks: Mark[] }[];
  /** A piece may show more than once; each place it shows has its own shape. */
  pieces: StudyPieceShape[];
  /** The points and the bottom of their dividers, for dragging them. */
  points: { id: Id; x: number; bottom: number | null }[];
  /** The middle of each stretch, on the line, for putting a point in it. */
  stretches: { index: number; x: number }[];
  box: { minX: number; minY: number; maxX: number; maxY: number };
}

/** The width of each stretch: the least set, or more for its text and the names on its ends. */
export function stretchWidths(study: Study): number[] {
  const s = study.size;
  const half = (p: StudyPoint | undefined) => (p && p.label.trim() ? mathWidth(studyMath(p.label), s) / 2 : 0);
  return study.axis.intervals.map((text, i) => {
    const words = text.trim() ? mathWidth(studyMath(text), s) + s : 0;
    // The names of its ends stand on the same row as its text, so they take room beside it.
    const names = half(study.axis.points[i - 1]) + half(study.axis.points[i]) + s * 0.8;
    return Math.max(study.axis.widths[i] ?? s * STUDY_STRETCH, words + names - (words > 0 ? s * 0.4 : 0), names);
  });
}

/** The automatic length of a divider under the line, in pt. */
export const dividerLength = (study: Study) => study.size * DIVIDER;

/** The height a sketch reaches over and under the line. */
const reach = (study: Study) => study.size * 2.2;

/** Points of a sketch over [left, right], in runs that stay within its reach. */
function sketchRuns(sketch: StudySketch, xs: Map<Id, number>, left: number, right: number, ref: number, top: number): Vec[][] {
  const sign = sketch.up ? 1 : -1;
  const roots = sketch.roots.map((id) => xs.get(id)).filter((x): x is number => x !== undefined);
  let f: ((x: number) => number) | null = null;
  if (sketch.shape === "line" && roots.length >= 1) {
    const m = (sign * top) / (ref * 1.1);
    f = (x) => m * (x - roots[0]);
  } else if (sketch.shape === "parabola" && roots.length >= 2) {
    const [a, b] = [Math.min(roots[0], roots[1]), Math.max(roots[0], roots[1])];
    const half = Math.max((b - a) / 2, 1);
    const c = (sign * top * 0.75) / (half * half);
    f = (x) => c * (x - a) * (x - b);
  } else if (sketch.shape === "parabola" && roots.length === 1) {
    const c = (sign * top) / (ref * 1.1) ** 2;
    f = (x) => c * (x - roots[0]) ** 2;
  } else if (sketch.shape === "parabola") {
    const mid = (left + right) / 2;
    const half = Math.max((right - left) / 2, 1);
    f = (x) => sign * (top * 0.35 + top * 0.6 * ((x - mid) / half) ** 2);
  }
  if (!f) return [];
  const SAMPLES = 160;
  const runs: Vec[][] = [];
  let run: Vec[] = [];
  let prev: Vec | null = null;
  for (let k = 0; k <= SAMPLES; k++) {
    const x = left + ((right - left) * k) / SAMPLES;
    const p = { x, y: f(x) };
    const inside = Math.abs(p.y) <= top;
    if (prev && inside !== Math.abs(prev.y) <= top) {
      // Where the curve crosses its reach, so it ends exactly there.
      const edge = Math.sign(inside ? prev.y : p.y) * top;
      const t = (edge - prev.y) / (p.y - prev.y);
      run.push({ x: prev.x + (p.x - prev.x) * t, y: edge });
      if (!inside) {
        runs.push(run);
        run = [];
      }
    }
    if (inside) run.push(p);
    prev = p;
  }
  runs.push(run);
  return runs.filter((r) => r.length > 1);
}

const rectOf = (at: Vec, w: number, h: number, pad = 2) => ({ minX: at.x - w / 2 - pad, minY: at.y - h / 2 - pad, maxX: at.x + w / 2 + pad, maxY: at.y + h / 2 + pad });

/** Lays the study out in pt from its top left corner, Y up. */
export function studyLayout(study: Study): StudyLayout {
  const s = study.size;
  const widths = stretchWidths(study);
  // Each point sits at the end of the stretch before it.
  const xs: number[] = [];
  let end = 0;
  for (const w of widths) {
    end += w;
    xs.push(end);
  }
  xs.pop();
  const byId = new Map(study.axis.points.map((p, i) => [p.id, xs[i]]));
  const top = reach(study);
  const sketched = study.axis.sketches.length > 0;
  // Rows over the line, from it up: the sketches, the stretch texts, then the dividers' tops with the
  // points' names on them, so nothing crowds the line.
  const textRow = sketched ? top + s * 2 : s * 1.6;
  const dividerTop = textRow + s * 1.0;
  const nameAt = (p: StudyPoint, x: number): Vec => ({ x, y: p.divider ? dividerTop + s * 0.75 : s * 1.05 });
  const groups: StudyLayout["groups"] = [];
  const pieces: StudyPieceShape[] = [];
  const text = (at: Vec, typed: string): Mark => ({ kind: "text", at, node: studyMath(typed), size: s });
  const textBox = (at: Vec, typed: string, placeholder: number) => {
    if (!typed.trim()) return rectOf(at, placeholder, s * 1.1, 0);
    const b = layoutMath(studyMath(typed), s);
    return { minX: at.x - b.w / 2, minY: at.y - b.down, maxX: at.x + b.w / 2, maxY: at.y + b.up };
  };

  // The line and its arrow belong to the study itself.
  groups.push({
    part: null,
    marks: [
      { kind: "line", a: { x: 0, y: 0 }, b: { x: end, y: 0 } },
      { kind: "head", tip: { x: end + 6, y: 0 }, dir: { x: 1, y: 0 }, length: 6, open: true },
    ],
  });

  const points: StudyLayout["points"] = [];
  study.axis.points.forEach((p, i) => {
    const x = xs[i];
    if (!p.divider) {
      points.push({ id: p.id, x, bottom: null });
      return;
    }
    const bottom = -Math.max(dividerLength(study) + p.drop, s);
    points.push({ id: p.id, x, bottom });
    const path = studyPaths.divider(p.id);
    const a = { x, y: dividerTop };
    const b = { x, y: bottom };
    groups.push({ part: path, marks: [{ kind: "line", a, b }] });
    pieces.push({ path, hit: { kind: "line", a, b }, empty: false });
  });

  // The stretches' texts first: the names of the sketches keep clear of them.
  /** What a sketch's name keeps clear of. A line in the way (`thin`) needs no gap beside it, as text does. */
  const taken: { minX: number; minY: number; maxX: number; maxY: number; thin?: boolean }[] = [];
  // Texts side by side need a gap, or two names read as one; a line's height has room over and under the letters.
  const gap = s * 0.6;
  const room = s * 0.15;
  const overlaps = (r: (typeof taken)[number]) =>
    taken.some((t) => {
      const g = t.thin ? s * 0.15 : gap;
      return r.minX < t.maxX + g && r.maxX > t.minX - g && r.minY + room < t.maxY - room && r.maxY - room > t.minY + room;
    });
  const stretches: StudyLayout["stretches"] = [];
  const intervalGroups: StudyLayout["groups"] = [];
  let left = 0;
  widths.forEach((w, i) => {
    const middle = left + w / 2;
    stretches.push({ index: i, x: middle });
    left += w;
    const path = studyPaths.interval(study, i);
    const typed = study.axis.intervals[i] ?? "";
    const at = { x: middle, y: textRow };
    if (typed.trim()) intervalGroups.push({ part: path, marks: [text(at, typed)] });
    const box = textBox(at, typed, Math.min(w - s, s * 3));
    if (typed.trim()) taken.push(box);
    pieces.push({ path, hit: { kind: "rect", ...box }, empty: !typed.trim(), text: box });
  });

  // The names of the points too.
  study.axis.points.forEach((p, i) => {
    if (p.label.trim()) taken.push(textBox(nameAt(p, xs[i]), p.label, 0));
    // A divider is in the way of a sketch's name too.
    if (p.divider) taken.push({ minX: xs[i], minY: -Math.max(dividerLength(study) + p.drop, s), maxX: xs[i], maxY: dividerTop, thin: true });
  });

  const ref = widths.length > 0 ? end / widths.length : s * STUDY_STRETCH;
  // Every curve first, so each name keeps clear of the others' curves too.
  const drawnSketches = study.axis.sketches
    .map((sketch) => ({ sketch, runs: sketchRuns(sketch, byId, s * 0.4, end - s * 0.4, ref, top) }))
    .filter((d) => d.runs.length > 0);
  for (const { sketch, runs } of drawnSketches) {
    const path = studyPaths.sketch(sketch.id);
    // Thinner than the line, and dashed or dotted if asked: a sketch, not the line itself.
    const marks: Mark[] = runs.map((run) => ({ kind: "curve", points: run, width: study.width * 0.7, dash: study.sketchDash }));
    runs.forEach((run) => pieces.push({ path, hit: { kind: "curve", points: run }, empty: false }));
    const pad = s * 0.3;
    const crosses = (r: (typeof taken)[number]) =>
      drawnSketches.some(
        (d) => d.sketch !== sketch && d.runs.some((run) => run.some((p) => p.x > r.minX - pad && p.x < r.maxX + pad && p.y > r.minY && p.y < r.maxY)),
      );
    // The name goes by the curve's right end, on the side it ends: over the tip, past it a little toward
    // the line, nearer the line, before the tip, then further out, wherever no other text or curve is.
    const last = runs[runs.length - 1];
    const tip = last[last.length - 1];
    const away = tip.y >= 0 ? 1 : -1;
    const w = sketch.label.trim() ? mathWidth(studyMath(sketch.label), s) : s * 2;
    const right = tip.x + w / 2 + s * 0.35;
    const left = tip.x - w / 2 - s * 0.35;
    const spots = [
      // Over the tip, going on to the right, as written by hand.
      { x: tip.x + w / 2 + s * 0.15, y: tip.y + away * s * 0.8 },
      ...[-0.25, -1.4, -2.55].map((k) => ({ x: right, y: tip.y + away * s * k })),
      ...[0.3, -0.9].map((k) => ({ x: left, y: tip.y + away * s * k })),
      ...[-0.25, -1.4].flatMap((k) => [1.5, 3].map((more) => ({ x: right + s * more, y: tip.y + away * s * k }))),
      ...[1.0, 2.15, 3.3].map((k) => ({ x: right, y: tip.y + away * s * k })),
    ].filter((p) => Math.abs(p.y) >= s * 0.7 || p.y * away > 0);
    // The first spot that is clear; when none is, the one in the way of the least.
    const cost = (spot: Vec) => {
      const b = textBox(spot, sketch.label, s * 2);
      return (overlaps(b) ? 2 : 0) + (crosses(b) ? 1 : 0);
    };
    const at = spots.find((spot) => cost(spot) === 0) ?? spots.reduce((best, spot) => (cost(spot) < cost(best) ? spot : best), spots[0]);
    const box = textBox(at, sketch.label, s * 2);
    taken.push(box);
    if (sketch.label.trim()) marks.push(text(at, sketch.label));
    pieces.push({ path, hit: { kind: "rect", ...box }, empty: !sketch.label.trim(), text: box });
    groups.push({ part: path, marks });
  }

  // The dots go over the curves.
  study.axis.points.forEach((p, i) => {
    const x = xs[i];
    const path = studyPaths.point(p.id);
    const r = s * 0.2;
    const marks: Mark[] = p.ball === "none" ? [] : [{ kind: "dot", at: { x, y: 0 }, r, open: p.ball === "open" }];
    const at = nameAt(p, x);
    if (p.label.trim()) marks.push(text(at, p.label));
    groups.push({ part: path, marks });
    const label = textBox(at, p.label, s * 0.9);
    pieces.push({
      path,
      hit: { kind: "rect", minX: Math.min(label.minX, x - r - 3), minY: -r - 3, maxX: Math.max(label.maxX, x + r + 3), maxY: label.maxY },
      empty: !p.label.trim(),
      text: label,
    });
  });
  groups.push(...intervalGroups);

  const drawn = layoutOf(groups.flatMap((g) => g.marks)).box;
  return { groups, pieces, points, stretches, box: drawn };
}

// ---------------------------------------------------------------------------
// Building

/** A new point's looks: a filled dot, and a divider if its neighbors have one. */
export function newStudyPoint(id: Id, label: string, divider = false): StudyPoint {
  return { id, label, ball: "closed", divider, drop: 0 };
}

/** The next free id with `prefix` among `taken`. */
export function nextStudyId(prefix: string, taken: { id: Id }[]): Id {
  const used = new Set(taken.map((t) => t.id));
  for (let n = taken.length + 1; ; n++) if (!used.has(`${prefix}${n}`)) return `${prefix}${n}`;
}

/** The pieces of a study from what was typed. */
export function studyFromSpec(spec: StudySpec, size: number): StudyAxis {
  const points = spec.points.map((p, i) => newStudyPoint(`p${i + 1}`, p.label, false));
  return {
    points,
    intervals: spec.intervals,
    widths: spec.intervals.map(() => size * STUDY_STRETCH),
    sketches: spec.sketches.map((sk, i) => ({
      id: `s${i + 1}`,
      shape: sk.shape,
      up: sk.up,
      roots: sk.roots.map((r) => points[r].id),
      label: sk.label,
    })),
  };
}

/** The balls a point can show, for the panel. */
export const STUDY_BALLS: StudyBall[] = ["closed", "open", "none"];
