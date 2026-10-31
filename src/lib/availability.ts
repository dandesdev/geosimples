import { useMemo } from "react";
import {
  addAxes,
  addGrid,
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
  type FigureDoc,
  type Id,
  type OpResult,
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
  | "axes"
  | "grid";

export interface Availability {
  /** Why the action can't run now, or null when it can. */
  reason: string | null;
  /** What it would add or change, for the hover preview. */
  preview: ActionPreview | null;
}

const CIRCLE_MODES: CircleMode[] = ["radius", "through", "tangent", "circumcircle"];

export const NOTABLE_FEATURES: NotableFeature[] = ["root", "extremum", "yAxis"];

export const CONSTRUCTION_KINDS: ConstructionKind[] = [
  "midpoint",
  "altitude",
  "projection",
  "median",
  "bisector",
  "perpendicularBisector",
  "intersection",
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
      axes: check(doc, addAxes(doc), null),
      grid: check(doc, addGrid(doc), null),
    } as Record<CheckId, Availability>;
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

/** Props that show an action's result while its control is hovered or focused. */
export function previewProps(availability: Availability) {
  const set = useFigureStore.getState().setActionPreview;
  const show = () => set(availability.preview);
  const hide = () => set(null);
  return { onPointerEnter: show, onPointerLeave: hide, onFocus: show, onBlur: hide };
}
