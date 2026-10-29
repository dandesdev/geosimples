/**
 * Turns y = f(x) into polylines to draw, in world units. Sampling is
 * adaptive: it splits where the curve bends, breaks the line where f is
 * undefined (√ of a negative) or jumps (1/x, tan x), and cuts it where it
 * leaves the visible y range, so no vertical line crosses an asymptote.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface SampleOptions {
  /** Uniform steps before refining. */
  steps?: number;
  /** Largest gap (world units) allowed between the curve and its chord. */
  tolerance?: number;
  /** How many times a step may be halved. */
  depth?: number;
}

const finite = (y: number) => Number.isFinite(y);

/**
 * The curve of `fn` over `domain`, as separate polylines, inside `range` (y).
 * Points are rounded to 1/1000 of a unit: they end up in saved TikZ.
 */
export function sampleFunction(
  fn: (x: number) => number,
  domain: [number, number],
  range: [number, number],
  options: SampleOptions = {},
): Pt[][] {
  const [x0, x1] = domain[0] <= domain[1] ? domain : [domain[1], domain[0]];
  const [yMin, yMax] = range[0] <= range[1] ? range : [range[1], range[0]];
  if (!(x1 > x0) || !(yMax > yMin)) return [];
  const steps = options.steps ?? 160;
  const tol = options.tolerance ?? (yMax - yMin + x1 - x0) / 4000;
  const depth = options.depth ?? 10;
  // A rise this steep between neighbours is taken as a jump, not a curve.
  const jump = (yMax - yMin) * 2;

  const lines: Pt[][] = [];
  let line: Pt[] = [];
  const flush = () => {
    if (line.length > 1) lines.push(line);
    line = [];
  };
  const inside = (y: number) => y >= yMin && y <= yMax;
  const round = (p: Pt): Pt => ({ x: Math.round(p.x * 1000) / 1000 || 0, y: Math.round(p.y * 1000) / 1000 || 0 });
  const push = (p: Pt) => {
    const r = round(p);
    const last = line[line.length - 1];
    if (!last || last.x !== r.x || last.y !== r.y) line.push(r);
  };

  /** Where between a and b the curve crosses the y edge it leaves through, by bisection. */
  const edgeCrossing = (a: Pt, b: Pt): Pt | null => {
    const edge = (inside(a.y) ? b.y : a.y) > yMax ? yMax : yMin;
    let lo = a;
    let hi = b;
    for (let i = 0; i < 40; i++) {
      const xm = (lo.x + hi.x) / 2;
      const ym = fn(xm);
      if (!finite(ym)) return null;
      const m = { x: xm, y: ym };
      if (inside(m.y) === inside(lo.y)) lo = m;
      else hi = m;
    }
    const p = inside(lo.y) ? lo : hi;
    // Only a real crossing: a jump past the edge has no point near it.
    return Math.abs(p.y - edge) < (yMax - yMin) / 100 ? { x: p.x, y: edge } : null;
  };

  /** Adds the curve from a to b (a already handled), splitting where needed. */
  const segment = (a: Pt, b: Pt, level: number) => {
    const aOk = finite(a.y);
    const bOk = finite(b.y);
    const xm = (a.x + b.x) / 2;
    const m = { x: xm, y: fn(xm) };
    const mOk = finite(m.y);
    const needsSplit =
      level < depth &&
      (aOk !== bOk ||
        !mOk ||
        (aOk && bOk && (Math.abs(m.y - (a.y + b.y) / 2) > tol || Math.abs(b.y - a.y) > jump)) ||
        (aOk && bOk && inside(a.y) !== inside(b.y)) ||
        (aOk && bOk && !inside(a.y) && !inside(b.y) && a.y > yMax !== b.y > yMax));
    if (needsSplit && (aOk || bOk || mOk)) {
      segment(a, m, level + 1);
      segment(m, b, level + 1);
      return;
    }
    if (!aOk || !bOk || Math.abs(b.y - a.y) > jump) {
      // Undefined between them, or a jump that refining did not close: break the line.
      flush();
      if (bOk && inside(b.y)) push(b);
      return;
    }
    const ai = inside(a.y);
    const bi = inside(b.y);
    if (ai && bi) {
      if (line.length === 0) push(a);
      push(b);
    } else if (ai && !bi) {
      if (line.length === 0) push(a);
      const c = edgeCrossing(a, b);
      if (c) push(c);
      flush();
    } else if (!ai && bi) {
      flush();
      const c = edgeCrossing(a, b);
      if (c) push(c);
      push(b);
    }
  };

  let prev: Pt = { x: x0, y: fn(x0) };
  if (finite(prev.y) && inside(prev.y)) push(prev);
  for (let i = 1; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const next = { x, y: fn(x) };
    segment(prev, next, 0);
    prev = next;
  }
  flush();
  return lines;
}
