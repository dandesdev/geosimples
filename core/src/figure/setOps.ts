import { DEFAULT_STYLES } from "./defaults";
import { pointMap, resolveConstructions } from "./geometry";
import { withText } from "./labels";
import { idMaker, LIMIT_ERROR, roomFor, withElements, type OpOptions, type OpResult } from "./ops";
import { insideShape, regionLoops, parseSetExpr, regionTest, shapeOf, usesUniverse, vennShapes } from "./sets";
import type { Circle, Element, FigureDoc, Id, Point, Polygon, Region, VennItems } from "./types";
import { type Vec } from "./vec";

const fail = (doc: FigureDoc, error: string): OpResult => ({ doc, created: [], error });
const stylesOf = (opts: OpOptions) => opts.styles ?? DEFAULT_STYLES;

/** Radius of a new set, and how far the universe stands off the sets, in cm. */
const SET_RADIUS = 2;
const UNIVERSE_MARGIN = 0.9;

/** Centers of 1 to 3 sets, and the side of each set where its name goes, in degrees. */
function vennLayout(count: number): { at: Vec; angle: number }[] {
  if (count === 1) return [{ at: { x: 0, y: 0 }, angle: 135 }];
  if (count === 2) {
    return [
      { at: { x: -1.3, y: 0 }, angle: 135 },
      { at: { x: 1.3, y: 0 }, angle: 45 },
    ];
  }
  return [
    { at: { x: -1.3, y: 0.85 }, angle: 135 },
    { at: { x: 1.3, y: 0.85 }, angle: 45 },
    { at: { x: 0, y: -1.3 }, angle: 270 },
  ];
}

function bounds(centers: Vec[]) {
  const pad = SET_RADIUS + UNIVERSE_MARGIN;
  return {
    x0: Math.min(...centers.map((c) => c.x)) - pad,
    x1: Math.max(...centers.map((c) => c.x)) + pad,
    y0: Math.min(...centers.map((c) => c.y)) - pad,
    y1: Math.max(...centers.map((c) => c.y)) + pad,
  };
}

/** How far down a new diagram goes so it doesn't land on what is drawn: under everything, with a gap. */
function shiftBelow(doc: FigureDoc, height: number): number {
  const ys = doc.elements.flatMap((e) => (e.type === "point" || e.type === "text" || e.type === "board" ? [e.y] : []));
  if (ys.length === 0) return 0;
  return Math.min(...ys) - height / 2 - 1.5;
}

const SET_LETTERS = ["A", "B", "C"];

/** A diagram with `names` as sets (1 to 3) inside a rectangle named U. The points that hold it are hidden. */
export function addVennDiagram(doc: FigureDoc, names: string[] | number, opts: OpOptions = {}): OpResult {
  const list = typeof names === "number" ? SET_LETTERS.slice(0, names) : names;
  if (list.length < 1 || list.length > 3) return fail(doc, "O diagrama tem de 1 a 3 conjuntos.");
  if (vennShapes(doc).universe) return fail(doc, "A figura já tem um diagrama. Digite A={1,2} para mudar os conjuntos dele.");
  if (!roomFor(doc, 2 * list.length + 5)) return fail(doc, LIMIT_ERROR);
  const styles = stylesOf(opts);
  const nextId = idMaker(doc);
  const layout = vennLayout(list.length);
  const box = bounds(layout.map((l) => l.at));
  const dy = shiftBelow(doc, box.y1 - box.y0);
  const hidden = (at: Vec): Point => ({ id: nextId("point"), type: "point", x: at.x, y: at.y + dy, ...styles.point, shape: "none" });
  const centers = layout.map((l) => hidden(l.at));
  const circles = list.map((name, i): Circle => ({
    id: nextId("circle"),
    type: "circle",
    center: centers[i].id,
    radius: SET_RADIUS,
    construction: { kind: "free" },
    arc: null,
    radii: false,
    stroke: { ...styles.stroke },
    fill: null,
    label: { ...withText(undefined, name, styles.label), angle: layout[i].angle },
  }));
  const corners = [
    { x: box.x0, y: box.y0 },
    { x: box.x1, y: box.y0 },
    { x: box.x1, y: box.y1 },
    { x: box.x0, y: box.y1 },
  ].map(hidden);
  const universe: Polygon = {
    id: nextId("polygon"),
    type: "polygon",
    vertices: corners.map((p) => p.id),
    stroke: { ...styles.stroke },
    fill: null,
    universe: true,
    label: withText(undefined, "U", styles.label),
  };
  const elements: Element[] = [universe, ...circles, ...doc.elements, ...centers, ...corners];
  return { doc: withElements(doc, elements), created: circles.map((c) => c.id) };
}

/** Adds a set to the diagram and spreads the sets out again. */
function growDiagram(doc: FigureDoc, name: string, opts: OpOptions): OpResult {
  const { sets, universe } = vennShapes(doc);
  if (!universe) return addVennDiagram(doc, [name], opts);
  const circles = sets.flatMap((s) => {
    const el = doc.elements.find((e) => e.id === s.id);
    return el?.type === "circle" ? [el] : [];
  });
  if (circles.length !== sets.length || circles.length >= 3) return fail(doc, `O diagrama já tem o máximo de 3 conjuntos. Não há onde pôr ${name}.`);
  const styles = stylesOf(opts);
  const layout = vennLayout(circles.length + 1);
  const pts = pointMap(doc);
  const middle = universe.vertices.map((id) => pts.get(id)!);
  const center = {
    x: (Math.min(...middle.map((p) => p.x)) + Math.max(...middle.map((p) => p.x))) / 2,
    y: (Math.min(...middle.map((p) => p.y)) + Math.max(...middle.map((p) => p.y))) / 2,
  };
  const nextId = idMaker(doc);
  const at = (i: number): Vec => ({ x: center.x + layout[i].at.x, y: center.y + layout[i].at.y });
  const newCenter: Point = { id: nextId("point"), type: "point", ...at(circles.length), ...styles.point, shape: "none" };
  const circle: Circle = {
    id: nextId("circle"),
    type: "circle",
    center: newCenter.id,
    radius: SET_RADIUS,
    construction: { kind: "free" },
    arc: null,
    radii: false,
    stroke: { ...styles.stroke },
    fill: null,
    label: { ...withText(undefined, name, styles.label), angle: layout[circles.length].angle },
  };
  const box = bounds(layout.map((_, i) => at(i)));
  const cornerSpots: Vec[] = [
    { x: box.x0, y: box.y0 },
    { x: box.x1, y: box.y0 },
    { x: box.x1, y: box.y1 },
    { x: box.x0, y: box.y1 },
  ];
  const moved = new Map<Id, Vec>();
  circles.forEach((c, i) => moved.set(c.center, at(i)));
  universe.vertices.forEach((id, i) => moved.set(id, cornerSpots[i]));
  const elements = doc.elements.flatMap((e): Element[] => {
    if (e.type === "point" && moved.has(e.id)) return [{ ...e, ...moved.get(e.id)! }];
    if (e.type === "circle" && circles.some((c) => c.id === e.id)) {
      const i = circles.findIndex((c) => c.id === e.id);
      return [{ ...e, label: e.label && { ...e.label, angle: layout[i].angle } }];
    }
    return [e];
  });
  // After the other circles: the order of the sets is the order of their spots in the layout.
  const lastCircle = elements.map((e) => e.type).lastIndexOf("circle");
  const inOrder = [...elements.slice(0, lastCircle + 1), circle, ...elements.slice(lastCircle + 1), newCenter];
  return { doc: resolveConstructions(withElements(doc, inOrder)), created: [circle.id] };
}

/** Marks the part of the figure an expression describes, from the sets named in it. */
export function addRegion(doc: FigureDoc, text: string, opts: OpOptions = {}): OpResult {
  const parsed = parseSetExpr(text);
  if (!parsed.ok) return fail(doc, parsed.error);
  if (!roomFor(doc, 1)) return fail(doc, LIMIT_ERROR);
  const { sets, universe } = vennShapes(doc);
  const named = parsed.names.map((name) => ({ name, shape: sets.find((s) => s.name === name)?.id }));
  const missing = named.find((n) => !n.shape);
  if (missing) return fail(doc, `Não há conjunto chamado ${missing.name} na figura. Crie o diagrama em Conjuntos, ou digite ${missing.name}={1,2}.`);
  if (usesUniverse(parsed.expr) && !universe) return fail(doc, "O complementar precisa de um universo: crie o diagrama em Conjuntos.");
  const styles = stylesOf(opts);
  const region: Region = {
    id: idMaker(doc)("region"),
    type: "region",
    expr: text.trim(),
    sets: named.map((n) => ({ name: n.name, shape: n.shape as Id })),
    universe: universe?.id ?? null,
    fill: { ...styles.fill },
    stroke: null,
  };
  const test = regionTest(doc, region);
  if (!test || regionLoops(test.shapes, test.inside).length === 0) return fail(doc, "Essa região está vazia na figura.");
  // First, so its fill sits under the outlines of the sets.
  return { doc: withElements(doc, [region, ...doc.elements]), created: [region.id] };
}

/** Changes what a region covers. The new text is checked like a new region, and its look stays. */
export function setRegionExpr(doc: FigureDoc, id: Id, text: string, opts: OpOptions = {}): OpResult {
  const old = doc.elements.find((e): e is Region => e.id === id && e.type === "region");
  if (!old) return fail(doc, "Essa região está vazia na figura.");
  const rest = withElements(doc, doc.elements.filter((e) => e.id !== id));
  const made = addRegion(rest, text, opts);
  if (made.error) return fail(doc, made.error);
  const fresh = made.doc.elements.find((e): e is Region => e.id === made.created[0] && e.type === "region")!;
  const next: Region = { ...old, expr: fresh.expr, sets: fresh.sets, universe: fresh.universe };
  return { doc: withElements(doc, doc.elements.map((e) => (e.id === id ? next : e))), created: [id] };
}

/** The operations of the Conjuntos menu. */
export type SetOperation = "union" | "inter" | "diff" | "comp";

const joined = (names: string[], sign: string) => names.join(sign);

/**
 * Marks the union, intersection, difference or complement of the selected
 * sets, in the order selected. With none selected it uses all the sets; a
 * difference then needs exactly two, so its order is clear.
 */
export function markSetOperation(doc: FigureDoc, selection: Id[], op: SetOperation, opts: OpOptions = {}): OpResult {
  const { sets } = vennShapes(doc);
  if (sets.length === 0) return fail(doc, "Crie o diagrama antes, no menu Conjuntos.");
  const chosen = selection.flatMap((id) => sets.filter((s) => s.id === id).map((s) => s.name));
  const all = sets.map((s) => s.name);
  let expr: string;
  if (op === "comp") {
    const names = chosen.length > 0 ? chosen : all;
    expr = names.length === 1 ? `${names[0]}'` : `(${joined(names, "∪")})'`;
  } else if (op === "diff") {
    const names = chosen.length >= 2 ? chosen : chosen.length === 0 && all.length === 2 ? all : null;
    if (!names) return fail(doc, "Selecione primeiro o conjunto de onde tirar, depois o que será tirado.");
    expr = joined(names, "−");
  } else {
    const names = chosen.length >= 2 ? chosen : chosen.length === 0 && all.length >= 2 ? all : null;
    if (!names) return fail(doc, "Selecione ao menos dois conjuntos, ou nenhum para usar todos.");
    expr = joined(names, op === "union" ? "∪" : "∩");
  }
  return addRegion(doc, expr, opts);
}

function itemsOf(doc: FigureDoc): VennItems | undefined {
  return doc.elements.find((e): e is VennItems => e.type === "vennitems");
}

function withItems(doc: FigureDoc, opts: OpOptions, change: (el: VennItems) => VennItems): OpResult {
  const existing = itemsOf(doc);
  if (existing) return { doc: withElements(doc, doc.elements.map((e) => (e === existing ? change(existing) : e))), created: [existing.id] };
  if (!roomFor(doc, 1)) return fail(doc, LIMIT_ERROR);
  const { size, color, font } = stylesOf(opts).label;
  const fresh: VennItems = { id: idMaker(doc)("vennitems"), type: "vennitems", members: [], counts: [], size, color, font };
  const next = change(fresh);
  return { doc: withElements(doc, [...doc.elements, next]), created: [next.id] };
}

/** Writes the elements of a set in the diagram, as typed in A={1,2,3}. A set that isn't there yet is created. */
export function setMembers(doc: FigureDoc, name: string, items: string[], opts: OpOptions = {}): OpResult {
  let working = doc;
  let { sets, universe } = vennShapes(working);
  const isUniverse = name === "U" || name === "Ω";
  if (isUniverse && !universe) {
    const made = addVennDiagram(working, 1, opts);
    if (made.error) return made;
    working = made.doc;
    ({ sets, universe } = vennShapes(working));
  } else if (!isUniverse && !sets.some((s) => s.name === name)) {
    const made = growDiagram(working, name, opts);
    if (made.error) return fail(doc, made.error);
    working = made.doc;
    ({ sets, universe } = vennShapes(working));
  }
  const target = isUniverse ? universe!.id : sets.find((s) => s.name === name)!.id;
  return withItems(working, opts, (el) => ({ ...el, members: [...el.members.filter((m) => m.set !== target), { set: target, items }] }));
}

/** Writes a count in one region of the diagram, as typed in n(A∩B)=3. Expressions over several regions are refused. */
export function setRegionCount(doc: FigureDoc, text: string, value: string, opts: OpOptions = {}): OpResult {
  const parsed = parseSetExpr(text);
  if (!parsed.ok) return fail(doc, parsed.error);
  const { sets } = vennShapes(doc);
  const missing = parsed.names.find((n) => !sets.some((s) => s.name === n));
  if (missing) return fail(doc, `Não há conjunto chamado ${missing} na figura.`);
  const region: Region = {
    id: "z0",
    type: "region",
    expr: text,
    sets: sets.map((s) => ({ name: s.name, shape: s.id })),
    universe: vennShapes(doc).universe?.id ?? null,
    fill: { ...stylesOf(opts).fill },
    stroke: null,
  };
  const test = regionTest(doc, region);
  if (!test) return fail(doc, "Crie o diagrama antes: o complementar precisa do universo.");
  const atoms = atomsIn(sets.map((s) => s.id), (inSets) => {
    const spot = spotOf(doc, inSets);
    return spot !== null && test.inside(spot);
  });
  if (atoms.length !== 1) {
    return fail(doc, "Essa expressão ocupa mais de uma região do diagrama. Informe uma região só, como n(A∩B)=3 ou n(A−B)=2.");
  }
  const key = [...atoms[0]].sort().join(",");
  return withItems(doc, opts, (el) => ({
    ...el,
    counts: [...el.counts.filter((c) => [...c.in].sort().join(",") !== key), { in: atoms[0], text: value }],
  }));
}

/** Every region of the diagram, as the sets each one is in, that `covered` accepts. */
function atomsIn(ids: Id[], covered: (sets: Id[]) => boolean): Id[][] {
  const out: Id[][] = [];
  for (let mask = 0; mask < 1 << ids.length; mask++) {
    const sets = ids.filter((_, i) => mask & (1 << i));
    if (covered(sets)) out.push(sets);
  }
  return out;
}

/** Some spot of the region that is in exactly these sets, or null when the figure has no such region. */
function spotOf(doc: FigureDoc, wanted: Id[]): Vec | null {
  const { sets, universe } = vennShapes(doc);
  const universeShape = universe ? shapeOf(universe, pointMap(doc)) : null;
  const shapes = [...sets.map((s) => s.shape), ...(universeShape ? [universeShape] : [])];
  const corners = shapes.flatMap((s) => (s.kind === "circle" ? [{ x: s.c.x - s.r, y: s.c.y - s.r }, { x: s.c.x + s.r, y: s.c.y + s.r }] : s.vs));
  const [x0, x1] = [Math.min(...corners.map((p) => p.x)), Math.max(...corners.map((p) => p.x))];
  const [y0, y1] = [Math.min(...corners.map((p) => p.y)), Math.max(...corners.map((p) => p.y))];
  for (let i = 1; i < 50; i++) {
    for (let j = 1; j < 50; j++) {
      const p = { x: x0 + ((x1 - x0) * i) / 50, y: y0 + ((y1 - y0) * j) / 50 };
      if ((!universeShape || insideShape(universeShape, p)) && sets.every((s) => insideShape(s.shape, p) === wanted.includes(s.id))) return p;
    }
  }
  return null;
}

/** What filling the selected shapes covers, as in Illustrator's Pathfinder. */
export type ShapeOperation = "union" | "inter" | "diff" | "xor";

export const SHAPE_OPERATIONS: readonly ShapeOperation[] = ["union", "inter", "diff", "xor"];

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

/**
 * Fills the union, intersection, difference (the first selected minus the
 * others) or exclusive or (two shapes) of the selected circles and polygons:
 * a region that follows the shapes as they move, like the regions of a Venn
 * diagram, and is written as one exact path.
 */
export function fillShapeOperation(doc: FigureDoc, selection: Id[], op: ShapeOperation, opts: OpOptions = {}): OpResult {
  const byId = new Map(doc.elements.map((e) => [e.id, e]));
  const pts = pointMap(doc);
  const shapes = selection.filter((id) => {
    const el = byId.get(id);
    return (el?.type === "circle" || (el?.type === "polygon" && !el.universe)) && shapeOf(el, pts);
  });
  if (shapes.length < 2) return fail(doc, "Selecione duas ou mais circunferências ou polígonos.");
  if (op === "xor" && shapes.length !== 2) return fail(doc, "A exclusão é entre duas formas: selecione só duas.");
  if (!roomFor(doc, 1)) return fail(doc, LIMIT_ERROR);
  const names = shapes.map((_, i) => `S${String(i + 1).replace(/\d/g, (d) => SUBSCRIPT_DIGITS[Number(d)])}`);
  const expr = shapeExpr(names, op);
  const region: Region = {
    id: idMaker(doc)("region"),
    type: "region",
    expr,
    sets: shapes.map((shape, i) => ({ name: names[i], shape })),
    universe: null,
    fill: { ...stylesOf(opts).fill },
    stroke: null,
  };
  const test = regionTest(doc, region);
  if (!test || regionLoops(test.shapes, test.inside).length === 0) {
    return fail(doc, op === "inter" ? "As formas não se cruzam: a interseção é vazia." : "Essa região está vazia na figura.");
  }
  // First, so its fill sits under the outlines.
  return { doc: withElements(doc, [region, ...doc.elements]), created: [region.id] };
}

function shapeExpr(names: string[], op: ShapeOperation): string {
  if (op === "union") return names.join("∪");
  if (op === "inter") return names.join("∩");
  if (op === "diff") return names.join("−");
  return `(${names[0]}−${names[1]})∪(${names[1]}−${names[0]})`;
}

/** Whether a region fills an operation between shapes (from fillShapeOperation), and which one. */
export function shapeOperationOf(region: Region): ShapeOperation | null {
  if (region.universe !== null || !region.sets.every((s) => /^S[₀-₉]+$/u.test(s.name))) return null;
  const names = region.sets.map((s) => s.name);
  return SHAPE_OPERATIONS.find((op) => (op !== "xor" || names.length === 2) && shapeExpr(names, op) === region.expr) ?? null;
}

/** Changes what a fill between shapes covers, keeping its shapes and its look. */
export function setShapeOperation(doc: FigureDoc, id: Id, op: ShapeOperation): OpResult {
  const region = doc.elements.find((e): e is Region => e.id === id && e.type === "region");
  if (!region || !shapeOperationOf(region)) return fail(doc, "Essa região não é um preenchimento entre formas.");
  if (op === "xor" && region.sets.length !== 2) return fail(doc, "A exclusão é entre duas formas.");
  const next: Region = { ...region, expr: shapeExpr(region.sets.map((s) => s.name), op) };
  const test = regionTest(doc, next);
  if (!test || regionLoops(test.shapes, test.inside).length === 0) return fail(doc, "Essa região está vazia na figura.");
  return { doc: withElements(doc, doc.elements.map((e) => (e.id === id ? next : e))), created: [id] };
}
