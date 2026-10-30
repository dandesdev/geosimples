/**
 * FigureDoc v1: the saved form of a GeoSimples figure.
 *
 * Geometry is in world units (1 unit = 1 cm at scale 1), with Y pointing up.
 * Visual sizes (stroke width, point size, angle radius, label size and offset)
 * are in pt, so marks keep their printed size whatever the figure scale is.
 *
 * Styles are stored in full on every element. A figure saved today keeps its
 * look even if the defaults change later.
 */

export type Id = string;

/** "#rrggbb", or "ink" for the text color (black when printed). */
export type Color = string;

export type Dash = "solid" | "dashed" | "dotted";

export type FillPattern = "solid" | "hatch" | "crosshatch" | "dots";

export interface Stroke {
  color: Color;
  /** pt */
  width: number;
  dash: Dash;
  opacity: number;
}

export interface Fill {
  color: Color;
  opacity: number;
  pattern: FillPattern;
  /** Hatch direction in degrees. Ignored by solid fills. */
  angle: number;
}

export interface Label {
  text: string;
  /** Direction from the anchor in degrees, or null to place it automatically. */
  angle: number | null;
  /** Gap between the anchor and the label center, in pt. */
  distance: number;
  /** Font size in pt. */
  size: number;
  color: Color;
  /** Serif matches LaTeX's default font; sans is for sans-serif documents. */
  font: LabelFont;
  /**
   * A live measure: the shown text is computed from the element when drawn,
   * so it follows the points. `text` then only keeps the last value as a
   * fallback for readers that don't know measures.
   */
  measure?: LabelMeasure;
}

export type LabelFont = "serif" | "sans";

/** What a live label measures. Each element type supports some of them. */
export type MeasureKind = "length" | "angle" | "radius" | "area" | "perimeter";

export interface LabelMeasure {
  kind: MeasureKind;
  /** Decimal places, 0 to 4. */
  decimals: number;
  /** Text before and after the value, like "x = " and " cm". */
  prefix: string;
  suffix: string;
}

export type PointShape = "dot" | "ring" | "none";

/**
 * How a constructed point was built from other elements. The editor moves it
 * when they move. Points without one are free. Lines are given by two points.
 */
export type PointConstruction =
  | { kind: "midpoint"; points: [Id, Id] }
  /** Foot of the perpendicular from `point` to the line through `line`. */
  | { kind: "foot"; point: Id; line: [Id, Id] }
  /**
   * On the bisector of the angle a → vertex → b (reflex side when `reflex`):
   * where it meets `line`, or `length` world units from the vertex when `line` is null.
   */
  | { kind: "bisector"; angle: [Id, Id, Id]; reflex: boolean; line: [Id, Id] | null; length: number }
  /**
   * In the frame of segment pq: lerp(p, q, along) plus `across` times pq
   * turned 90° counterclockwise. Ends of a perpendicular bisector. With
   * `fixed`, `across` is in world units instead, so the end keeps its
   * distance when pq changes length.
   */
  | { kind: "perpendicular"; points: [Id, Id]; along: number; across: number; fixed?: true }
  /**
   * Where two curves cross: segments, circles, function graphs and vertical
   * lines. Between segments and circles, `index` 0 is the crossing nearer the
   * first end of a segment, or left of center-to-center for two circles. When
   * a graph or vertical line is one of them, crossings count left to right
   * (bottom to top at the same x), and the point is deleted when its crossing is gone.
   */
  | { kind: "intersection"; of: [Id, Id]; index: number }
  /** An end of a circle's arc: its start (0) or its end (1). Outer ends of a sector's radii. */
  | { kind: "arcEnd"; circle: Id; end: 0 | 1 }
  /** On the graph of a function, at (x, f(x)). Dragging it moves x. */
  | { kind: "onGraph"; graph: Id; x: number }
  /**
   * A notable point of a graph: its `index`-th root, turning point (max or
   * min) or crossing with the y axis, left to right. It follows the
   * expression, and is deleted when the graph no longer has it.
   */
  | { kind: "notable"; graph: Id; feature: NotableFeature; index: number };

export type NotableFeature = "root" | "extremum" | "yAxis";

export interface Point {
  id: Id;
  type: "point";
  x: number;
  y: number;
  shape: PointShape;
  /** Radius in pt. */
  size: number;
  color: Color;
  label?: Label;
  /** Absent for free points. */
  construction?: PointConstruction;
  /**
   * Dashed lines from the point to both axes of the figure, the way
   * textbooks show f(a). Absent for none, or when there are no axes.
   */
  guides?: Stroke;
}

export type Ticks = 0 | 1 | 2 | 3;

export interface Segment {
  id: Id;
  type: "segment";
  a: Id;
  b: Id;
  stroke: Stroke;
  /** Equal-length tick marks drawn across the middle. */
  ticks: Ticks;
  label?: Label;
}

export interface Angle {
  id: Id;
  type: "angle";
  /** The angle is a → vertex → b. */
  a: Id;
  vertex: Id;
  b: Id;
  /** Mark the reflex side (more than 180°) instead of the smaller one. */
  reflex: boolean;
  /** Arc radius in pt. */
  radius: number;
  arcs: 1 | 2 | 3;
  ticks: Ticks;
  /** Draw a square for 90° angles. */
  rightMark: boolean;
  stroke: Stroke;
  fill: Fill | null;
  label?: Label;
}

/**
 * How a circle was built. The editor uses this to rebuild the circle when its
 * points move. Renderers only read center and radius.
 */
export type CircleConstruction =
  | { kind: "free" }
  | { kind: "through"; point: Id }
  | { kind: "tangent"; segment: Id }
  | { kind: "circumcircle"; points: [Id, Id, Id] };

export interface Circle {
  id: Id;
  type: "circle";
  center: Id;
  radius: number;
  construction: CircleConstruction;
  /** Degrees, counterclockwise from the positive x axis. null draws the full circle. */
  arc: { start: number; end: number } | null;
  /**
   * Draw the two radii that close an arc into a sector, in the arc's style.
   * The editor now draws them as two segments to arcEnd points instead, so
   * they can be styled and labeled on their own; this stays for older figures.
   */
  radii: boolean;
  stroke: Stroke;
  fill: Fill | null;
  label?: Label;
}

export interface Polygon {
  id: Id;
  type: "polygon";
  vertices: Id[];
  stroke: Stroke | null;
  fill: Fill | null;
  label?: Label;
}

/** Text placed anywhere, not attached to an object, like "Figura 1". */
export interface FreeText {
  id: Id;
  type: "text";
  /** Center of the text, in world units. */
  x: number;
  y: number;
  text: string;
  /** Font size in pt. */
  size: number;
  color: Color;
  font: LabelFont;
  /** The text is its own label. Declared so `el.label` reads on any element. */
  label?: never;
}

/** How a function graph ends at each end of its domain: a closed dot is included, an open one is not. */
export type EndMark = "none" | "closed" | "open";

/**
 * The graph of y = f(x), from fnplot. Drawn over `domain` and cut where it
 * leaves `range`, so asymptotes and steep parts stay inside the picture.
 * Renderers sample `expr` themselves; nothing else is stored.
 */
export interface FunctionGraph {
  id: Id;
  type: "function";
  /** As typed, like "x^2 - 1" or "2sen(x)". */
  expr: string;
  /** x from, to, in world units. */
  domain: [number, number];
  /** y from, to: the curve is not drawn outside it. */
  range: [number, number];
  stroke: Stroke;
  /** Dots at the start and end of the domain, sized from the stroke. Absent for none. */
  ends?: [EndMark, EndMark];
  /** Its name, like "f", near the right end of the curve. */
  label?: Label;
}

/** The vertical line x = a, over `range`. Dashed, it marks an asymptote. */
export interface VerticalLine {
  id: Id;
  type: "vline";
  x: number;
  /** y from, to. */
  range: [number, number];
  stroke: Stroke;
  /** Near its top end. */
  label?: Label;
}

/** Cartesian axes with arrows, ticks every `step` units, and an optional grid behind them. */
export interface Axes {
  id: Id;
  type: "axes";
  x: [number, number];
  y: [number, number];
  /** Units between ticks, on both axes. */
  step: number;
  /**
   * When set, the x axis counts in multiples of π instead, with a tick every
   * `xPi`·π (0.5 for π/2), for trigonometry. `step` then only applies to y.
   */
  xPi?: number;
  /** Numbers under and beside the ticks. */
  numbers: boolean;
  grid: boolean;
  /** Names at the arrow tips, like "x" and "y". Empty for none. */
  names: [string, string];
  stroke: Stroke;
  /** Font size of numbers and names, in pt. */
  size: number;
  label?: never;
}

/**
 * A number line: one horizontal axis at height `y`, from x[0] to x[1], with an
 * arrow, ticks every `step` and numbers, for intervals and inequalities.
 */
export interface NumberLine {
  id: Id;
  type: "numberline";
  x: [number, number];
  y: number;
  step: number;
  numbers: boolean;
  stroke: Stroke;
  /** Font size of the numbers, in pt. */
  size: number;
  label?: never;
}

export type Element =
  | Point
  | Segment
  | Angle
  | Circle
  | Polygon
  | FreeText
  | FunctionGraph
  | VerticalLine
  | Axes
  | NumberLine;
export type ElementType = Element["type"];

export interface FigureDoc {
  kind: "geo";
  version: 1;
  elements: Element[];
}

export type ElementOf<T extends ElementType> = Extract<Element, { type: T }>;
