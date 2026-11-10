import { draft } from "./constructions";
import { distanceToLine, pointMap, projectOntoLine } from "./geometry";
import { DEFAULT_STYLES } from "./defaults";
import { selectedOfType, type OpOptions, type OpResult } from "./ops";
import type { FigureDoc, Id, Point, Stroke, Vector } from "./types";
import { add, cross, dist, scale, sub, unit, type Vec } from "./vec";

/** What the Vetores menu does with the selected vectors. */
export type VectorOperation = "sum" | "parallelogram" | "difference" | "projection" | "unit" | "components" | "scale";

const fail = (doc: FigureDoc, error: string): OpResult => ({ doc, created: [], error });

/** Two points closer than this are the same point. */
const SAME = 1e-9;

/** Names new vectors take, in order. */
const VECTOR_NAMES = ["u", "v", "w", "a", "b", "c", "d", "p", "q"];

function nextVectorName(doc: FigureDoc): string {
  const used = new Set(doc.elements.flatMap((e) => (e.type === "vector" && e.label ? [e.label.text] : [])));
  return VECTOR_NAMES.find((n) => !used.has(n)) ?? `v${used.size + 1}`.replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]);
}

const nameOf = (v: Vector) => v.label?.text ?? "";

/** Wider than the vectors it comes from, so a resultant stands out in print. */
function resultantStroke(opts: OpOptions, from: Stroke[]): Partial<Stroke> {
  const width = Math.max((opts.styles ?? DEFAULT_STYLES).stroke.width, ...from.map((s) => s.width));
  return { width: Math.round(width * 1.5 * 100) / 100 };
}

/** An arrow from each selected point to the next. */
export function makeVectors(doc: FigureDoc, selection: Id[], opts: OpOptions = {}): OpResult {
  const points = selectedOfType(doc, selection, "point");
  if (points.length < 2) return fail(doc, "Selecione ao menos dois pontos: a origem e depois a extremidade.");
  const d = draft(doc, opts);
  let coincident = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]];
    if (dist(a, b) < SAME) {
      coincident++;
      continue;
    }
    d.vector(a.id, b.id, nextVectorName(d.doc));
  }
  const made = d.result(coincident > 0 ? "Os pontos coincidem." : "Esse vetor já existe.");
  return made.error ? made : { ...made, doc: withoutTipDots(made.doc, made.created) };
}

/** The arrowhead marks the tip, so a dot under it goes, unless the point is also used by something else. */
function withoutTipDots(doc: FigureDoc, created: Id[]): FigureDoc {
  const fresh = new Set(created);
  const tips = new Set(doc.elements.flatMap((e) => (e.type === "vector" && fresh.has(e.id) ? [e.b] : [])));
  const usedElsewhere = (id: Id) =>
    doc.elements.some((e) => {
      if (e.type === "segment" || e.type === "vector") return (e.a === id && (e.type !== "vector" || !fresh.has(e.id))) || (e.b === id && e.type !== "vector");
      if (e.type === "polygon") return e.vertices.includes(id);
      if (e.type === "angle") return [e.a, e.vertex, e.b].includes(id);
      if (e.type === "circle") return e.center === id;
      return false;
    });
  return { ...doc, elements: doc.elements.map((e) => (e.type === "point" && tips.has(e.id) && !usedElsewhere(e.id) ? { ...e, shape: "none" as const } : e)) };
}

/** A vector of the given components or from existing points, as typed in the input bar. */
export function addVector(
  doc: FigureDoc,
  name: string,
  from: { id: Id } | Vec,
  to: { id: Id } | Vec,
  opts: OpOptions = {},
): OpResult {
  const d = draft(doc, opts);
  const hiddenAt = (spot: { id: Id } | Vec): Id => {
    if ("id" in spot) return spot.id;
    const near = pointMap(d.doc);
    for (const p of near.values()) if (dist(p, spot) < SAME) return p.id;
    return d.freePoint(spot);
  };
  const a = hiddenAt(from);
  const b = hiddenAt(to);
  const at = pointMap(d.doc);
  if (a === b || dist(at.get(a)!, at.get(b)!) < SAME) return fail(doc, "A origem e a extremidade coincidem: esse vetor não tem direção.");
  d.vector(a, b, name || nextVectorName(d.doc));
  return d.result("Esse vetor já existe.");
}

/** Sum by the polygon rule: each vector is carried to the tip of the one before. */
function sum(doc: FigureDoc, vectors: Vector[], opts: OpOptions): OpResult {
  if (vectors.length < 2) return fail(doc, "Selecione ao menos dois vetores, na ordem da soma.");
  const pts = pointMap(doc);
  const d = draft(doc, opts);
  const at = new Map(pts);
  const first = vectors[0];
  let tip = first.b;
  for (const v of vectors.slice(1)) {
    const [p, q] = [at.get(v.a)!, at.get(v.b)!];
    if (v.a === tip) {
      tip = v.b;
      continue;
    }
    const spot = add(at.get(tip)!, sub(q, p));
    const carried = d.point(spot, { kind: "translate", point: tip, by: [v.a, v.b], factor: 1 }, true);
    at.set(carried, { ...at.get(tip)!, ...spot, id: carried });
    d.vector(tip, carried, nameOf(v), v.notation, v.stroke);
    tip = carried;
  }
  if (dist(at.get(first.a)!, at.get(tip)!) < SAME) return fail(doc, "A soma desses vetores é nula: não há seta para desenhar.");
  const name = vectors.every(nameOf) ? vectors.map(nameOf).join(" + ") : "R";
  d.vector(first.a, tip, name, "arrow", resultantStroke(opts, vectors.map((v) => v.stroke)));
  return d.result("Essa soma já existe.");
}

/** Sum by the parallelogram rule: both from the same tail, with the two dashed sides that close it. */
function parallelogram(doc: FigureDoc, vectors: Vector[], opts: OpOptions): OpResult {
  if (vectors.length !== 2) return fail(doc, "Selecione exatamente dois vetores.");
  const [u, v] = vectors;
  const pts = pointMap(doc);
  const [ua, ub, va, vb] = [pts.get(u.a)!, pts.get(u.b)!, pts.get(v.a)!, pts.get(v.b)!];
  const du = sub(ub, ua);
  const dv = sub(vb, va);
  if (Math.abs(cross(du, dv)) < SAME) return fail(doc, "Os vetores são paralelos e não formam paralelogramo. Use a regra do polígono.");
  const d = draft(doc, opts);
  let side = v.b;
  if (v.a !== u.a) {
    side = d.point(add(ua, dv), { kind: "translate", point: u.a, by: [v.a, v.b], factor: 1 }, true);
    d.vector(u.a, side, nameOf(v), v.notation, v.stroke);
  }
  const tip = d.point(add(ub, dv), { kind: "translate", point: u.b, by: [v.a, v.b], factor: 1 }, true);
  d.segment(u.b, tip, { dash: "dashed" });
  d.segment(side, tip, { dash: "dashed" });
  const name = nameOf(u) && nameOf(v) ? `${nameOf(u)} + ${nameOf(v)}` : "R";
  d.vector(u.a, tip, name, "arrow", resultantStroke(opts, [u.stroke, v.stroke]));
  return d.result("Essa soma já existe.");
}

/** u − v, from the tip of v to the tip of u once both start at the same point. */
function difference(doc: FigureDoc, vectors: Vector[], opts: OpOptions): OpResult {
  if (vectors.length !== 2) return fail(doc, "Selecione dois vetores: primeiro o minuendo, depois o subtraendo.");
  const [u, v] = vectors;
  const pts = pointMap(doc);
  const [ua, ub, va, vb] = [pts.get(u.a)!, pts.get(u.b)!, pts.get(v.a)!, pts.get(v.b)!];
  const dv = sub(vb, va);
  if (dist(sub(ub, ua), dv) < SAME) return fail(doc, "Os vetores são iguais: a diferença é nula.");
  const d = draft(doc, opts);
  let tail = v.b;
  if (v.a !== u.a) {
    tail = d.point(add(ua, dv), { kind: "translate", point: u.a, by: [v.a, v.b], factor: 1 }, true);
    d.vector(u.a, tail, nameOf(v), v.notation, { ...v.stroke, dash: "dashed" });
  }
  const name = nameOf(u) && nameOf(v) ? `${nameOf(u)} − ${nameOf(v)}` : "d";
  d.vector(tail, u.b, name, "arrow", resultantStroke(opts, [u.stroke, v.stroke]));
  return d.result("Essa diferença já existe.");
}

/** The first vector projected on the line of the second, with the dashed perpendiculars and right-angle mark. */
function projection(doc: FigureDoc, vectors: Vector[], opts: OpOptions): OpResult {
  if (vectors.length !== 2) return fail(doc, "Selecione dois vetores: primeiro o que será projetado, depois a direção.");
  const [u, v] = vectors;
  const pts = pointMap(doc);
  const [ua, ub, va, vb] = [pts.get(u.a)!, pts.get(u.b)!, pts.get(v.a)!, pts.get(v.b)!];
  const d = draft(doc, opts);
  const foot = (p: Point): Id => {
    if (distanceToLine(p, va, vb) < SAME) return p.id;
    const id = d.point(projectOntoLine(p, va, vb), { kind: "foot", point: p.id, line: [v.a, v.b] }, true);
    d.segment(p.id, id, { dash: "dashed" });
    return id;
  };
  const fa = foot(ua);
  const fb = foot(ub);
  const at = pointMap(d.doc);
  if (dist(at.get(fa)!, at.get(fb)!) < SAME) return fail(doc, "Os vetores são perpendiculares: a projeção é nula.");
  for (const [p, f] of [[u.b, fb], [u.a, fa]] as const) {
    if (p === f) continue;
    d.rightAngle(p, f, dist(at.get(f)!, va) > SAME ? v.a : v.b);
    d.extension([v.a, v.b], f);
  }
  d.vector(fa, fb, nameOf(u) ? `${nameOf(u)}′` : "", "arrow", resultantStroke(opts, [u.stroke]));
  return d.result("Essa projeção já existe.");
}

/** The vector of length 1 in the direction of each selected vector, from the same tail. */
function versors(doc: FigureDoc, vectors: Vector[], opts: OpOptions): OpResult {
  if (vectors.length === 0) return fail(doc, "Selecione um vetor.");
  const pts = pointMap(doc);
  const d = draft(doc, opts);
  for (const v of vectors) {
    const [a, b] = [pts.get(v.a)!, pts.get(v.b)!];
    const tip = d.point(add(a, unit(sub(b, a))), { kind: "unit", of: [v.a, v.b], from: v.a }, true);
    d.vector(v.a, tip, nameOf(v), "hat", { ...v.stroke });
  }
  return d.result("Esse versor já existe.");
}

/** The horizontal and vertical components of each selected vector, closed by dashed lines. */
function components(doc: FigureDoc, vectors: Vector[], opts: OpOptions): OpResult {
  if (vectors.length === 0) return fail(doc, "Selecione um vetor.");
  const pts = pointMap(doc);
  const d = draft(doc, opts);
  for (const v of vectors) {
    const [a, b] = [pts.get(v.a)!, pts.get(v.b)!];
    const add1 = (x: Point, y: Point, xId: Id, yId: Id, axis: string) => {
      if (dist({ x: x.x, y: y.y }, a) < SAME || dist({ x: x.x, y: y.y }, b) < SAME) return;
      const tip = d.point({ x: x.x, y: y.y }, { kind: "corner", x: xId, y: yId }, true);
      d.segment(v.b, tip, { dash: "dashed" });
      d.vector(v.a, tip, nameOf(v) ? `${nameOf(v)}_${axis}` : "", v.notation, { ...v.stroke });
    };
    add1(b, a, v.b, v.a, "x");
    add1(a, b, v.a, v.b, "y");
  }
  return d.result("Esse vetor já está na direção de um eixo, ou as componentes já existem.");
}

/** k times the selected vector, from the same tail. Its k is set afterwards in Propriedades. */
function multiple(doc: FigureDoc, vectors: Vector[], k: number, opts: OpOptions): OpResult {
  if (vectors.length === 0) return fail(doc, "Selecione um vetor.");
  const pts = pointMap(doc);
  const d = draft(doc, opts);
  for (const v of vectors) {
    const [a, b] = [pts.get(v.a)!, pts.get(v.b)!];
    const tip = d.point(add(a, scale(sub(b, a), k)), { kind: "translate", point: v.a, by: [v.a, v.b], factor: k }, true);
    d.vector(v.a, tip, nameOf(v) ? `${k}${nameOf(v)}` : "", v.notation, { ...v.stroke });
  }
  return d.result("Esse múltiplo já existe.");
}

export function vectorOp(doc: FigureDoc, selection: Id[], op: VectorOperation, opts: OpOptions = {}, k = 2): OpResult {
  const vectors = selectedOfType(doc, selection, "vector");
  switch (op) {
    case "sum":
      return sum(doc, vectors, opts);
    case "parallelogram":
      return parallelogram(doc, vectors, opts);
    case "difference":
      return difference(doc, vectors, opts);
    case "projection":
      return projection(doc, vectors, opts);
    case "unit":
      return versors(doc, vectors, opts);
    case "components":
      return components(doc, vectors, opts);
    case "scale":
      return multiple(doc, vectors, k, opts);
  }
}

/** The versors î and ĵ from the origin. */
export function addBasis(doc: FigureDoc, opts: OpOptions = {}): OpResult {
  const d = draft(doc, opts);
  const at = (spot: Vec): Id => {
    for (const p of pointMap(d.doc).values()) if (dist(p, spot) < SAME) return p.id;
    return d.freePoint(spot);
  };
  const o = at({ x: 0, y: 0 });
  d.vector(o, at({ x: 1, y: 0 }), "i", "hat");
  d.vector(o, at({ x: 0, y: 1 }), "j", "hat");
  return d.result("Os versores i e j já existem.");
}
