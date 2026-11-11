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

import type { Locale } from "./messages";

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
  | { kind: "notable"; graph: Id; feature: NotableFeature; index: number }
  /**
   * An end of the tangent to a graph at `point`, a point on it: `along`
   * world units from it in the direction of the curve there (negative goes
   * left). With `fill` it reaches the edge of the axes' window on that side
   * instead, without making the window grow. It goes when the graph has no
   * tangent there, as at a corner.
   */
  | { kind: "tangent"; graph: Id; point: Id; along: number; fill?: boolean }
  /** `point` plus `factor` times the vector from by[0] to by[1]: the tip of a vector moved or scaled. */
  | { kind: "translate"; point: Id; by: [Id, Id]; factor: number }
  /** One unit from `from`, in the direction from of[0] to of[1]: the tip of a versor. */
  | { kind: "unit"; of: [Id, Id]; from: Id }
  /** At the x of one point and the y of another: the tip of a vector's component along an axis. */
  | { kind: "corner"; x: Id; y: Id };

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

/**
 * The continuation of the line through `line` out to `point`, a point on that
 * line: a side extended to the foot of a height, or a segment to where it
 * crosses something. Drawn only while the point is beyond the segment
 * between them, from its nearer end.
 */
export interface Extension {
  id: Id;
  type: "extension";
  line: [Id, Id];
  point: Id;
  stroke: Stroke;
  label?: never;
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
  /** The universe of a Venn diagram: its name goes inside the top left corner. */
  universe?: true;
  label?: Label;
}

/** How a vector's name is marked: an arrow over it, a hat for versors, or nothing. */
export type VectorNotation = "arrow" | "hat" | "none";

/** An arrow from point `a` to point `b`. */
export interface Vector {
  id: Id;
  type: "vector";
  a: Id;
  b: Id;
  stroke: Stroke;
  /** Length of the arrowhead, in pt. */
  head: number;
  notation: VectorNotation;
  label?: Label;
}

/** A set of a Venn diagram, by its name in an expression and the circle or polygon that draws it. */
export interface RegionSet {
  name: string;
  shape: Id;
}

/** The part of the plane an expression like (A∪B)'∩C describes, computed from the shapes of its sets. */
export interface Region {
  id: Id;
  type: "region";
  /** As typed. */
  expr: string;
  sets: RegionSet[];
  /** The polygon complements are taken in. Null when the figure has no universe. */
  universe: Id | null;
  fill: Fill;
  stroke: Stroke | null;
  label?: never;
}

/** What is written in the regions of a Venn diagram. Each item goes where its sets overlap. */
export interface VennItems {
  id: Id;
  type: "vennitems";
  /** The elements of each set; `set` may be the universe, for those in no other set. */
  members: { set: Id; items: string[] }[];
  /** Counts like n(A∩B) = 3: `in` lists exactly the sets of that region. */
  counts: { in: Id[]; text: string }[];
  size: number;
  color: Color;
  font: LabelFont;
  label?: never;
}

/** What a board shows: everything, only the setup to be solved, or some results left as blanks. */
export type BoardShow = "full" | "blank" | "gaps";

/** What stands where a result was left out: an empty box, nothing, or a text like "?". */
export type GapStyle = "box" | "blank" | "text";

/**
 * A worked layout placed on the figure, like a long division, a factorization
 * or a sign chart. `source` is what the teacher typed, and every renderer lays
 * it out again from there. Its top left is at (x, y); inside, everything is in pt.
 */
export interface Board {
  id: Id;
  type: "board";
  x: number;
  y: number;
  source: string;
  show: BoardShow;
  /** Picks which results a "gaps" board leaves blank, while `gaps` is null. */
  seed: number;
  /** The results left out, by their order on the board; null draws them by `seed`. */
  gaps: number[] | null;
  gapStyle: GapStyle;
  /** Written in each gap when `gapStyle` is "text". */
  gapText: string;
  /** Columns: where the sign of the operation goes, left of the numbers or right of them. */
  signSide: "left" | "right";
  /** Number lines: a stretch of the set as a thick line or as a wavy one. */
  intervals: "thick" | "wave";
  /** Division: "long" writes each subtraction, "short" only the remainders. */
  method: "long" | "short";
  /** Division: decimal places to carry the quotient to. */
  places: number;
  /** Carries and borrows. */
  marks: boolean;
  /** Font size, in pt. */
  size: number;
  color: Color;
  /** Width of its lines, in pt. */
  width: number;
  font: LabelFont;
  label?: never;
}

/** A piece of an electric circuit. A lamp is a resistor with its own symbol; a receptor is a source the current runs through backwards. */
export type ComponentKind = "resistor" | "lamp" | "source" | "switch" | "ammeter" | "voltmeter" | "capacitor";

/**
 * A piece of an electric circuit between points `a` and `b`: its symbol in
 * the middle and a wire to each point. Segments are the wires, so pieces
 * connect only where they share a point, directly or through segments.
 */
export interface Component {
  id: Id;
  type: "component";
  kind: ComponentKind;
  /** A source's positive terminal, the long plate, is at `b`. */
  a: Id;
  b: Id;
  /** Ω for a resistor or a lamp, the emf in V for a source, μF for a capacitor. The others have none. */
  value: number;
  /** A source's internal resistance in Ω, 0 when ideal. */
  internal: number;
  /** A switch lets the current through. */
  closed: boolean;
  /** A resistor as a zigzag or as a rectangle. */
  shape: "zigzag" | "box";
  /** Like R₁ or ε, written with the value beside it. */
  name: string;
  /** Length of the symbol along the wire, in pt. */
  size: number;
  stroke: Stroke;
  label?: Label;
}

/** Arrows for the current: the way electrons go, or the conventional way, from + to −. */
export type CurrentSense = "none" | "real" | "conventional";

/**
 * How the figure's circuit shows: as given, or switched on ("Ligar circuito"),
 * with the current and voltage of each piece and the meters' readings. A
 * figure has one, made with its first piece; the pieces are all its components.
 */
export interface Circuit {
  id: Id;
  type: "circuit";
  on: boolean;
  current: CurrentSense;
  /** What a switched-on circuit writes by each piece. */
  values: { current: boolean; voltage: boolean; power: boolean };
  decimals: number;
  /** Font size of the values, in pt. */
  size: number;
  color: Color;
  font: LabelFont;
  label?: never;
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

/** Cartesian axes with arrows and ticks every `step` units. */
export interface Axes {
  id: Id;
  type: "axes";
  x: [number, number];
  y: [number, number];
  /** Units between ticks, on both axes unless `yStep` is set. */
  step: number;
  /** Units between ticks on the y axis, when it counts differently from x. */
  yStep?: number;
  /**
   * cm per unit along x and y, for a graph that needs a different scale on
   * each axis. It stretches the whole figure, so circles become ellipses.
   * 1 and 1 when absent.
   */
  unit?: [number, number];
  /**
   * The y scale in `unit` was picked by the fit, to keep a flat or steep curve
   * readable in a 4:3 or square window. Setting the scale by hand clears it.
   */
  fitUnit?: boolean;
  /**
   * The fit may pick its own y scale even with circles, polygons, angles or
   * segments in the figure, which it then bends. Absent, they block it.
   * Intervals on a number line never block it.
   */
  scaleShapes?: boolean;
  /**
   * The window follows the rest of the figure: everything fits with a tick of
   * room, and the steps keep the numbers apart. Setting the window or the
   * steps by hand turns it off.
   */
  fit?: boolean;
  /**
   * When set, the x axis counts in multiples of π instead, with a tick every
   * `xPi`·π (0.5 for π/2), for trigonometry. `step` then only applies to y.
   */
  xPi?: number;
  /** Numbers under and beside the ticks. */
  numbers: boolean;
  /** Names at the arrow tips, like "x" and "y". Empty for none. */
  names: [string, string];
  stroke: Stroke;
  /** Font size of numbers and names, in pt. */
  size: number;
  label?: never;
}

/** What sets the window of a grid. */
export type GridFollow = "axes" | "figure" | "none";

/**
 * A printed square grid, the malha quadriculada, behind everything else.
 * Over the axes it takes their window and ticks; "figure" fits it around the
 * rest of the figure with a square of room; "none" keeps `x` and `y`.
 */
export interface Grid {
  id: Id;
  type: "grid";
  x: [number, number];
  y: [number, number];
  /** Side of a square, in world units. */
  step: number;
  follow: GridFollow;
  stroke: Stroke;
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
  | Extension
  | Angle
  | Circle
  | Polygon
  | FreeText
  | FunctionGraph
  | VerticalLine
  | Axes
  | Grid
  | NumberLine
  | Vector
  | Region
  | VennItems
  | Board
  | Component
  | Circuit;
export type ElementType = Element["type"];

export interface FigureDoc {
  kind: "geo";
  version: 1;
  /**
   * Language of the figure's text: "en" writes numbers with a decimal point
   * and coordinates as (x, y). Absent means pt-BR, with the decimal comma.
   */
  locale?: Locale;
  elements: Element[];
}

export type ElementOf<T extends ElementType> = Extract<Element, { type: T }>;
