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
}

export type LabelFont = "serif" | "sans";

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
   * turned 90° counterclockwise. Ends of a perpendicular bisector.
   */
  | { kind: "perpendicular"; points: [Id, Id]; along: number; across: number }
  /**
   * Where two segments or circles cross. With two crossings, `index` 0 is the
   * one nearer the first end of a segment, or left of center-to-center for two circles.
   */
  | { kind: "intersection"; of: [Id, Id]; index: 0 | 1 };

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
  /** Draw the two radii that close an arc into a sector. */
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

export type Element = Point | Segment | Angle | Circle | Polygon;
export type ElementType = Element["type"];

export interface FigureDoc {
  kind: "geo";
  version: 1;
  elements: Element[];
}

export type ElementOf<T extends ElementType> = Extract<Element, { type: T }>;
