/** Small immutable 2D vector helpers. */

export interface Vec {
  x: number;
  y: number;
}

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a: Vec, b: Vec): Vec => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
export const lerp = (a: Vec, b: Vec, t: number): Vec => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export function unit(a: Vec): Vec {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/** Rotates 90° counterclockwise. */
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });

export function rotate(a: Vec, radians: number): Vec {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

/** Polar vector, angle in degrees. */
export function polar(length: number, degrees: number): Vec {
  const r = (degrees * Math.PI) / 180;
  return { x: length * Math.cos(r), y: length * Math.sin(r) };
}

/** Direction of a vector in degrees, in [0, 360). */
export function heading(a: Vec): number {
  const d = (Math.atan2(a.y, a.x) * 180) / Math.PI;
  return d < 0 ? d + 360 : d;
}

export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Normalizes degrees to [0, 360). */
export function normDeg(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}
