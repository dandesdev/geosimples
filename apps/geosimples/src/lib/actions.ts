import { toast } from "sonner";
import {
  autoLabel,
  connectPoints,
  deleteElements,
  makeAngles,
  makeCircle,
  makePolygon,
  pointMap,
  pointOnSegment,
  projectPoint,
  selectedOfType,
  type CircleMode,
  type FigureDoc,
  type Id,
  type LabelScheme,
  type LabelTarget,
  type OpResult,
} from "@geosimples/core/figure";
import { useFigureStore } from "@/store/figureStore";

function perform(
  op: (doc: FigureDoc, selection: Id[]) => OpResult,
  select: "created" | "keep" | "none" = "created",
): boolean {
  const result = useFigureStore.getState().run(op, select);
  if (result.error) {
    toast.error(result.error);
    return false;
  }
  if (result.notice) toast(result.notice);
  return true;
}

const selectedPoints = (doc: FigureDoc, selection: Id[]) =>
  selectedOfType(doc, selection, "point").map((p) => p.id);

export const actions = {
  connect: (closed: boolean) =>
    perform((doc, sel) => connectPoints(doc, selectedPoints(doc, sel), closed), "keep"),

  angles: () => perform((doc, sel) => makeAngles(doc, sel)),

  polygon: () => perform((doc, sel) => makePolygon(doc, sel)),

  circle: (mode: CircleMode) => perform((doc, sel) => makeCircle(doc, sel, mode)),

  deleteSelected: () => {
    const { selection } = useFigureStore.getState();
    if (selection.length === 0) return false;
    return perform((doc, sel) => deleteElements(doc, sel), "none");
  },

  pointOnSegment: (segmentId: Id, at: { ratio: number } | { distance: number }, from: "a" | "b") =>
    perform((doc) => pointOnSegment(doc, segmentId, at, from)),

  project: (withHeight: boolean) =>
    perform((doc, sel) => projectPoint(doc, selectedPoints(doc, sel), withHeight)),

  autoLabel: (type: LabelTarget, scheme: LabelScheme, onlySelected: boolean) => {
    const { settings } = useFigureStore.getState();
    return perform(
      (doc, sel) => autoLabel(doc, type, scheme, onlySelected ? sel : null, settings.decimals),
      "keep",
    );
  },
};

/** The last selected point, used by R:θ in the point input. */
export function lastSelectedPoint(doc: FigureDoc, selection: Id[]) {
  const pts = pointMap(doc);
  for (let i = selection.length - 1; i >= 0; i--) {
    const p = pts.get(selection[i]);
    if (p) return p;
  }
  return undefined;
}
