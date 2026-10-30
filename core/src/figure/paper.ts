import type { Prim, Scene } from "./render";

/** The paper a figure is drawn on: white as printed, or the dark theme's gray. */
export type Paper = "print" | "dark";

/** Lightness of the dark paper and of black ink on it (HSL, 0 to 1). */
const DARK_PAPER_L = 0.19;
const DARK_INK_L = 0.88;

function toHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function toHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const byte = (v: number) => Math.round(Math.min(Math.max(v + m, 0), 1) * 255).toString(16).padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/**
 * A "#rrggbb" color as it shows on the dark paper. Lightness flips between
 * the ink and the paper while hue and saturation stay: black turns light,
 * white turns into the paper, and a mid red stays a red that reads on gray.
 */
export function darkColor(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const [h, s, l] = toHsl(hex);
  return toHex(h, s, DARK_INK_L + (DARK_PAPER_L - DARK_INK_L) * l);
}

/** The dark theme's paper. */
export const DARK_PAPER = darkColor("#ffffff");

/** The color of white paper, or of the dark paper. */
export function paperColor(paper: Paper): string {
  return paper === "dark" ? DARK_PAPER : "#ffffff";
}

function paintPrim(p: Prim, color: (c: string) => string): Prim {
  if (p.kind === "text") return { ...p, color: color(p.color) };
  return {
    ...p,
    stroke: p.stroke && { ...p.stroke, color: color(p.stroke.color) },
    fill: p.fill && { ...p.fill, color: color(p.fill.color) },
  };
}

/** The scene recolored for its paper. The figure itself keeps its print colors. */
export function paintScene(scene: Scene, paper: Paper): Scene {
  if (paper === "print") return scene;
  return { ...scene, prims: scene.prims.map((p) => paintPrim(p, darkColor)) };
}
