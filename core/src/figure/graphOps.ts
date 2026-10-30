import { DEFAULT_PLOT_WINDOW, DEFAULT_STYLES, LIMITS } from "./defaults";
import { pointMap, vanishedPoints } from "./geometry";
import { formatNumber, withText } from "./labels";
import { deleteElements, idMaker, LIMIT_ERROR, newAxes, type OpOptions, type OpResult } from "./ops";
import { graphFn, notablePoints } from "./plot";
import type { Element, FigureDoc, FunctionGraph, Id, Stroke, VerticalLine } from "./types";
import type { Vec } from "./vec";

/*
 * Editing steps for graphs that work on the whole figure: turning shapes into
 * functions, and tidying up after a graph changes.
 */

const fail = (doc: FigureDoc, error: string): OpResult => ({ doc, created: [], error });

/** A number as written in an expression: 2, -1/3 or 0,25, so it reads like the textbook. */
export function exprNumber(n: number): string {
  const r = Math.round(n * 1e9) / 1e9 || 0;
  if (Number.isInteger(r)) return String(r);
  for (const q of [2, 3, 4, 5, 6, 8, 10, 12]) {
    const p = Math.round(r * q);
    if (Math.abs(r * q - p) < 1e-9) return `${p}/${q}`;
  }
  return formatNumber(r, 9);
}

/** The line y = mx + q as typed by a teacher: 2x + 1, -x/2, 3x/4 - 1, or just 3. */
export function linearExpr(m: number, q: number): string {
  const slope = Math.round(m * 1e9) / 1e9 || 0;
  const shift = Math.round(q * 1e9) / 1e9 || 0;
  if (slope === 0) return exprNumber(shift);
  const a = exprNumber(Math.abs(slope));
  const [top, bottom] = a.includes("/") ? a.split("/") : [a, ""];
  const coef = top === "1" ? "x" : `${top}x`;
  const term = `${slope < 0 ? "-" : ""}${coef}${bottom ? `/${bottom}` : ""}`;
  if (shift === 0) return term;
  return `${term} ${shift > 0 ? "+" : "-"} ${exprNumber(Math.abs(shift))}`;
}

/** √(r² - (x - h)²), the half circle's root, written like raiz(4 - (x - 1)^2). */
function circleRoot(h: string, r2: string): string {
  const left = h.startsWith("-");
  const dx = h === "0" ? "x" : `(x ${left ? "+" : "-"} ${left ? h.slice(1) : h})`;
  return `raiz(${r2} - ${dx}^2)`;
}

/** Value of a number written by exprNumber, so the domain matches the expression exactly. */
function valueOf(text: string): number {
  return graphFn(text)?.(0) ?? Number.NaN;
}

type Piece = { kind: "line"; a: Vec; b: Vec; stroke: Stroke } | { kind: "circle"; c: Vec; r: number; stroke: Stroke };

const SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉";

/** f₁, f₂, … skipping names graphs and lines already have. */
function nextNames(doc: FigureDoc, count: number): string[] {
  const used = new Set(doc.elements.flatMap((e) => (e.type === "function" || e.type === "vline") && e.label ? [e.label.text] : []));
  const out: string[] = [];
  for (let i = 1; out.length < count; i++) {
    const name = `f${[...String(i)].map((d) => SUBSCRIPT[Number(d)]).join("")}`;
    if (!used.has(name)) out.push(name);
  }
  return out;
}

/** Pieces of the selection: segments, the sides of polygons, and whole circles. Ids to remove come along. */
function piecesOf(doc: FigureDoc, selection: Id[]): { pieces: Piece[]; remove: Id[]; arcs: number } {
  const pts = pointMap(doc);
  const selected = new Set(selection);
  const pieces: Piece[] = [];
  const remove: Id[] = [];
  const sides = new Set<string>();
  let arcs = 0;
  const side = (p: Id, q: Id, stroke: Stroke) => {
    const key = [p, q].sort().join(" ");
    const a = pts.get(p);
    const b = pts.get(q);
    if (sides.has(key) || !a || !b || (a.x === b.x && a.y === b.y)) return;
    sides.add(key);
    pieces.push({ kind: "line", a, b, stroke });
  };
  for (const el of doc.elements) {
    if (!selected.has(el.id)) continue;
    if (el.type === "segment") {
      side(el.a, el.b, el.stroke);
      remove.push(el.id);
    } else if (el.type === "circle") {
      const c = pts.get(el.center);
      if (el.arc) {
        arcs++;
        continue;
      }
      if (!c) continue;
      pieces.push({ kind: "circle", c, r: el.radius, stroke: el.stroke });
      remove.push(el.id);
    } else if (el.type === "polygon") {
      const stroke = el.stroke ?? DEFAULT_STYLES.stroke;
      el.vertices.forEach((v, i) => {
        const w = el.vertices[(i + 1) % el.vertices.length];
        side(v, w, stroke);
        // The side drawn as a segment goes too, or it would stay under its function.
        const seg = doc.elements.find((s) => s.type === "segment" && ((s.a === v && s.b === w) || (s.a === w && s.b === v)));
        if (seg) remove.push(seg.id);
      });
      remove.push(el.id);
    }
  }
  return { pieces, remove: [...new Set(remove)], arcs };
}

/**
 * Turns the selected segments, polygon sides and circles into graphs: a
 * segment into y = mx + q over its x span (a vertical one into the line
 * x = a over its y span), a circle into its upper and lower half,
 * y = k ± √(r² - (x - h)²). The shapes are replaced; their points stay.
 */
export function toFunctions(doc: FigureDoc, selection: Id[], opts: OpOptions = {}): OpResult {
  const { pieces, remove, arcs } = piecesOf(doc, selection);
  if (pieces.length === 0) {
    return fail(
      doc,
      arcs > 0
        ? "Arcos ainda não viram funções: selecione circunferências inteiras."
        : "Selecione segmentos, polígonos ou circunferências.",
    );
  }
  const graphCount = pieces.reduce((n, p) => n + (p.kind === "circle" ? 2 : 1), 0);
  const base = deleteElements(doc, remove).doc;
  const hasAxes = base.elements.some((e) => e.type === "axes");
  if (base.elements.length + graphCount + (hasAxes ? 0 : 1) > LIMITS.elements) return fail(doc, LIMIT_ERROR);

  const styles = opts.styles ?? DEFAULT_STYLES;
  const nextId = idMaker(base);
  const names = nextNames(base, graphCount);
  const made: Element[] = [];
  let n = 0;
  const label = (angle: number | null = null) => withText(undefined, names[n++], { ...styles.label, angle });
  // A small margin above and below, so the y cut never clips the piece.
  const around = (lo: number, hi: number): [number, number] => [lo - 1, hi + 1];

  for (const p of pieces) {
    if (p.kind === "line") {
      const { a, b } = p;
      if (Math.abs(b.x - a.x) < 1e-12) {
        const line: VerticalLine = {
          id: nextId("vline"),
          type: "vline",
          x: a.x,
          range: [Math.min(a.y, b.y), Math.max(a.y, b.y)],
          stroke: { ...p.stroke },
          label: label(),
        };
        made.push(line);
        continue;
      }
      const m = (b.y - a.y) / (b.x - a.x);
      made.push({
        id: nextId("function"),
        type: "function",
        expr: linearExpr(m, a.y - m * a.x),
        domain: [Math.min(a.x, b.x), Math.max(a.x, b.x)],
        range: around(Math.min(a.y, b.y), Math.max(a.y, b.y)),
        stroke: { ...p.stroke },
        label: label(),
      } satisfies FunctionGraph);
    } else {
      const h = exprNumber(p.c.x);
      const k = exprNumber(p.c.y);
      const r2 = exprNumber(p.r * p.r);
      // The domain comes from the written numbers, so √ reaches exactly 0 at both ends.
      const hv = valueOf(h);
      const reach = Math.sqrt(valueOf(r2));
      const root = circleRoot(h, r2);
      const halves: [string, number][] = [
        [k === "0" ? root : `${k} + ${root}`, 60],
        [k === "0" ? `-${root}` : `${k} - ${root}`, -60],
      ];
      for (const [expr, angle] of halves) {
        made.push({
          id: nextId("function"),
          type: "function",
          expr,
          domain: [hv - reach, hv + reach],
          range: around(p.c.y - p.r, p.c.y + p.r),
          stroke: { ...p.stroke },
          // Upper half named above its right end, lower half below, so the names don't sit on each other.
          label: label(angle),
        } satisfies FunctionGraph);
      }
    }
  }

  let elements = [...base.elements, ...made];
  if (!hasAxes) {
    const axes = newAxes(nextId("axes"));
    const xs = pieces.flatMap((p) => (p.kind === "line" ? [p.a.x, p.b.x] : [p.c.x - p.r, p.c.x + p.r]));
    const ys = pieces.flatMap((p) => (p.kind === "line" ? [p.a.y, p.b.y] : [p.c.y - p.r, p.c.y + p.r]));
    axes.x = [Math.min(DEFAULT_PLOT_WINDOW.x[0], Math.floor(Math.min(...xs)) - 1), Math.max(DEFAULT_PLOT_WINDOW.x[1], Math.ceil(Math.max(...xs)) + 1)];
    axes.y = [Math.min(DEFAULT_PLOT_WINDOW.y[0], Math.floor(Math.min(...ys)) - 1), Math.max(DEFAULT_PLOT_WINDOW.y[1], Math.ceil(Math.max(...ys)) + 1)];
    elements = [axes, ...elements];
  }
  const created = made.map((e) => e.id);
  return { doc: { ...base, elements }, created, selected: created };
}

export interface Settled {
  doc: FigureDoc;
  /** Names (or "" for unnamed) of the points deleted because what they marked is gone. */
  dropped: string[];
  /** Their ids, in the same order. */
  droppedIds: Id[];
  /** Graphs that now have more roots or turning points than are marked. */
  notes: string[];
}

const FEATURE_WORDS = { root: "raízes", extremum: "máximos e mínimos" } as const;

/**
 * Tidies a figure after an edit: points marking a crossing, root or turning
 * point that no longer exists are deleted, and graphs whose formula changed
 * are checked for new roots or turning points nobody marked yet.
 */
export function settleDoc(before: FigureDoc, after: FigureDoc): Settled {
  const gone = vanishedPoints(after);
  const doc = gone.length > 0 ? deleteElements(after, gone.map((p) => p.id)).doc : after;
  const dropped = gone.map((p) => p.label?.text ?? "");
  const droppedIds = gone.map((p) => p.id);
  const notes: string[] = [];
  const old = new Map(before.elements.map((e) => [e.id, e]));
  for (const el of doc.elements) {
    if (el.type !== "function") continue;
    const prev = old.get(el.id);
    if (!prev || prev.type !== "function" || (prev.expr === el.expr && prev.domain === el.domain && prev.range === el.range)) continue;
    for (const feature of ["root", "extremum"] as const) {
      const marked = doc.elements.filter(
        (p) => p.type === "point" && p.construction?.kind === "notable" && p.construction.graph === el.id && p.construction.feature === feature,
      ).length;
      const now = notablePoints(el, feature).length;
      if (marked > 0 && now > marked) {
        notes.push(`${el.label?.text || "O gráfico"} tem ${now} ${FEATURE_WORDS[feature]} agora; só ${marked} estão marcados.`);
      }
    }
  }
  return { doc, dropped, droppedIds, notes };
}
