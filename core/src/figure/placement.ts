import { angleArc, pointMap } from "./geometry";
import { estimateTextWidth, labelPlacement, labelText } from "./labels";
import { figureUnits } from "./plot";
import { buildScene, type Box } from "./render";
import type { Element, ElementType, FigureDoc, Id, Label } from "./types";
import type { Vec } from "./vec";

/**
 * Moves automatic labels off the lines and labels they would cover.
 *
 * Automatic placement only looks at the element itself: a point's name goes
 * away from its neighbors, a side's length goes outward, an angle's measure
 * goes along its bisector. So the 90° of a right angle lands on the height
 * drawn from it, and a long length crosses its own dashed line. This pass
 * tries nearby directions and distances for each label and keeps the one that
 * covers the least, preferring the automatic spot.
 *
 * Only labels that are automatic (angle null) and listed in `ids` move. A
 * label whose automatic spot is already clear stays automatic, so it keeps
 * following its element when the figure changes. A label that moves gets a
 * fixed angle and distance, like one set by hand.
 */
export function unclutterLabels(doc: FigureDoc, ids?: Iterable<Id>): FigureDoc {
  const wanted = ids ? new Set(ids) : null;
  const movable = doc.elements.filter(
    (e) => (!wanted || wanted.has(e.id)) && hasAutoLabel(e) && labelPlacement(doc, e) !== null,
  );
  if (movable.length === 0) return doc;

  const scene = buildScene(doc);
  const types = new Map(doc.elements.map((e) => [e.id, e.type] as const));
  const moving = new Set(movable.map((e) => e.id));
  const lines = new LineIndex();
  const taken: Box[] = [];
  for (const p of scene.prims) {
    const type = types.get(p.owner);
    if (p.kind === "text") {
      // Labels about to be placed don't block yet; everything else written on the figure does.
      if (!moving.has(p.owner)) taken.push(textBox(p, p.text, p.size));
      continue;
    }
    // The printed grid is under everything, and fills alone (a polygon's inside) are fine to write on.
    if (type === "grid" || (!p.stroke && type !== "point")) continue;
    for (const line of pathLines(p.d)) lines.add(line);
  }

  const O = (w: Vec, o: Vec): Vec => ({ x: w.x * scene.kx + o.x, y: -w.y * scene.ky - o.y });
  const order = [...movable].sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type]);
  const placed = new Map<Id, Label>();
  for (const el of order) {
    const label = el.label!;
    const text = labelText(doc, el);
    const boxAt = (candidate: Element): Box | null => {
      const at = labelPlacement(doc, candidate);
      return at ? textBox(O(at.anchor, at.offset), text, label.size) : null;
    };
    const cost = (box: Box) => lines.lengthIn(grow(box, PAD)) + overlap(box, taken) / label.size;

    const start = boxAt(el)!;
    const startCost = cost(start);
    let best = { box: start, cost: startCost, label: null as Label | null };
    if (startCost > CLEAR) {
      for (const c of candidates(doc, el, label)) {
        const moved = { ...label, angle: normalize(c.angle), distance: Math.max(0, c.distance) };
        const box = boxAt({ ...el, label: moved } as Element);
        if (!box) continue;
        const total = cost(box) + c.penalty;
        if (total < best.cost) best = { box, cost: total, label: moved };
      }
    }
    taken.push(best.box);
    if (best.label) placed.set(el.id, best.label);
  }
  if (placed.size === 0) return doc;
  return {
    ...doc,
    elements: doc.elements.map((e) => {
      const label = placed.get(e.id);
      return label ? ({ ...e, label } as Element) : e;
    }),
  };
}

/** Padding around a label's box, in pt, so text doesn't touch a line either. */
const PAD = 1.5;
/** Cover in pt of line below which a spot counts as clear. */
const CLEAR = 0.5;

/** Points first, since their names sit closest to the shapes; then marks, then the rest. */
const PRIORITY: Record<ElementType, number> = {
  point: 0,
  angle: 1,
  segment: 2,
  polygon: 3,
  circle: 4,
  function: 5,
  vline: 6,
  extension: 9,
  text: 9,
  axes: 9,
  grid: 9,
  numberline: 9,
};

function hasAutoLabel(el: Element): boolean {
  return "label" in el && !!el.label && el.label.angle === null;
}

interface Candidate {
  angle: number;
  distance: number;
  /** Cost of leaving the automatic spot, in pt of covered line. */
  penalty: number;
}

/** Other spots to try for a label, with what it costs to move there. */
function candidates(doc: FigureDoc, el: Element, label: Label): Candidate[] {
  const d = label.distance;
  const out: Candidate[] = [];
  const auto = labelPlacement(doc, el);
  const autoDir = auto && (auto.offset.x !== 0 || auto.offset.y !== 0) ? degrees(auto.offset) : 90;
  const farther = (angle: number, penalty: number, steps: number[]) => {
    for (const [i, extra] of steps.entries()) out.push({ angle, distance: d + extra, penalty: penalty + i * 0.4 });
  };

  switch (el.type) {
    case "point":
      for (let i = 1; i <= 15; i++) {
        const turn = Math.ceil(i / 2) * 22.5 * (i % 2 ? 1 : -1);
        farther(autoDir + turn, 0.3 * Math.ceil(i / 2), [0, 3]);
      }
      farther(autoDir, 0, [3, 6]);
      break;
    case "segment":
      for (const side of [0, 180]) {
        for (const tilt of [0, 20, -20, 40, -40]) {
          farther(autoDir + side + tilt, (side ? 2 : 0) + Math.abs(tilt) / 40, [0, 4, 8, 12, 18, 26]);
        }
      }
      break;
    case "angle": {
      const pts = pointMap(doc);
      const u = figureUnits(doc);
      const S = (p: Vec): Vec => ({ x: p.x * u.x, y: p.y * u.y });
      const a = pts.get(el.a);
      const v = pts.get(el.vertex);
      const b = pts.get(el.b);
      const arc = a && v && b ? angleArc(S(a), S(v), S(b), el.reflex) : null;
      if (!arc) break;
      for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        farther(arc.start + arc.sweep * t, Math.abs(t - 0.5) * 4, [0, 4, 8, 14, 20]);
      }
      break;
    }
    case "polygon":
      for (const [ring, distance] of [label.size * 1.2, label.size * 2.2, label.size * 3.2].entries()) {
        for (let i = 0; i < 8; i++) out.push({ angle: 90 - i * 45, distance, penalty: 1 + ring });
      }
      break;
    case "circle":
      for (let i = 1; i < 8; i++) out.push({ angle: (label.angle ?? 45) + i * 45, distance: d, penalty: 0.4 * i });
      break;
    case "function":
    case "vline":
      for (const turn of [45, -45, 90, -90, 135, -135, 180]) {
        farther(autoDir + turn, Math.abs(turn) / 45, [0, 4, 8]);
      }
      break;
  }
  return out;
}

function degrees(v: Vec): number {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI;
}

function normalize(deg: number): number {
  const r = Math.round((((deg % 360) + 360) % 360) * 10) / 10;
  return r === 360 ? 0 : r;
}

/** The box a label takes, as the scene writes it: centered on its point. */
function textBox(at: Vec, text: string, size: number): Box {
  const w = estimateTextWidth(text, size) / 2;
  return { minX: at.x - w, minY: at.y - size * 0.6, maxX: at.x + w, maxY: at.y + size * 0.6 };
}

function grow(b: Box, pad: number): Box {
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}

function overlap(box: Box, others: Box[]): number {
  let area = 0;
  for (const o of others) {
    const w = Math.min(box.maxX, o.maxX) - Math.max(box.minX, o.minX);
    const h = Math.min(box.maxY, o.maxY) - Math.max(box.minY, o.minY);
    if (w > 0 && h > 0) area += w * h;
  }
  return area;
}

type Line = [number, number, number, number];

/** Lines of a scene path, with arcs cut into short chords. */
export function pathLines(d: string): Line[] {
  const out: Line[] = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  for (const [, cmd, args] of d.matchAll(/([MLHVAZ])([^MLHVAZ]*)/g)) {
    const n = args.trim() === "" ? [] : args.trim().split(/[\s,]+/).map(Number);
    switch (cmd) {
      case "M":
        [x, y] = n;
        [sx, sy] = n;
        for (let i = 2; i + 1 < n.length; i += 2) {
          out.push([x, y, n[i], n[i + 1]]);
          [x, y] = [n[i], n[i + 1]];
        }
        break;
      case "L":
        for (let i = 0; i + 1 < n.length; i += 2) {
          out.push([x, y, n[i], n[i + 1]]);
          [x, y] = [n[i], n[i + 1]];
        }
        break;
      case "H":
        for (const nx of n) {
          out.push([x, y, nx, y]);
          x = nx;
        }
        break;
      case "V":
        for (const ny of n) {
          out.push([x, y, x, ny]);
          y = ny;
        }
        break;
      case "A":
        for (let i = 0; i + 6 < n.length; i += 7) {
          const [rx, ry, , large, sweep, ex, ey] = n.slice(i, i + 7);
          for (const p of arcPoints(x, y, rx, ry, large === 1, sweep === 1, ex, ey)) {
            out.push([x, y, p.x, p.y]);
            [x, y] = [p.x, p.y];
          }
        }
        break;
      case "Z":
        if (x !== sx || y !== sy) out.push([x, y, sx, sy]);
        [x, y] = [sx, sy];
        break;
    }
  }
  return out;
}

/** Points along an SVG arc with no rotation, ending at (ex, ey). See SVG 1.1, F.6.5. */
function arcPoints(x0: number, y0: number, rx: number, ry: number, large: boolean, sweep: boolean, ex: number, ey: number): Vec[] {
  if (rx === 0 || ry === 0 || (x0 === ex && y0 === ey)) return [{ x: ex, y: ey }];
  const hx = (x0 - ex) / 2;
  const hy = (y0 - ey) / 2;
  // Radii too small for the chord grow until they fit, as SVG does.
  const fit = (hx * hx) / (rx * rx) + (hy * hy) / (ry * ry);
  if (fit > 1) {
    rx *= Math.sqrt(fit);
    ry *= Math.sqrt(fit);
  }
  const num = rx * rx * ry * ry - rx * rx * hy * hy - ry * ry * hx * hx;
  const den = rx * rx * hy * hy + ry * ry * hx * hx;
  const root = Math.sqrt(Math.max(0, num / den)) * (large === sweep ? -1 : 1);
  const cx = (root * rx * hy) / ry + (x0 + ex) / 2;
  const cy = (-root * ry * hx) / rx + (y0 + ey) / 2;
  const t0 = Math.atan2((y0 - cy) / ry, (x0 - cx) / rx);
  let dt = Math.atan2((ey - cy) / ry, (ex - cx) / rx) - t0;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  const steps = Math.max(2, Math.ceil(Math.abs(dt) / (Math.PI / 18)));
  const out: Vec[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = t0 + (dt * i) / steps;
    out.push(i === steps ? { x: ex, y: ey } : { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  return out;
}

/** Lines bucketed on a coarse grid, so a box only checks the lines near it. */
class LineIndex {
  private cells = new Map<string, number[]>();
  private lines: Line[] = [];
  private seen: number[] = [];
  private stamp = 0;
  private static CELL = 24;

  add(line: Line) {
    const i = this.lines.push(line) - 1;
    this.seen.push(0);
    const [x0, y0, x1, y1] = line;
    this.cover(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), (key) => {
      const cell = this.cells.get(key);
      if (cell) cell.push(i);
      else this.cells.set(key, [i]);
    });
  }

  /** Total length of line inside the box. */
  lengthIn(b: Box): number {
    const stamp = ++this.stamp;
    let total = 0;
    this.cover(b.minX, b.minY, b.maxX, b.maxY, (key) => {
      for (const i of this.cells.get(key) ?? []) {
        if (this.seen[i] === stamp) continue;
        this.seen[i] = stamp;
        total += clippedLength(this.lines[i], b);
      }
    });
    return total;
  }

  private cover(minX: number, minY: number, maxX: number, maxY: number, visit: (key: string) => void) {
    const c = LineIndex.CELL;
    const x1 = Math.floor(maxX / c);
    const y1 = Math.floor(maxY / c);
    // A huge line (an axis across a big window) would visit many cells; that's still linear in its length.
    for (let cx = Math.floor(minX / c); cx <= x1; cx++) {
      for (let cy = Math.floor(minY / c); cy <= y1; cy++) visit(`${cx},${cy}`);
    }
  }
}

/** Length of a line inside a box (Liang–Barsky). */
function clippedLength([x0, y0, x1, y1]: Line, b: Box): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [
    [-dx, x0 - b.minX],
    [dx, b.maxX - x0],
    [-dy, y0 - b.minY],
    [dy, b.maxY - y0],
  ]) {
    if (p === 0) {
      if (q < 0) return 0;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return 0;
    }
  }
  return (t1 - t0) * Math.hypot(dx, dy);
}

