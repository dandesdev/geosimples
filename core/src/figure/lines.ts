import { estimateTextWidth } from "./labels";
import type { Box } from "./render";
import type { Vec } from "./vec";

/** Boxes and lines on paper, in pt: what label placement measures against. */

/** The box a label takes, as the scene writes it: centered on its point. */
export function textBox(at: Vec, text: string, size: number): Box {
  const w = estimateTextWidth(text, size) / 2;
  return { minX: at.x - w, minY: at.y - size * 0.6, maxX: at.x + w, maxY: at.y + size * 0.6 };
}

export function grow(b: Box, pad: number): Box {
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}

export function overlap(box: Box, others: Box[]): number {
  let area = 0;
  for (const o of others) {
    const w = Math.min(box.maxX, o.maxX) - Math.max(box.minX, o.minX);
    const h = Math.min(box.maxY, o.maxY) - Math.max(box.minY, o.minY);
    if (w > 0 && h > 0) area += w * h;
  }
  return area;
}
export type Line = [number, number, number, number];

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
export class LineIndex {
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
