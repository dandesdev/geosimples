import type { ElementID, GeometryElement } from "@geosimples/core/geo";

export type ToolType =
  | "select"
  | "move"
  | "point"
  | "line"
  | "circle"
  | "arc"
  | "polygon";

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
