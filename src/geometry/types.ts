export type PointID = string;
export type ElementID = string;

export type ToolType =
  | "select"
  | "move"
  | "point"
  | "line"
  | "circle"
  | "arc"
  | "polygon";

export type PointShape = "circle" | "square" | "cross";

export type LineEndMarker = "none" | "arrow" | "both";

export type ElementType =
  | "point"
  | "line"
  | "circle"
  | "arc"
  | "polygon"
  | "label";

export interface BaseStyle {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string | null;
  opacity: number;
  dashArray: number[];
}

export interface PointStyle extends BaseStyle {
  radius: number;
  shape: PointShape;
  showLabel: boolean;
  labelColor: string;
}

export interface LineStyle extends BaseStyle {
  endMarkers: LineEndMarker;
  markerSize: number;
}

export interface CircleStyle extends BaseStyle {
  fillPattern: "solid" | "hatch" | "dots" | null;
}

export interface ArcStyle extends BaseStyle {
  radius: number;
  arcCount: 1 | 2 | 3;
  tickMarks: 0 | 1 | 2 | 3;
  fillPattern: "solid" | "dotted" | "hatch" | null;
}

export interface PolygonStyle extends BaseStyle {
  fillPattern: "solid" | "hatch" | "dots" | null;
}

export interface LabelStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string | null;
  padding: number;
  opacity: number;
}

export type ElementStyle =
  | PointStyle
  | LineStyle
  | CircleStyle
  | ArcStyle
  | PolygonStyle
  | LabelStyle;

export interface Point {
  id: PointID;
  type: "point";
  x: number;
  y: number;
  style: PointStyle;
  label?: string;
  /** Elements that constrain/lock this point (empty for free points) */
  lockedBy: ElementID[];
}

export interface Line {
  id: ElementID;
  type: "line";
  startPoint: PointID;
  endPoint: PointID;
  style: LineStyle;
  label?: string;
  /** Elements that constrain/lock this line (typically its endpoints) */
  lockedBy: ElementID[];
}

export interface Circle {
  id: ElementID;
  type: "circle";
  centerPoint: PointID;
  radiusPoint?: PointID;
  radius: number;
  style: CircleStyle;
  label?: string;
  /** Elements that constrain this circle (e.g., center, radius point, tangent lines) */
  lockedBy: ElementID[];
}

export interface Arc {
  id: ElementID;
  type: "arc";
  line1: ElementID; // First line segment
  line2: ElementID; // Second line segment
  intersectionPoint: PointID; // Point at intersection
  arcStartPoint: PointID; // Point on line1 at radius from intersection
  arcEndPoint: PointID; // Point on line2 at radius from intersection
  quadrant: 1 | 2 | 3 | 4; // Which angle quadrant (1-4)
  direction: "cw" | "ccw";
  style: ArcStyle;
  label?: string;
  /** Elements that constrain this arc (its parent lines, or endpoints) */
  lockedBy: ElementID[];
}

export interface Polygon {
  id: ElementID;
  type: "polygon";
  vertices: PointID[];
  style: PolygonStyle;
  label?: string;
  /** Elements that constrain this polygon (its vertices) */
  lockedBy: ElementID[];
}

export interface Label {
  id: ElementID;
  type: "label";
  x: number;
  y: number;
  text: string;
  style: LabelStyle;
}

export type GeometryElement = Point | Line | Circle | Arc | Polygon | Label;

export interface SelectionState {
  type: "none" | "single" | "multiple";
  ids: ElementID[];
}

export interface TransformState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface CoordinateSystemState {
  /** Pixels per world unit (default: 50) */
  pixelsPerUnit: number;
  /** World origin position in screen/pixel coordinates */
  worldOrigin: { x: number; y: number };
}

export interface GridState {
  visible: boolean;
  spacing: number;
  color: string;
  opacity: number;
}

export interface AxisState {
  visible: boolean;
  showLabels: boolean;
  xColor: string;
  yColor: string;
}

export interface UserPreferences {
  theme: "light" | "dark";
  grid: GridState;
  axis: AxisState;
  snapToGrid: boolean;
  snapThreshold: number;
}

export interface CanvasState {
  elements: GeometryElement[];
  selection: SelectionState;
  transform: TransformState;
  preferences: UserPreferences;
}

export interface HistoryState {
  past: CanvasState[];
  present: CanvasState;
  future: CanvasState[];
}

export const DEFAULT_POINT_STYLE: PointStyle = {
  strokeColor: "#1a1a1a",
  strokeWidth: 1.5,
  fillColor: "#1a1a1a",
  opacity: 1,
  dashArray: [],
  radius: 5,
  shape: "circle",
  showLabel: true,
  labelColor: "#1a1a1a",
};

export const DEFAULT_LINE_STYLE: LineStyle = {
  strokeColor: "#1a1a1a",
  strokeWidth: 1.5,
  fillColor: null,
  opacity: 1,
  dashArray: [],
  endMarkers: "none",
  markerSize: 6,
};

export const DEFAULT_CIRCLE_STYLE: CircleStyle = {
  strokeColor: "#1a1a1a",
  strokeWidth: 1.5,
  fillColor: null,
  opacity: 1,
  dashArray: [],
  fillPattern: null,
};

export const DEFAULT_ARC_STYLE: ArcStyle = {
  strokeColor: "#1a1a1a",
  strokeWidth: 1.5,
  fillColor: null,
  opacity: 1,
  dashArray: [],
  radius: 30,
  arcCount: 1,
  tickMarks: 0,
  fillPattern: null,
};

export const DEFAULT_POLYGON_STYLE: PolygonStyle = {
  strokeColor: "#1a1a1a",
  strokeWidth: 1.5,
  fillColor: null,
  opacity: 1,
  dashArray: [],
  fillPattern: null,
};

export const DEFAULT_LABEL_STYLE: LabelStyle = {
  fontSize: 14,
  fontFamily: "Inter",
  color: "#1a1a1a",
  backgroundColor: null,
  padding: 4,
  opacity: 1,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "light",
  grid: {
    visible: true,
    spacing: 1, // World units (1 unit = 50px by default)
    color: "#d4d4d4",
    opacity: 0.5,
  },
  axis: {
    visible: true,
    showLabels: true,
    xColor: "#9ca3af",
    yColor: "#9ca3af",
  },
  snapToGrid: true,
  snapThreshold: 10,
};

export const DEFAULT_TRANSFORM: TransformState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

export const DEFAULT_COORDINATE_SYSTEM: CoordinateSystemState = {
  pixelsPerUnit: 50,
  worldOrigin: { x: 0, y: 0 }, // Calculated dynamically based on canvas size
};

export const EMPTY_SELECTION: SelectionState = {
  type: "none",
  ids: [],
};
