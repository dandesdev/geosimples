import type { Angle, Fill, FigureDoc, Label, Point, Stroke } from "./types";

/** pt per cm. */
export const PT_PER_CM = 72 / 2.54;

export const INK = "ink";
export const INK_HEX = "#000000";

/** Limits shared by the editor, the plugin and the API. */
export const LIMITS = {
  elements: 2000,
  labelLength: 200,
  coordinate: 1e6,
} as const;

export const DEFAULT_STROKE: Stroke = {
  color: INK,
  width: 0.8,
  dash: "solid",
  opacity: 1,
};

export const DEFAULT_FILL: Fill = {
  color: "#808080",
  opacity: 0.3,
  pattern: "solid",
  angle: 45,
};

export const DEFAULT_LABEL: Label = {
  text: "",
  angle: null,
  distance: 9,
  size: 10,
  color: INK,
  font: "serif",
};

export const DEFAULT_POINT: Pick<Point, "shape" | "size" | "color"> = {
  shape: "dot",
  size: 1.8,
  color: INK,
};

export const DEFAULT_ANGLE: Pick<
  Angle,
  "reflex" | "radius" | "arcs" | "ticks" | "rightMark" | "fill"
> = {
  reflex: false,
  radius: 14,
  arcs: 1,
  ticks: 0,
  rightMark: true,
  fill: null,
};

/** Default circle radius in world units, for a circle around a single point. */
export const DEFAULT_CIRCLE_RADIUS = 1;

/** Grid lines of axes: thin and light, so they print as a guide and not as part of the figure. */
export const AXES_GRID: Stroke = { color: "#c8c8c8", width: 0.4, dash: "solid", opacity: 1 };

/** Axes stroke: a bit thinner than figure lines. */
export const DEFAULT_AXES_STROKE: Stroke = { color: INK, width: 0.6, dash: "solid", opacity: 1 };

/** Default view of a new graph: x and y from -5 to 5. */
export const DEFAULT_PLOT_WINDOW = { x: [-5, 5] as [number, number], y: [-5, 5] as [number, number] };

/**
 * How new elements look. Operations take these so an editor can let the
 * teacher choose their own defaults. Elements keep their full style once
 * created, so changing defaults never changes existing figures.
 */
export interface StyleDefaults {
  point: Pick<Point, "shape" | "size" | "color">;
  stroke: Stroke;
  /** Fill for polygons, circles and the Polígono action. */
  fill: Fill;
  /** New polygons start filled. */
  polygonFilled: boolean;
  angle: Pick<Angle, "radius" | "arcs" | "rightMark" | "fill">;
  label: Omit<Label, "text">;
  /** World units. */
  circleRadius: number;
}

export const DEFAULT_STYLES: StyleDefaults = {
  point: { ...DEFAULT_POINT },
  stroke: { ...DEFAULT_STROKE },
  fill: { ...DEFAULT_FILL },
  polygonFilled: true,
  angle: { radius: DEFAULT_ANGLE.radius, arcs: DEFAULT_ANGLE.arcs, rightMark: DEFAULT_ANGLE.rightMark, fill: null },
  label: { angle: null, distance: DEFAULT_LABEL.distance, size: DEFAULT_LABEL.size, color: DEFAULT_LABEL.color, font: "serif" },
  circleRadius: DEFAULT_CIRCLE_RADIUS,
};

export function emptyDoc(): FigureDoc {
  return { kind: "geo", version: 1, elements: [] };
}

/** Colors offered in the editor, with names a teacher recognizes. */
export const PALETTE: ReadonlyArray<{ name: string; value: string }> = [
  { name: "Preto", value: INK },
  { name: "Cinza", value: "#808080" },
  { name: "Cinza claro", value: "#c8c8c8" },
  { name: "Branco", value: "#ffffff" },
  { name: "Vermelho", value: "#d62828" },
  { name: "Laranja", value: "#ea7317" },
  { name: "Amarelo", value: "#e9c400" },
  { name: "Verde", value: "#2a9d3f" },
  { name: "Azul", value: "#1d4ed8" },
  { name: "Ciano", value: "#0891b2" },
  { name: "Roxo", value: "#7e22ce" },
  { name: "Magenta", value: "#c026d3" },
];

/** Resolves "ink" and validates hex colors. Unknown values fall back to ink. */
export function resolveColor(color: string): string {
  if (color === INK) return INK_HEX;
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
  return INK_HEX;
}

export function isValidColor(color: string): boolean {
  return color === INK || /^#[0-9a-fA-F]{6}$/.test(color);
}
