import { toast } from "sonner";
import {
  addPoints,
  connectPoints,
  construct,
  fitFigure,
  makeAngles,
  makeCircle,
  selectedOfType,
  type CircleMode,
  type ConstructionKind,
  type FigureDoc,
  type Id,
  type OpResult,
} from "@geosimples/core/figure";
import { changedIds } from "@/lib/availability";
import { useFigureStore, type ActiveTool } from "@/store/figureStore";
import { opOptions } from "@/store/prefsStore";

/*
 * Tools chosen before what they work on. Clicked with a selection that is
 * enough, a tool runs on it at once, as always. Otherwise it waits: each click
 * in the preview picks an object (the selection, in order, so the picks show
 * as selected and numbered), and the tool runs as soon as its operation
 * succeeds on the picks. That needs no list of what each tool takes: the
 * operation itself says when it has enough. Some tools put a point on an
 * empty spot that is clicked; Ligar keeps drawing a path from its last point.
 */

type Spec = Omit<ActiveTool, "id" | "title" | "chainStart">;

const points = (doc: FigureDoc, picks: Id[]) => selectedOfType(doc, picks, "point").map((p) => p.id);

const circle = (mode: CircleMode, max: number, createsPoints: boolean, prompt: string): Spec => ({
  prompt,
  op: (doc, picks) => makeCircle(doc, picks, mode, opOptions()),
  createsPoints,
  chain: false,
  max,
});

const build = (kind: ConstructionKind, max: number, prompt: string): Spec => ({
  prompt,
  op: (doc, picks) => construct(doc, picks, kind, opOptions()),
  createsPoints: false,
  chain: false,
  max,
});

/** The tools that can be chosen first, by their id in the Ferramentas panel. */
const SPECS: Record<string, Spec> = {
  connect: {
    prompt: "Clique nos pontos em sequência, ou no vazio para criar um. O 1º fecha o caminho.",
    op: (doc, picks) => connectPoints(doc, points(doc, picks), false, opOptions()),
    createsPoints: true,
    chain: true,
    max: 2,
  },
  angle: {
    prompt: "Clique em três pontos, com o vértice no meio, ou num polígono.",
    op: (doc, picks) => makeAngles(doc, picks, opOptions()),
    createsPoints: false,
    chain: false,
    max: 3,
  },
  "circle-radius": circle("radius", 1, true, "Clique no centro: um ponto, ou o vazio para criar um."),
  "circle-through": circle("through", 2, true, "Clique no centro e depois num ponto da circunferência, ou no vazio para criá-los."),
  "circle-tangent": circle("tangent", 2, false, "Clique no centro e depois no segmento que ela tangencia."),
  "circle-circumcircle": circle("circumcircle", 3, true, "Clique em três pontos, ou no vazio para criá-los."),
  "construct-midpoint": build("midpoint", 2, "Clique num segmento, ou em dois pontos."),
  "construct-altitude": build("altitude", 3, "Clique no vértice e depois no lado oposto, ou num triângulo."),
  "construct-projection": build("projection", 3, "Clique no ponto e depois no segmento onde ele cai."),
  "construct-median": build("median", 3, "Clique no vértice e depois no lado oposto, ou num triângulo."),
  "construct-bisector": build("bisector", 3, "Clique em três pontos, com o vértice no meio, ou num triângulo."),
  "construct-perpendicularBisector": build("perpendicularBisector", 2, "Clique num segmento, ou em dois pontos."),
  "construct-intersection": build("intersection", 2, "Clique em dois objetos que se cruzam."),
};

/** Whether the tool `id` can wait for its objects in this figure: it has something to pick, or can make it. */
export function canPick(id: string, doc: FigureDoc): boolean {
  const spec = SPECS[id];
  return !!spec && (spec.createsPoints || doc.elements.length > 0);
}

/**
 * Starts the tool `id`, or ends it if it is on. What is selected counts as its
 * first picks when it is fewer than the tool takes.
 */
export function startTool(id: string, title: string) {
  const store = useFigureStore.getState();
  if (store.tool?.id === id) {
    stopTool();
    return;
  }
  const spec = SPECS[id];
  if (!spec) return;
  store.setActionPreview(null);
  store.setTool({ ...spec, id, title });
  if (store.selection.length >= spec.max) store.select([]);
}

export function stopTool() {
  const store = useFigureStore.getState();
  if (!store.tool) return;
  store.setTool(null);
  store.setActionPreview(null);
  store.select([]);
}

/** The last click, to tell a double click, which ends the tool. */
let lastClick = { time: 0, x: 0, y: 0 };

/**
 * A click in the preview while a tool waits: on `owner`, or on an empty spot
 * at `at` (world units; `client` is where on the screen, to tell a double click).
 */
export function toolClick(owner: Id | null, at: { x: number; y: number }, client: { x: number; y: number }) {
  const store = useFigureStore.getState();
  const tool = store.tool;
  if (!tool) return;
  let doc = store.doc;
  const picks = store.selection.filter((id) => doc.elements.some((e) => e.id === id));
  let target = owner && doc.elements.some((e) => e.id === owner) ? owner : null;

  // The second click of a double click ends the tool; the first one already did its part.
  const now = performance.now();
  const twice = now - lastClick.time < 350 && Math.hypot(client.x - lastClick.x, client.y - lastClick.y) < 8;
  lastClick = twice ? { time: 0, x: 0, y: 0 } : { time: now, ...client };
  if (twice) {
    stopTool();
    return;
  }

  if (!target) {
    if (!tool.createsPoints) return;
    const added = addPoints(doc, [at], opOptions());
    if (added.error) {
      toast.error(added.error);
      return;
    }
    doc = added.doc;
    target = added.created[0];
  }

  const last = picks[picks.length - 1];
  // The path's first point closes it; its last point ends it.
  const closing = tool.chain && target === tool.chainStart && picks.length === 1 && last !== target;
  if (!closing && picks.includes(target)) {
    if (tool.chain && target === last) endChain();
    else store.select(picks.filter((id) => id !== target));
    return;
  }

  const next = [...picks, target];
  const result = tool.op(doc, next);
  if (!result.error) {
    store.commit(result.doc);
    if (result.notice) toast(result.notice);
    store.setActionPreview(null);
    if (tool.chain && !closing) {
      store.setTool({ ...tool, chainStart: tool.chainStart ?? next[0] });
      store.select([target]);
    } else {
      endChain();
    }
    return;
  }
  // Not enough yet: a point made on the way stays, and the pick waits for the next click.
  if (doc !== store.doc) store.commit(doc);
  if (next.length >= tool.max) {
    toast.error(result.error);
    endChain();
    return;
  }
  store.select(next);
}

/** Ends the path Ligar is drawing; the tool stays on for another. */
function endChain() {
  const store = useFigureStore.getState();
  if (store.tool?.chainStart) store.setTool({ ...store.tool, chainStart: undefined });
  store.select([]);
}

/**
 * Shows what a click would make, while the pointer is over `owner` or an empty
 * spot at `at`: the tool's result, if that click would complete it.
 */
export function toolHover(owner: Id | null, at: { x: number; y: number }) {
  const store = useFigureStore.getState();
  const tool = store.tool;
  if (!tool) return;
  const result = hoverResult(tool, store.doc, store.selection, owner, at);
  if (!result || result.error) {
    if (store.actionPreview) store.setActionPreview(null);
    return;
  }
  const after = fitFigure(result.doc);
  store.setActionPreview({ doc: after, ids: changedIds(store.doc, after) });
}

function hoverResult(tool: ActiveTool, doc: FigureDoc, selection: Id[], owner: Id | null, at: { x: number; y: number }): OpResult | null {
  let base = doc;
  let target = owner && doc.elements.some((e) => e.id === owner) ? owner : null;
  if (!target) {
    if (!tool.createsPoints) return null;
    const added = addPoints(doc, [at], opOptions());
    if (added.error) return null;
    base = added.doc;
    target = added.created[0];
  }
  const closing = tool.chain && target === tool.chainStart && selection.length === 1 && selection[0] !== target;
  if (!closing && selection.includes(target)) return null;
  return tool.op(base, [...selection, target]);
}
