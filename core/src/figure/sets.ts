import { circleCircle, lineCircleParams, pointMap } from "./geometry";
import type { Element, FigureDoc, Id, Polygon, Region, VennItems } from "./types";
import { add, dist, dot, heading, lerp, perp, polar, scale, sub, unit, type Vec } from "./vec";

/**
 * Regions of Venn diagrams. An expression says, for any spot, whether it is in
 * the region. The boundary is found from that alone: the outlines of the sets
 * are cut where they cross, and a piece belongs to the boundary when the
 * region is on exactly one side of it. So any expression works, and the result
 * is one exact outline of arcs and lines for the SVG and the TikZ to share.
 */

export type SetExpr =
  | { k: "name"; name: string }
  | { k: "universe" }
  | { k: "union" | "inter" | "diff"; a: SetExpr; b: SetExpr }
  | { k: "comp"; a: SetExpr };

export type SetParse = { ok: true; expr: SetExpr; names: string[] } | { ok: false; error: string };

/** What the universe is called in expressions. */
const UNIVERSE_NAMES = new Set(["U", "Ω"]);

type Tok = { t: "name"; v: string } | { t: "union" | "inter" | "diff" | "comp" | "(" | ")" };

const WORD_OPS: [RegExp, "union" | "inter" | "diff"][] = [
  [/^(?:uni[aã]o)\b/iu, "union"],
  [/^(?:interse[cç][aã]o|inter)\b/iu, "inter"],
  [/^menos\b/iu, "diff"],
];

const SYMBOL_OPS: Record<string, "union" | "inter" | "diff" | "comp"> = {
  "∪": "union",
  "∩": "inter",
  "-": "diff",
  "−": "diff",
  "–": "diff",
  "\\": "diff",
  "∖": "diff",
  "'": "comp",
  "′": "comp",
  "ᶜ": "comp",
};

function tokenize(text: string): Tok[] | string {
  const out: Tok[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const rest = text.slice(i);
    if (/\s/.test(c)) i++;
    else if (SYMBOL_OPS[c]) {
      out.push({ t: SYMBOL_OPS[c] });
      i++;
    } else if (rest.startsWith("^c")) {
      out.push({ t: "comp" });
      i += 2;
    } else if (c === "(" || c === ")") {
      out.push({ t: c });
      i++;
    } else {
      const word = WORD_OPS.find(([re]) => re.test(rest));
      if (word) {
        out.push({ t: word[1] });
        i += word[0].exec(rest)![0].length;
        continue;
      }
      // Between two sets a lone U or n can only be an operator: keyboards have no ∪ or ∩.
      const last = out[out.length - 1];
      if (last && (last.t === "name" || last.t === ")" || last.t === "comp") && /^[uUnN](?![0-9₀-₉])/.test(rest)) {
        out.push({ t: /^[uU]/.test(rest) ? "union" : "inter" });
        i++;
        continue;
      }
      const name = /^[A-Za-zΑ-Ωα-ω][0-9₀-₉]*/u.exec(rest);
      if (!name) return `Não entendi "${c}". Use U, n, - e ' entre os nomes dos conjuntos.`;
      out.push({ t: "name", v: name[0] });
      i += name[0].length;
    }
  }
  return out;
}

/** Reads an expression like (A∪B)'∩C. The complement binds tightest, then ∩, then ∪ and −, left to right. */
export function parseSetExpr(text: string): SetParse {
  const tokens = tokenize(text);
  if (typeof tokens === "string") return { ok: false, error: tokens };
  if (tokens.length === 0) return { ok: false, error: "Escreva uma expressão com os conjuntos, como A∩B." };
  let i = 0;
  const names = new Set<string>();
  class Bad extends Error {}
  const atom = (): SetExpr => {
    const t = tokens[i++];
    if (!t) throw new Bad("A expressão termina antes da hora.");
    if (t.t === "(") {
      const e = sum();
      if (tokens[i++]?.t !== ")") throw new Bad("Falta fechar o parêntese.");
      return e;
    }
    if (t.t !== "name") throw new Bad("Falta o nome de um conjunto.");
    if (UNIVERSE_NAMES.has(t.v)) return { k: "universe" };
    names.add(t.v);
    return { k: "name", name: t.v };
  };
  const postfix = (): SetExpr => {
    let e = atom();
    while (tokens[i]?.t === "comp") {
      i++;
      e = { k: "comp", a: e };
    }
    return e;
  };
  const inter = (): SetExpr => {
    let e = postfix();
    while (tokens[i]?.t === "inter") {
      i++;
      e = { k: "inter", a: e, b: postfix() };
    }
    return e;
  };
  const sum = (): SetExpr => {
    let e = inter();
    for (let t = tokens[i]; t?.t === "union" || t?.t === "diff"; t = tokens[i]) {
      i++;
      e = { k: t.t, a: e, b: inter() };
    }
    return e;
  };
  try {
    const expr = sum();
    if (i < tokens.length) return { ok: false, error: "Não entendi o fim da expressão. Falta U, n ou - entre os conjuntos?" };
    return { ok: true, expr, names: [...names] };
  } catch (e) {
    if (e instanceof Bad) return { ok: false, error: e.message };
    throw e;
  }
}

/** Whether the expression needs a universe: a complement can't be drawn without one. */
export function usesUniverse(e: SetExpr): boolean {
  if (e.k === "comp" || e.k === "universe") return true;
  if (e.k === "name") return false;
  return usesUniverse(e.a) || usesUniverse(e.b);
}

function evaluate(e: SetExpr, inSet: (name: string) => boolean, inUniverse: boolean): boolean {
  switch (e.k) {
    case "name":
      return inSet(e.name);
    case "universe":
      return inUniverse;
    case "union":
      return evaluate(e.a, inSet, inUniverse) || evaluate(e.b, inSet, inUniverse);
    case "inter":
      return evaluate(e.a, inSet, inUniverse) && evaluate(e.b, inSet, inUniverse);
    case "diff":
      return evaluate(e.a, inSet, inUniverse) && !evaluate(e.b, inSet, inUniverse);
    case "comp":
      return inUniverse && !evaluate(e.a, inSet, inUniverse);
  }
}

export type SetShape = { kind: "circle"; c: Vec; r: number } | { kind: "poly"; vs: Vec[] };

export function shapeOf(el: Element | undefined, pts: ReturnType<typeof pointMap>): SetShape | null {
  if (el?.type === "circle") {
    const c = pts.get(el.center);
    return c ? { kind: "circle", c, r: el.radius } : null;
  }
  if (el?.type === "polygon") {
    const vs = el.vertices.map((id) => pts.get(id));
    return vs.every(Boolean) && vs.length >= 3 ? { kind: "poly", vs: vs as Vec[] } : null;
  }
  return null;
}

export function insideShape(s: SetShape, p: Vec): boolean {
  if (s.kind === "circle") return dist(s.c, p) < s.r;
  let inside = false;
  for (let i = 0, j = s.vs.length - 1; i < s.vs.length; j = i++) {
    const [a, b] = [s.vs[i], s.vs[j]];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Distance from p to the shape's outline. */
function distanceToOutline(s: SetShape, p: Vec): number {
  if (s.kind === "circle") return Math.abs(dist(s.c, p) - s.r);
  let best = Infinity;
  s.vs.forEach((a, i) => {
    const b = s.vs[(i + 1) % s.vs.length];
    const ab = sub(b, a);
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
    best = Math.min(best, dist(p, lerp(a, b, t)));
  });
  return best;
}

export type RegionEdge =
  | { kind: "line"; from: Vec; to: Vec }
  /** `start` and `sweep` in degrees; a positive sweep runs counterclockwise. */
  | { kind: "arc"; from: Vec; to: Vec; c: Vec; r: number; start: number; sweep: number };

const reversed = (e: RegionEdge): RegionEdge =>
  e.kind === "line" ? { ...e, from: e.to, to: e.from } : { ...e, from: e.to, to: e.from, start: e.start + e.sweep, sweep: -e.sweep };

/** Parameters, along the side a → b, where it crosses another outline. */
function sideCuts(a: Vec, b: Vec, other: SetShape): number[] {
  const within = (t: number) => t > 1e-9 && t < 1 - 1e-9;
  if (other.kind === "circle") return lineCircleParams(a, b, other.c, other.r).filter(within);
  const out: number[] = [];
  other.vs.forEach((c, i) => {
    const d = other.vs[(i + 1) % other.vs.length];
    const r = sub(b, a);
    const s = sub(d, c);
    const den = r.x * s.y - r.y * s.x;
    if (Math.abs(den) < 1e-12) return;
    const ac = sub(c, a);
    const t = (ac.x * s.y - ac.y * s.x) / den;
    const u = (ac.x * r.y - ac.y * r.x) / den;
    if (within(t) && u >= -1e-9 && u <= 1 + 1e-9) out.push(t);
  });
  return out;
}

/** Angles on the circle where it crosses another outline, from 0 up to 360. */
function circleCuts(c: Vec, r: number, other: SetShape): number[] {
  const angle = (p: Vec) => ((heading(sub(p, c)) % 360) + 360) % 360;
  if (other.kind === "circle") {
    if (dist(c, other.c) < 1e-9) return [];
    return (circleCircle(c, r, other.c, other.r) ?? []).map(angle);
  }
  const out: number[] = [];
  other.vs.forEach((a, i) => {
    const b = other.vs[(i + 1) % other.vs.length];
    for (const t of lineCircleParams(a, b, c, r)) if (t >= -1e-9 && t <= 1 + 1e-9) out.push(angle(lerp(a, b, t)));
  });
  return out;
}

function piecesOf(shape: SetShape, others: SetShape[]): RegionEdge[] {
  if (shape.kind === "circle") {
    const { c, r } = shape;
    const at = (deg: number) => add(c, polar(r, deg));
    const cuts = [...new Set(others.flatMap((o) => circleCuts(c, r, o)).map((a) => Math.round(a * 1e6) / 1e6))].sort((a, b) => a - b);
    if (cuts.length === 0) return [{ kind: "arc", from: at(0), to: at(0), c, r, start: 0, sweep: 360 }];
    return cuts.map((start, i) => {
      const next = cuts[(i + 1) % cuts.length];
      const sweep = ((next - start + 360) % 360) || 360;
      return { kind: "arc", from: at(start), to: at(next), c, r, start, sweep };
    });
  }
  return shape.vs.flatMap((a, i) => {
    const b = shape.vs[(i + 1) % shape.vs.length];
    const ts = [0, ...others.flatMap((o) => sideCuts(a, b, o)).sort((x, y) => x - y), 1];
    const out: RegionEdge[] = [];
    for (let j = 0; j + 1 < ts.length; j++) {
      if (ts[j + 1] - ts[j] > 1e-9) out.push({ kind: "line", from: lerp(a, b, ts[j]), to: lerp(a, b, ts[j + 1]) });
    }
    return out;
  });
}

/**
 * The closed loops that bound a region, with the region on the left of each.
 * Holes run the other way, so a nonzero fill leaves them empty.
 */
export function regionLoops(shapes: SetShape[], inRegion: (p: Vec) => boolean): RegionEdge[][] {
  const span = Math.max(
    1,
    ...shapes.flatMap((s) => (s.kind === "circle" ? [Math.abs(s.c.x) + s.r, Math.abs(s.c.y) + s.r] : s.vs.flatMap((v) => [Math.abs(v.x), Math.abs(v.y)]))),
  );
  const eps = span * 1e-6;
  const seen = new Set<string>();
  const edges: RegionEdge[] = [];
  shapes.forEach((shape, i) => {
    for (const piece of piecesOf(shape, shapes.filter((_, j) => j !== i))) {
      let m: Vec;
      let left: Vec;
      if (piece.kind === "line") {
        m = lerp(piece.from, piece.to, 0.5);
        left = unit(perp(sub(piece.to, piece.from)));
      } else {
        m = add(piece.c, polar(piece.r, piece.start + piece.sweep / 2));
        left = unit(sub(piece.c, m));
      }
      const onLeft = inRegion(add(m, scale(left, eps)));
      const onRight = inRegion(add(m, scale(left, -eps)));
      if (onLeft === onRight) continue;
      // Two sets drawn on the same outline would give the same piece twice.
      const key = `${Math.round(m.x / eps)},${Math.round(m.y / eps)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(onLeft ? piece : reversed(piece));
    }
  });

  const near = (a: Vec, b: Vec) => dist(a, b) < eps * 10;
  const loops: RegionEdge[][] = [];
  const unused = new Set(edges);
  while (unused.size > 0) {
    const first = unused.values().next().value as RegionEdge;
    unused.delete(first);
    const loop = [first];
    let end = first.to;
    while (!near(end, first.from)) {
      const next = [...unused].find((e) => near(e.from, end));
      if (!next) break;
      unused.delete(next);
      loop.push(next);
      end = next.to;
    }
    if (near(end, first.from)) loops.push(loop);
  }
  return loops;
}

/** Whether a spot is in the region, as the figure stands now, or null when a shape is missing. */
export function regionTest(doc: FigureDoc, region: Region): { shapes: SetShape[]; inside: (p: Vec) => boolean } | null {
  const parsed = parseSetExpr(region.expr);
  if (!parsed.ok) return null;
  const pts = pointMap(doc);
  const byId = new Map(doc.elements.map((e) => [e.id, e]));
  const named = new Map<string, SetShape>();
  for (const s of region.sets) {
    const shape = shapeOf(byId.get(s.shape), pts);
    if (!shape) return null;
    named.set(s.name, shape);
  }
  if (!parsed.names.every((n) => named.has(n))) return null;
  const universe = region.universe ? shapeOf(byId.get(region.universe), pts) : null;
  if (usesUniverse(parsed.expr) && !universe) return null;
  const inside = (p: Vec) => {
    const inU = universe ? insideShape(universe, p) : true;
    return inU && evaluate(parsed.expr, (n) => insideShape(named.get(n)!, p), inU);
  };
  return { shapes: [...named.values(), ...(universe ? [universe] : [])], inside };
}

/** The outline of a region, or none when its shapes are gone or it is empty. */
export function regionOutline(doc: FigureDoc, region: Region): RegionEdge[][] {
  const test = regionTest(doc, region);
  return test ? regionLoops(test.shapes, test.inside) : [];
}

/** The sets a Venn item belongs to, and the items of each region of the diagram. */
function itemsByRegion(el: VennItems, universe: Id | null): Map<string, { sets: Id[]; texts: string[] }> {
  const regions = new Map<string, { sets: Id[]; texts: string[] }>();
  const put = (sets: Id[], text: string) => {
    const sorted = [...sets].sort();
    const key = sorted.join(",");
    const region = regions.get(key) ?? { sets: sorted, texts: [] };
    if (!region.texts.includes(text)) region.texts.push(text);
    regions.set(key, region);
  };
  const all = new Set(el.members.flatMap((m) => m.items));
  for (const item of all) {
    put(el.members.filter((m) => m.set !== universe && m.items.includes(item)).map((m) => m.set), item);
  }
  for (const c of el.counts) put(c.in, c.text);
  return regions;
}

export function vennShapes(doc: FigureDoc): { sets: { id: Id; name: string; shape: SetShape }[]; universe: Polygon | null } {
  const pts = pointMap(doc);
  const sets: { id: Id; name: string; shape: SetShape }[] = [];
  let universe: Polygon | null = null;
  for (const el of doc.elements) {
    if (el.type === "polygon" && el.universe) universe = el;
    else if ((el.type === "circle" || el.type === "polygon") && el.label?.text) {
      const shape = shapeOf(el, pts);
      if (shape) sets.push({ id: el.id, name: el.label.text, shape });
    }
  }
  return { sets, universe };
}

/** Where to write each item: a world spot deep inside its region, plus an offset in pt for its place in the block. */
export function vennItemSpots(doc: FigureDoc, el: VennItems): { text: string; anchor: Vec; offset: Vec }[] {
  const { sets, universe } = vennShapes(doc);
  const pts = pointMap(doc);
  const universeShape = universe ? shapeOf(universe, pts) : null;
  const shapes = [...sets.map((s) => s.shape), ...(universeShape ? [universeShape] : [])];
  if (shapes.length === 0) return [];
  const corners = shapes.flatMap((s) => (s.kind === "circle" ? [add(s.c, { x: -s.r, y: -s.r }), add(s.c, { x: s.r, y: s.r })] : s.vs));
  const [x0, x1] = [Math.min(...corners.map((p) => p.x)), Math.max(...corners.map((p) => p.x))];
  const [y0, y1] = [Math.min(...corners.map((p) => p.y)), Math.max(...corners.map((p) => p.y))];
  const out: { text: string; anchor: Vec; offset: Vec }[] = [];
  const GRID = 60;
  for (const { sets: wanted, texts } of itemsByRegion(el, universe?.id ?? null).values()) {
    const inRegion = (p: Vec) =>
      (!universeShape || insideShape(universeShape, p)) && sets.every((s) => insideShape(s.shape, p) === wanted.includes(s.id));
    let best: Vec | null = null;
    let depth = 0;
    for (let i = 0; i <= GRID; i++) {
      for (let j = 0; j <= GRID; j++) {
        const p = { x: x0 + ((x1 - x0) * i) / GRID, y: y0 + ((y1 - y0) * j) / GRID };
        if (!inRegion(p)) continue;
        const d = Math.min(...shapes.map((s) => distanceToOutline(s, p)));
        if (d > depth) {
          depth = d;
          best = p;
        }
      }
    }
    if (!best) continue;
    const columns = Math.ceil(Math.sqrt(texts.length));
    const rows = Math.ceil(texts.length / columns);
    const width = Math.max(...texts.map((t) => Array.from(t).length)) * el.size * 0.55 + el.size * 0.7;
    const height = el.size * 1.35;
    texts.forEach((text, i) => {
      const row = Math.floor(i / columns);
      const inRow = row === rows - 1 ? texts.length - row * columns : columns;
      const column = i - row * columns;
      out.push({
        text,
        anchor: best,
        offset: { x: (column - (inRow - 1) / 2) * width, y: ((rows - 1) / 2 - row) * height },
      });
    });
  }
  return out;
}
