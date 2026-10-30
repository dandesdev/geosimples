/**
 * Numeric roots and turning points of a function on an interval: sampled,
 * then refined by bisection or golden-section search. Enough for the curves
 * of school math, where formulas are short and features are well apart.
 */

/** Samples taken across the interval before refining. */
const SAMPLES = 800;

const finite = (y: number) => Number.isFinite(y);

/** Rounds away float noise like 1.9999999999 and -0. */
const clean = (x: number) => Math.round(x * 1e9) / 1e9 || 0;

function bisect(g: (x: number) => number, lo: number, hi: number): number {
  let glo = g(lo);
  for (let i = 0; i < 200 && hi - lo > 1e-15 * Math.max(1, Math.abs(lo)); i++) {
    const m = (lo + hi) / 2;
    const gm = g(m);
    if (gm === 0) return m;
    if (Math.sign(gm) === Math.sign(glo)) {
      lo = m;
      glo = gm;
    } else {
      hi = m;
    }
  }
  return (lo + hi) / 2;
}

/** Where `h` is smallest on [lo, hi], by golden-section search. */
function goldenMin(h: (x: number) => number, lo: number, hi: number): number {
  const r = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - r * (b - a);
  let d = a + r * (b - a);
  for (let i = 0; i < 200 && b - a > 1e-12 * Math.max(1, Math.abs(a)); i++) {
    if (h(c) < h(d)) b = d;
    else a = c;
    c = b - r * (b - a);
    d = a + r * (b - a);
  }
  return (a + b) / 2;
}

function sample(g: (x: number) => number, [a, b]: [number, number]) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = a + ((b - a) * i) / SAMPLES;
    xs.push(x);
    ys.push(g(x));
  }
  return { xs, ys };
}

/**
 * The x where g(x) = 0 on [a, b], left to right: where g changes sign (but
 * not across a jump like 1/x at 0), and where it only touches zero, like
 * (x - 1)² at 1.
 */
export function findRoots(g: (x: number) => number, interval: [number, number]): number[] {
  const [a, b] = interval;
  if (!(b > a)) return [];
  const { xs, ys } = sample(g, interval);
  const roots: number[] = [];
  const add = (x: number) => {
    if (!roots.some((r) => Math.abs(r - x) < (b - a) * 1e-6)) roots.push(clean(x));
  };
  for (let i = 0; i <= SAMPLES; i++) {
    const y = ys[i];
    if (y === 0) {
      add(xs[i]);
      continue;
    }
    const next = ys[i + 1];
    if (i < SAMPLES && finite(y) && finite(next) && next !== 0 && y * next < 0) {
      const r = bisect(g, xs[i], xs[i + 1]);
      // Across an asymptote the sign flips too, but g is huge there instead of 0.
      if (Math.abs(g(r)) < 1e-6 * (1 + Math.abs(y) + Math.abs(next))) add(r);
    }
  }
  for (let i = 1; i < SAMPLES; i++) {
    const [p, y, n] = [ys[i - 1], ys[i], ys[i + 1]];
    if (!finite(p) || !finite(y) || !finite(n) || y === 0) continue;
    const touches = p * y > 0 && y * n > 0 && Math.abs(y) <= Math.abs(p) && Math.abs(y) <= Math.abs(n);
    if (!touches) continue;
    const x = goldenMin((t) => Math.abs(g(t)), xs[i - 1], xs[i + 1]);
    if (Math.abs(g(x)) < 1e-9) add(x);
  }
  return roots.sort((p, q) => p - q);
}

export interface Extremum {
  x: number;
  y: number;
  kind: "max" | "min";
}

/**
 * Local maxima and minima of f inside (a, b), left to right. A rise of
 * `jump` or more between samples is an asymptote, not a turning point.
 */
export function findExtrema(f: (x: number) => number, interval: [number, number], jump: number): Extremum[] {
  const [a, b] = interval;
  if (!(b > a)) return [];
  const { xs, ys } = sample(f, interval);
  const out: Extremum[] = [];
  // The slope's sign, from a central difference: it flips at a turning point, kinks like |x| included.
  const h = Math.max((b - a) * 1e-7, 1e-9);
  const slope = (t: number) => f(t + h) - f(t - h);
  for (let i = 1; i < SAMPLES; i++) {
    const [p, y, n] = [ys[i - 1], ys[i], ys[i + 1]];
    if (!finite(p) || !finite(y) || !finite(n)) continue;
    if (Math.abs(y - p) >= jump || Math.abs(y - n) >= jump) continue;
    const max = y > p && y >= n;
    const min = y < p && y <= n;
    if (!max && !min) continue;
    const [lo, hi] = [xs[i - 1], xs[i + 1]];
    // Bisecting the slope pins a smooth top far closer than searching f, which is flat there.
    const x =
      slope(lo) * slope(hi) < 0 ? bisect(slope, lo, hi) : goldenMin((t) => (max ? -f(t) : f(t)), lo, hi);
    const fx = f(x);
    if (!finite(fx) || x <= a || x >= b) continue;
    if (out.some((e) => Math.abs(e.x - x) < (b - a) * 1e-6)) continue;
    out.push({ x: clean(x), y: clean(fx), kind: max ? "max" : "min" });
  }
  return out;
}
