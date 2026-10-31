import { toast } from "sonner";
import {
  addPoints,
  addText,
  autoLabelMany,
  buildScene,
  clearLabels,
  connectPoints,
  construct,
  deleteElements,
  freePoints,
  makeAngles,
  makeCircle,
  markPerpendicularBisector,
  fillShapes,
  addPointOnGraph,
  addTangentAt,
  resizeTangent,
  pointMap,
  pointOnSelectedGraph,
  toggleGuides,
  addNumberLine,
  addAxes,
  addGrid,
  markNotable,
  toFunctions,
  type NotableFeature,
  pointOnSegment,
  quickFigureStep,
  NO_QUICK_FIGURE,
  resizePerpendicularBisector,
  selectedOfType,
  setCircleArc,
  setSectorRadii,
  type CircleMode,
  type ConstructionKind,
  type FigureDoc,
  type Id,
  type AutoLabelJob,
  type OpResult,
} from "@geosimples/core/figure";
import { useFigureStore } from "@/store/figureStore";
import { emitCommand } from "@/lib/commands";
import { activePrefs, opOptions } from "@/store/prefsStore";

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

/** Text typed in for the teacher to finish in the input bar, like "y = ". Text already there stays. */
export const PREFILLS = ["y = ", "x = ", "["];

function startInput(prefill: string) {
  const store = useFigureStore.getState();
  if (store.inputDraft.trim() === "") store.setInputDraft(prefill);
  // After the input shows the new text, so the caret lands at its end.
  requestAnimationFrame(() => emitCommand("focusInput"));
}

export const actions = {
  connect: (closed: boolean) =>
    perform((doc, sel) => connectPoints(doc, selectedPoints(doc, sel), closed, opOptions()), "keep"),

  angles: () => perform((doc, sel) => makeAngles(doc, sel, opOptions())),

  /** Makes a polygon and fills the selected circles and polygons. */
  polygon: () => perform((doc, sel) => fillShapes(doc, sel, opOptions()), "keep"),

  circle: (mode: CircleMode) => perform((doc, sel) => makeCircle(doc, sel, mode, opOptions())),

  /** Midpoint, height, median, bisectors and intersections: see ConstructionKind. */
  construct: (kind: ConstructionKind) => perform((doc, sel) => construct(doc, sel, kind, opOptions())),

  /** Turns constructed points into free points that no longer follow their parents. */
  freePoints: (ids: Id[]) => perform((doc) => freePoints(doc, ids), "keep"),

  /** Starts a graph: "y = " in the input bar, ready for the expression. Text already typed stays. */
  startGraph: () => startInput("y = "),

  /** Starts a vertical line: "x = " in the input bar, ready for the number. */
  startVerticalLine: () => startInput("x = "),

  /**
   * A point on the selected graph, at a whole x; its x is set in Propriedades.
   * From the preview's menu, at the x right-clicked on the curve.
   */
  pointOnGraph: (at?: { graph: Id; x: number }) =>
    perform((doc, sel) => (at ? addPointOnGraph(doc, at.graph, at.x, "", opOptions()) : pointOnSelectedGraph(doc, sel, opOptions()))),

  /** From the preview's menu: a point on the graph at the x right-clicked, with the tangent there. */
  tangentAt: (at: { graph: Id; x: number }) => perform((doc) => addTangentAt(doc, at.graph, at.x, opOptions())),

  /** Sets a tangent's length, half on each side of its point; typing several digits stays one undo step. */
  resizeTangent: (id: Id, length: number) => {
    const store = useFigureStore.getState();
    const result = resizeTangent(store.doc, id, length);
    if (result.error) toast.error(result.error);
    else store.commit(result.doc, `${id}:tangent-length`);
  },

  /** Roots, turning points or the y crossing of the selected graphs, as points that follow them. */
  markNotable: (feature: NotableFeature) => perform((doc, sel) => markNotable(doc, sel, feature, opOptions())),

  /** Selected segments, polygons and circles become graphs and vertical lines. */
  toFunctions: () => perform((doc, sel) => toFunctions(doc, sel, opOptions())),

  /** A number line under the figure, then "[" in the input bar for its first interval. */
  addNumberLine: () => {
    if (!perform((doc) => addNumberLine(doc))) return;
    startInput("[");
  },

  /** Axes on their own, fitting the figure. */
  addAxes: () => perform((doc) => addAxes(doc)),

  /** A printed grid: over the axes, or around the figure when there are none. */
  addGrid: () => perform((doc) => addGrid(doc)),

  /** Dashed lines from the selected points to the axes, or none when they all have them. */
  toggleGuides: () => perform((doc, sel) => toggleGuides(doc, sel), "keep"),

  /** A point on a graph where the preview was clicked, in Adicionar pontos. */
  addPointOnGraphAt: (graph: Id, x: number) => {
    const store = useFigureStore.getState();
    const before = store.selection;
    const result = store.run((doc) => addPointOnGraph(doc, graph, x, "", opOptions()), "keep");
    if (result.error) {
      toast.error(result.error);
      return false;
    }
    if (activePrefs().behavior.selectAdded) store.select([...before, ...result.created]);
    return true;
  },

  deleteSelected: () => {
    const { selection } = useFigureStore.getState();
    if (selection.length === 0) return false;
    return perform((doc, sel) => deleteElements(doc, sel), "none");
  },

  /** A free point where the preview was clicked. It joins the selection only when the profile asks. */
  addPointAt: (at: { x: number; y: number }) => {
    const store = useFigureStore.getState();
    const before = store.selection;
    const result = store.run((doc) => addPoints(doc, [at], opOptions()), "keep");
    if (result.error) {
      toast.error(result.error);
      return false;
    }
    if (activePrefs().behavior.selectAdded) store.select([...before, ...result.created]);
    return true;
  },

  /** One click of Figura rápida, at a spot or on an existing point. */
  quickFigureAt: (next: { x: number; y: number } | Id) => {
    const store = useFigureStore.getState();
    const before = store.selection;
    const step = quickFigureStep(store.doc, store.quickFigure, next, opOptions());
    if (step.error) {
      toast.error(step.error);
      return false;
    }
    store.commit(step.doc);
    store.setQuickFigure(step.figure ?? NO_QUICK_FIGURE);
    if (activePrefs().behavior.selectAdded) store.select([...before, ...step.created]);
    return true;
  },

  pointOnSegment: (segmentId: Id, at: { ratio: number } | { distance: number }, from: "a" | "b") =>
    perform((doc) => pointOnSegment(doc, segmentId, at, from, opOptions())),

  /** Whole circles or only arcs; back to whole, the sector's radii go too. */
  circleArc: (ids: Id[], on: boolean) => perform((doc) => setCircleArc(doc, ids, on), "keep"),

  /** Draws the radii of arcs as their own segments, or removes them. */
  sectorRadii: (ids: Id[], on: boolean) => perform((doc) => setSectorRadii(doc, ids, on, opOptions()), "keep"),

  /** Adds a free text centered under the figure, where it can then be dragged. */
  addText: (text: string) => {
    const { settings } = useFigureStore.getState();
    return perform((doc) => addText(doc, spotBelow(doc, settings.scale), text, opOptions()));
  },

  /** Runs every opted-in labeling as one undo step. */
  autoLabel: (jobs: AutoLabelJob[], onlySelected: boolean) => {
    const { settings } = useFigureStore.getState();
    return perform(
      (doc, sel) => autoLabelMany(doc, jobs, onlySelected ? sel : null, settings.decimals, opOptions()),
      "keep",
    );
  },

  /** Removes the labels of the opted-in kinds. */
  clearLabels: (jobs: AutoLabelJob[], onlySelected: boolean) =>
    perform((doc, sel) => clearLabels(doc, jobs, onlySelected ? sel : null), "keep"),

  /** Sets a perpendicular bisector's length; typing several digits stays one undo step. */
  resizeBisector: (id: Id, length: number, fixed: boolean) => {
    const store = useFigureStore.getState();
    const result = resizePerpendicularBisector(store.doc, id, length, fixed);
    if (result.error) toast.error(result.error);
    else store.commit(result.doc, `${id}:bisector-length`);
  },

  markBisector: (id: Id, on: boolean) => perform((doc) => markPerpendicularBisector(doc, id, on, opOptions()), "keep"),
};

/** A free spot centered under everything drawn, in world units. */
function spotBelow(doc: FigureDoc, scale: number) {
  const { box, kx, ky } = buildScene(doc, { scale });
  if (!box) return { x: 0, y: 0 };
  // About a line of text below the lowest mark.
  return { x: Math.round(((box.minX + box.maxX) / 2 / kx) * 100) / 100, y: Math.round((-box.maxY / ky - 16 / ky) * 100) / 100 };
}

/** The last selected point, used by R:θ in the point input. */
export function lastSelectedPoint(doc: FigureDoc, selection: Id[]) {
  const pts = pointMap(doc);
  for (let i = selection.length - 1; i >= 0; i--) {
    const p = pts.get(selection[i]);
    if (p) return p;
  }
  return undefined;
}
