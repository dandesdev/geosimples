import { useMemo } from "react";
import {
  addAxes,
  addGrid,
  addBasis,
  addComponent,
  fillShapeOperation,
  SHAPE_OPERATIONS,
  type ShapeOperation,
  circuitOf,
  setCircuit,
  COMPONENT_KINDS,
  type CurrentSense,
  type ComponentKind,
  addPointOnGraph,
  addTangentAt,
  addVennDiagram,
  makeVectors,
  markSetOperation,
  vectorOp,
  type SetOperation,
  addSpot,
  construct,
  connectPoints,
  fitFigure,
  fillShapes,
  makeAngles,
  makeCircle,
  pointOnSelectedGraph,
  selectedOfType,
  toggleGuides,
  markNotable,
  toFunctions,
  type NotableFeature,
  type CircleMode,
  type ConstructionKind,
  type VectorOperation,
  type FigureDoc,
  type Id,
  type OpResult,
  type Spot,
} from "@geosimples/core/figure";
import { describeSelection } from "@/lib/names";
import { useFigureStore, type ActionPreview } from "@/store/figureStore";
import { opOptions } from "@/store/prefsStore";
import { useActivePrefs } from "@/store/useActivePrefs";

export type CheckId =
  | "connect"
  | "closeContour"
  | "angle"
  | "polygon"
  | `circle-${CircleMode}`
  | `construct-${ConstructionKind}`
  | "graphPoint"
  | "guides"
  | `notable-${NotableFeature}`
  | "toFunctions"
  | "vector"
  | `vector-${VectorOperation}`
  | `set-${SetOperation}`
  | `shape-${ShapeOperation}`
  | `component-${ComponentKind}`
  | "circuitPower"
  | `current-${CurrentSense}`;

/** What Inserir adds that can't always run: axes only once, a vector only from two points. */
export type InsertCheckId = "axes" | "grid" | "basis" | `venn-${1 | 2 | 3}` | "vector" | "toFunctions" | `component-${ComponentKind}`;

export interface Availability {
  /** Why the action can't run now, or null when it can. */
  reason: string | null;
  /** What it would add or change, for the hover preview. */
  preview: ActionPreview | null;
}

const CIRCLE_MODES: CircleMode[] = ["radius", "through", "tangent", "circumcircle"];

export const NOTABLE_FEATURES: NotableFeature[] = ["root", "extremum", "yAxis"];

export const SET_OPERATIONS: SetOperation[] = ["union", "inter", "diff", "comp"];

const CURRENT_SENSES: CurrentSense[] = ["none", "real", "conventional"];

export const VECTOR_OPERATIONS: VectorOperation[] = ["sum", "parallelogram", "difference", "projection", "unit", "components", "scale"];

export const CONSTRUCTION_KINDS: ConstructionKind[] = [
  "midpoint",
  "altitude",
  "projection",
  "median",
  "bisector",
  "perpendicularBisector",
  "intersection",
  "tangent",
];

/** Elements an operation adds or changes. Operations keep unchanged elements as the same objects. */
function changedIds(before: FigureDoc, after: FigureDoc): Id[] {
  const old = new Map(before.elements.map((e) => [e.id, e]));
  return after.elements.filter((e) => old.get(e.id) !== e).map((e) => e.id);
}

function check(doc: FigureDoc, result: OpResult, selectionText: string | null): Availability {
  if (result.error) {
    return {
      reason: selectionText ? `${result.error} Agora: ${selectionText}.` : result.error,
      preview: null,
    };
  }
  // As the edit will be: axes and grids that follow the figure fit what it adds.
  const after = fitFigure(result.doc);
  return { reason: null, preview: { doc: after, ids: changedIds(doc, after) } };
}

/**
 * Whether each construction action can run with the current selection. Each
 * check runs the real operation without saving it, so a button never says
 * yes and then fails, and the result doubles as the hover preview.
 */
export function useAvailability(): Record<CheckId, Availability> {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const prefs = useActivePrefs();
  return useMemo(() => {
    // Read inside so the memo tracks the profile through `prefs`.
    const opts = prefs && opOptions();
    const text = describeSelection(doc, selection);
    const points = selectedOfType(doc, selection, "point").map((p) => p.id);
    const out = {
      connect: check(doc, connectPoints(doc, points, false, opts), text),
      closeContour: check(doc, connectPoints(doc, points, true, opts), text),
      angle: check(doc, makeAngles(doc, selection, opts), text),
      polygon: check(doc, fillShapes(doc, selection, opts), text),
      graphPoint: check(doc, pointOnSelectedGraph(doc, selection, opts), text),
      guides: check(doc, toggleGuides(doc, selection), text),
      toFunctions: check(doc, toFunctions(doc, selection, opts), text),
      vector: check(doc, makeVectors(doc, selection, opts), text),
    } as Record<CheckId, Availability>;
    for (const op of VECTOR_OPERATIONS) {
      out[`vector-${op}`] = check(doc, vectorOp(doc, selection, op, opts), text);
    }
    for (const op of SET_OPERATIONS) {
      out[`set-${op}`] = check(doc, markSetOperation(doc, selection, op, opts), text);
    }
    for (const op of SHAPE_OPERATIONS) {
      out[`shape-${op}`] = check(doc, fillShapeOperation(doc, selection, op, opts), text);
    }
    for (const kind of COMPONENT_KINDS) {
      out[`component-${kind}`] = check(doc, addComponent(doc, selection, kind, opts), text);
    }
    // Switching on solves the circuit: an impossible one says why before the click.
    const circuit = circuitOf(doc);
    out.circuitPower = check(doc, setCircuit(doc, { on: !circuit?.on }, opts), null);
    for (const current of CURRENT_SENSES) out[`current-${current}`] = check(doc, setCircuit(doc, { current }, opts), null);
    for (const feature of NOTABLE_FEATURES) {
      out[`notable-${feature}`] = check(doc, markNotable(doc, selection, feature, opts), text);
    }
    for (const mode of CIRCLE_MODES) {
      out[`circle-${mode}`] = check(doc, makeCircle(doc, selection, mode, opts), text);
    }
    for (const kind of CONSTRUCTION_KINDS) {
      out[`construct-${kind}`] = check(doc, construct(doc, selection, kind, opts), text);
    }
    return out;
  }, [doc, selection, prefs]);
}

/** Whether each Inserir item that can't always run can run now. */
export function useInsertAvailability(): Record<InsertCheckId, Availability> {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const prefs = useActivePrefs();
  return useMemo(() => {
    const opts = prefs && opOptions();
    const text = describeSelection(doc, selection);
    const components = Object.fromEntries(
      COMPONENT_KINDS.map((kind) => [`component-${kind}`, check(doc, addComponent(doc, selection, kind, opts), text)]),
    ) as Record<`component-${ComponentKind}`, Availability>;
    return {
      ...components,
      vector: check(doc, makeVectors(doc, selection, opts), text),
      toFunctions: check(doc, toFunctions(doc, selection, opts), text),
      axes: check(doc, addAxes(doc), null),
      grid: check(doc, addGrid(doc), null),
      basis: check(doc, addBasis(doc, opts), null),
      "venn-1": check(doc, addVennDiagram(doc, 1, opts), null),
      "venn-2": check(doc, addVennDiagram(doc, 2, opts), null),
      "venn-3": check(doc, addVennDiagram(doc, 3, opts), null),
    };
  }, [doc, selection, prefs]);
}

/** "Ponto sobre o gráfico" and "Reta tangente" at a spot right-clicked on a graph, or null without one. */
export function useGraphSpotActions(spot: { graph: Id; x: number } | null): { point: Availability; tangent: Availability } | null {
  const doc = useFigureStore((s) => s.doc);
  const prefs = useActivePrefs();
  return useMemo(() => {
    if (!spot) return null;
    const opts = prefs && opOptions();
    return {
      point: check(doc, addPointOnGraph(doc, spot.graph, spot.x, "", opts), null),
      tangent: check(doc, addTangentAt(doc, spot.graph, spot.x, opts), null),
    };
  }, [doc, prefs, spot]);
}

/** Adding the point a spot shows, previewed like the other actions. */
export function useSpotAction(spot: Spot | null): Availability | null {
  const doc = useFigureStore((s) => s.doc);
  const prefs = useActivePrefs();
  return useMemo(() => (spot ? check(doc, addSpot(doc, spot, prefs && opOptions()), null) : null), [doc, prefs, spot]);
}

/** Props that show an action's result while its control is hovered or focused. */
export function previewProps(availability: Availability) {
  const set = useFigureStore.getState().setActionPreview;
  const show = () => set(availability.preview);
  const hide = () => set(null);
  return { onPointerEnter: show, onPointerLeave: hide, onFocus: show, onBlur: hide };
}
