import { toast } from "sonner";
import {
  addBasis,
  addCircuitTemplate,
  addComponent,
  placeComponent,
  placeWire,
  fillShapeOperation,
  setShapeOperation,
  type ShapeOperation,
  flipComponent,
  setCircuit,
  updateComponent,
  type CircuitPatch,
  type CircuitTemplate,
  type ComponentKind,
  type ComponentPatch,
  addPoints,
  addText,
  addVennDiagram,
  makeVectors,
  markSetOperation,
  vectorOp,
  type SetOperation,
  type VectorOperation,
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
  addSpot,
  resizeTangent,
  setTangentFill,
  pointMap,
  pointOnSelectedGraph,
  toggleGuides,
  addNumberLine,
  toggleBoardGap,
  setAllBoardGaps,
  addStudySketch,
  insertStudyPoint,
  removeStudyPiece,
  setStudyDividers,
  setStudyBalls,
  fillStudyIntervals,
  type StudyBall,
  setStudyText,
  setStudyWidth,
  updateStudyPoint,
  updateStudySketch,
  type StudyOpResult,
  type StudyPoint,
  type StudySketch,
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
  type Spot,
} from "@geosimples/core/figure";
import { useFigureStore } from "@/store/figureStore";
import { currentStudyFocus } from "@/lib/studyFocus";
import { emitCommand } from "@/lib/commands";
import { useInputHint } from "@/store/inputHintStore";
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

/**
 * Runs an op on a study, as one undo step merged by `key`, and picks the piece
 * it names: a point just put in, a sketch just added, or none after a removal.
 */
function studyEdit(owner: Id, op: (doc: FigureDoc) => StudyOpResult, key?: string): boolean {
  const store = useFigureStore.getState();
  const result = op(store.doc);
  if (result.error) {
    toast.error(result.error);
    return false;
  }
  store.commit(result.doc, key ? `${owner}:${key}` : undefined);
  if (result.part !== undefined) store.setFocus({ owner, path: result.part });
  return true;
}

const selectedPoints = (doc: FigureDoc, selection: Id[]) =>
  selectedOfType(doc, selection, "point").map((p) => p.id);

/** Text typed in for the teacher to finish in the input bar, like "y = ". Text already there stays. */
export const PREFILLS = ["texto: ", "y = ", "x = ", "[", "vetor ", "região ", "A={", "conta ", "fatorar ", "mmc(", "mdc(", "euclides(", "varal ", "sinal ", "quadro ", "modular "];

function startInput(prefill: string, hint?: string) {
  const store = useFigureStore.getState();
  if (store.inputDraft.trim() === "") store.setInputDraft(prefill);
  useInputHint.getState().setHint(hint ?? null);
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
  startGraph: () => startInput("y = ", "Digite a função na forma y = f(x), como y = 3x, ou f(x) = 3x. Enter para desenhar."),

  /** Starts a vertical line: "x = " in the input bar, ready for the number. */
  startVerticalLine: () => startInput("x = ", "Digite onde a reta corta o eixo x, como x = 2."),

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

  /** Makes a tangent reach across the axes' window, or keep the length it has now. */
  fillTangent: (id: Id, on: boolean) => perform((doc) => setTangentFill(doc, id, on), "keep"),

  /** The crossing, root or turning point the preview showed under the pointer, as a point that follows it. */
  addSpot: (spot: Spot) => perform((doc) => addSpot(doc, spot, opOptions())),

  /** Roots, turning points or the y crossing of the selected graphs, as points that follow them. */
  markNotable: (feature: NotableFeature) => perform((doc, sel) => markNotable(doc, sel, feature, opOptions())),

  /** Selected segments, polygons and circles become graphs and vertical lines. */
  toFunctions: () => perform((doc, sel) => toFunctions(doc, sel, opOptions())),

  /** A number line under the figure, then "[" in the input bar for its first interval. */
  addNumberLine: () => {
    if (!perform((doc) => addNumberLine(doc))) return;
    startInput("[");
  },

  /** Leaves a result of the selected board out, or puts it back. */
  toggleGap: (id: Id, index: number) => perform((doc) => toggleBoardGap(doc, id, index), "keep"),

  /** Estudo na reta: a blank point in the middle of a stretch, picked to be named. */
  insertStudyPoint: (owner: Id, stretch: number) => studyEdit(owner, (doc) => insertStudyPoint(doc, owner, stretch)),
  removeStudyPiece: (owner: Id, path: string) => studyEdit(owner, (doc) => removeStudyPiece(doc, owner, path)),
  setStudyText: (owner: Id, path: string, text: string) => studyEdit(owner, (doc) => setStudyText(doc, owner, path, text), `text:${path}`),
  updateStudyPoint: (owner: Id, point: Id, patch: Partial<Pick<StudyPoint, "ball" | "divider" | "drop">>) =>
    studyEdit(owner, (doc) => updateStudyPoint(doc, owner, point, patch), `point:${point}:${Object.keys(patch).join()}`),
  setStudyDividers: (owner: Id, on: boolean) => studyEdit(owner, (doc) => setStudyDividers(doc, owner, on)),
  setStudyBalls: (owner: Id, ball: StudyBall) => studyEdit(owner, (doc) => setStudyBalls(doc, owner, ball)),
  fillStudyIntervals: (owner: Id) => studyEdit(owner, (doc) => fillStudyIntervals(doc, owner)),
  setStudyWidth: (owner: Id, stretch: number, width: number) => studyEdit(owner, (doc) => setStudyWidth(doc, owner, stretch, width), `width:${stretch}`),
  addStudySketch: (owner: Id, shape: StudySketch["shape"]) => studyEdit(owner, (doc) => addStudySketch(doc, owner, shape)),
  updateStudySketch: (owner: Id, sketch: Id, patch: Partial<Pick<StudySketch, "shape" | "up" | "roots">>) =>
    studyEdit(owner, (doc) => updateStudySketch(doc, owner, sketch, patch)),

  /** Every result of the board as a gap, or none. */
  allGaps: (id: Id, all: boolean) => perform((doc) => setAllBoardGaps(doc, id, all), "keep"),

  /** Text that starts something typed in the input bar, like "mmc(", with a balloon saying what to type. */
  startTyping: (prefill: string, hint?: string) => startInput(prefill, hint),

  /** An arrow from each selected point to the next. */
  vector: () => perform((doc, sel) => makeVectors(doc, sel, opOptions())),

  /** Builds on the selected vectors: sum, difference, projection and the rest. */
  vectorOp: (op: VectorOperation) => perform((doc, sel) => vectorOp(doc, sel, op, opOptions())),

  /** A circuit piece between the two selected points. */
  component: (kind: ComponentKind) => perform((doc, sel) => addComponent(doc, sel, kind, opOptions())),

  /**
   * A piece on its own, under the figure, with no points to pick: selected,
   * and Mover on, so it can be dragged into place right away.
   */
  placeComponent: (kind: ComponentKind) => {
    if (perform((doc) => placeComponent(doc, kind, opOptions()))) useFigureStore.getState().setMode("move");
  },

  /** A wire on its own, to drag between two ends. */
  placeWire: () => {
    if (perform((doc) => placeWire(doc, opOptions()))) useFigureStore.getState().setMode("move");
  },

  /** Fills the union, intersection, difference or exclusion of the selected shapes. */
  shapeOperation: (op: ShapeOperation) => perform((doc, sel) => fillShapeOperation(doc, sel, op, opOptions())),

  /** Changes what a fill between shapes covers. */
  setShapeOperation: (id: Id, op: ShapeOperation) => perform((doc) => setShapeOperation(doc, id, op), "keep"),

  /** A ready-made circuit, right of the figure. */
  circuitTemplate: (template: CircuitTemplate): boolean => perform((doc) => addCircuitTemplate(doc, template, opOptions())),

  /** Switches the circuit on or off, and picks its current arrows and what it writes. */
  circuit: (patch: CircuitPatch) => perform((doc) => setCircuit(doc, patch, opOptions()), "keep"),

  /** Changes a piece's kind, value or switch; typing a value stays one undo step. */
  updateComponent: (id: Id, patch: ComponentPatch, key: string) => {
    const store = useFigureStore.getState();
    const result = updateComponent(store.doc, id, patch);
    if (result.error) toast.error(result.error);
    else store.commit(result.doc, `${id}:${key}`);
  },

  /** Turns a piece around, as a source's poles. */
  flipComponent: (id: Id) => perform((doc) => flipComponent(doc, id), "keep"),

  /** The versors i and j from the origin. */
  basis: () => perform((doc) => addBasis(doc, opOptions())),

  /** Shades the union, intersection, difference or complement of the selected sets. */
  setOperation: (op: SetOperation) => perform((doc, sel) => markSetOperation(doc, sel, op, opOptions())),

  /** A Venn diagram of 1 to 3 sets. */
  venn: (n: 1 | 2 | 3) => perform((doc) => addVennDiagram(doc, n, opOptions())),

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
    // Inside a study, Delete takes the piece picked, not the whole study; with none picked, nothing.
    const inside = currentStudyFocus();
    if (inside) {
      const { study, path } = inside;
      return path ? studyEdit(study.id, (d) => removeStudyPiece(d, study.id, path)) : false;
    }
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
