import {
  addBasis,
  addBoard,
  addCircuitTemplate,
  addComponent,
  setCircuit,
  tidyJunctions,
  updateComponent,
  addRegion,
  addVector,
  addVennDiagram,
  setMembers,
  setRegionCount,
  vectorOp,
  addAxes,
  addFunction,
  addGrid,
  addInterval,
  addNumberLine,
  addPointOnGraph,
  addPoints,
  addText,
  addVerticalLine,
  applyInput,
  autoLabel,
  connectPoints,
  DEFAULT_STYLES,
  emptyDoc,
  fitFigure,
  INK,
  isValidColor,
  LIMITS,
  makeAltitude,
  makeAngles,
  makeBisector,
  makeCircle,
  makeIntersection,
  makeMedian,
  makeMidpoint,
  makePerpendicularBisector,
  makePolygon,
  makeProjection,
  makeTangent,
  markNotable,
  measureNumber,
  newMeasure,
  normalizeDoc,
  parseInput,
  pointMap,
  removeLabels,
  resizeTangent,
  setAxesWindow,
  setCircleArc,
  setSectorRadii,
  setTangentFill,
  toggleGuides,
  translate,
  unclutterLabels,
  updateElements,
  withText,
  type Axes,
  type Element,
  type ElementType,
  type FigureDoc,
  type Fill,
  type Id,
  type Label,
  type LabelScheme,
  type MeasureKind,
  type OpOptions,
  type OpResult,
  type ParsedPoint,
  type Point,
  type Polygon,
  type Stroke,
  type StyleDefaults,
} from "../figure";
import { add, polar, type Vec } from "../figure/vec";
import {
  recipeSchema,
  type LabelSpec,
  type Recipe,
  type RecipeDefaults,
  type RecipeStep,
  type StepOf,
  type StylePatch,
  type Target,
} from "./schema";

export type RecipeErrorCode =
  /** The recipe doesn't match the schema. */
  | "invalid"
  /** A name no earlier step made. */
  | "unknown_name"
  /** A name or target of the wrong kind, like a circle where a point goes. */
  | "wrong_kind"
  /** A name used twice for different things. */
  | "duplicate_name"
  /** Numbers that can't make the shape, like sides breaking the triangle inequality. */
  | "impossible"
  /** The editor operation refused; the message is its own, in English. */
  | "op_failed";

export interface RecipeIssue {
  /** Index of the step, or null for the recipe as a whole. */
  step: number | null;
  code: RecipeErrorCode;
  message: string;
}

export interface CompileResult {
  ok: boolean;
  /** The figure built so far: complete when ok, up to the failing step otherwise. */
  doc: FigureDoc;
  /** Names the recipe can refer to, and the ids they stand for. */
  names: Record<string, Id[]>;
  errors: RecipeIssue[];
  /** Things done differently from what was asked, which didn't stop the figure. */
  warnings: RecipeIssue[];
}

export interface CompileOptions {
  /** A figure to build on. Its named points, graphs and polygons can be referred to. */
  base?: FigureDoc;
}

class StepError extends Error {
  constructor(
    readonly code: RecipeErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Builds a figure from a recipe, running each step through the editor's operations. */
export function compileRecipe(input: unknown, options: CompileOptions = {}): CompileResult {
  const base = options.base ? normalizeDoc(options.base) : emptyDoc();
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      doc: base,
      names: {},
      warnings: [],
      errors: parsed.error.issues.slice(0, 10).map((issue) => {
        const [first, index] = issue.path;
        const step = first === "steps" && typeof index === "number" ? index : null;
        const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return { step, code: "invalid", message: where + issue.message };
      }),
    };
  }

  const build = new Build(base, parsed.data);
  const errors: RecipeIssue[] = [];
  parsed.data.steps.forEach((step, i) => {
    if (errors.length > 0) return;
    build.step = i;
    try {
      runStep(build, step);
    } catch (e) {
      if (!(e instanceof StepError)) throw e;
      errors.push({ step: i, code: e.code, message: e.message });
    }
  });
  if (errors.length === 0) {
    build.step = null;
    for (const finish of build.finishers) finish();
    build.restoreSpans();
    // Wires drawn after the pieces join them too: their corners hide, and junctions get dots.
    if (build.doc.elements.some((e) => e.type === "component")) build.doc = tidyJunctions(build.doc);
    build.unclutter();
  }
  return {
    ok: errors.length === 0,
    doc: build.doc,
    names: Object.fromEntries(build.names),
    errors,
    warnings: build.warnings,
  };
}

// ---------------------------------------------------------------------------
// Build state

const COLOR_NAMES: Record<string, string> = {
  black: INK,
  ink: INK,
  gray: "#808080",
  grey: "#808080",
  lightgray: "#c8c8c8",
  lightgrey: "#c8c8c8",
  white: "#ffffff",
  red: "#d62828",
  orange: "#ea7317",
  yellow: "#e9c400",
  green: "#2a9d3f",
  blue: "#1d4ed8",
  cyan: "#0891b2",
  purple: "#7e22ce",
  magenta: "#c026d3",
};

function withLocale(doc: FigureDoc, locale: Recipe["locale"]): FigureDoc {
  if (!locale) return doc;
  const next: FigureDoc = { ...doc };
  if (locale === "en") next.locale = "en";
  else delete next.locale;
  return next;
}

function color(value: string): string {
  const named = COLOR_NAMES[value.toLowerCase()];
  if (named) return named;
  const hex = value.toLowerCase();
  if (isValidColor(hex)) return hex;
  throw new StepError("invalid", `Unknown color "${value}". Use "#rrggbb", "ink" or a color name.`);
}

class Build {
  doc: FigureDoc;
  readonly names = new Map<string, Id[]>();
  readonly warnings: RecipeIssue[] = [];
  /** Changes that wait for the whole figure, like axis steps over the fitted window. */
  readonly finishers: (() => void)[] = [];
  /**
   * Domains and y cuts typed in the recipe. Graphs over the axes' window
   * follow it when it changes, so these are set again at the end.
   */
  readonly spans = new Map<Id, { domain?: [number, number]; range?: [number, number] }>();
  readonly opts: OpOptions;
  /** Elements of the base figure, whose labels stay where the teacher left them. */
  private readonly baseIds: Set<Id>;
  /** Labels the recipe gave an angle or distance, which stay as written. */
  readonly placedLabels = new Set<Id>();
  step: number | null = null;

  constructor(base: FigureDoc, recipe: Recipe) {
    this.doc = withLocale(base, recipe.locale);
    this.baseIds = new Set(base.elements.map((e) => e.id));
    this.opts = { styles: styleDefaults(recipe.defaults), autoName: false };
    this.nameBase();
  }

  /** Moves the recipe's automatic labels off lines and other labels. */
  unclutter() {
    const ids = this.doc.elements.flatMap((e) => (this.baseIds.has(e.id) || this.placedLabels.has(e.id) ? [] : [e.id]));
    this.doc = unclutterLabels(this.doc, ids);
  }

  get styles(): StyleDefaults {
    return this.opts.styles!;
  }

  /** Names in a base figure: points, graphs and polygons by their labels, when unique. */
  private nameBase() {
    const seen = new Map<string, Id[]>();
    const put = (name: string | undefined, id: Id) => {
      if (name) seen.set(name, [...(seen.get(name) ?? []), id]);
    };
    const pts = pointMap(this.doc);
    for (const el of this.doc.elements) {
      if (el.type === "point" || el.type === "function") put(el.label?.text, el.id);
      if (el.type === "polygon") put(polygonName(el, pts), el.id);
    }
    for (const [name, ids] of seen) if (ids.length === 1) this.names.set(name, ids);
  }

  restoreSpans() {
    if (this.spans.size === 0) return;
    this.doc = {
      ...this.doc,
      elements: this.doc.elements.map((e): Element => {
        const span = this.spans.get(e.id);
        if (!span) return e;
        if (e.type === "function") return { ...e, domain: span.domain ?? e.domain, range: span.range ?? e.range };
        if (e.type === "vline") return { ...e, range: span.range ?? e.range };
        return e;
      }),
    };
  }

  warn(message: string) {
    this.warnings.push({ step: this.step, code: "op_failed", message });
  }

  /** Takes an operation's result, failing the step on its error, and fits axes as the editor does. */
  take(result: OpResult): Id[] {
    if (result.error) throw new StepError("op_failed", translate(result.error, "en"));
    if (result.notice) this.warn(translate(result.notice, "en"));
    this.doc = fitFigure(result.doc);
    return result.created;
  }

  update(ids: Id[], change: (el: Element) => Element) {
    this.doc = fitFigure(updateElements(this.doc, ids, change));
  }

  register(name: string | undefined, ids: Id[]) {
    if (!name || ids.length === 0) return;
    const had = this.names.get(name);
    if (had && had.join() !== ids.join()) {
      throw new StepError("duplicate_name", `The name "${name}" is already used.`);
    }
    this.names.set(name, ids);
  }

  /** Registers a default name, like a polygon's "ABC", only when it is free. */
  registerQuietly(name: string | undefined, ids: Id[]) {
    if (name && !this.names.has(name)) this.names.set(name, ids);
  }

  el(id: Id): Element {
    const el = this.doc.elements.find((e) => e.id === id);
    if (!el) throw new StepError("unknown_name", `Element ${id} is gone.`);
    return el;
  }

  ids(ref: string): Id[] {
    const ids = this.names.get(ref);
    if (!ids) throw new StepError("unknown_name", `Nothing is named "${ref}". Make it in an earlier step.`);
    return ids;
  }

  one<T extends ElementType>(ref: string, ...types: T[]): Extract<Element, { type: T }> {
    const ids = this.ids(ref);
    const els = ids.map((id) => this.el(id));
    const fit = els.filter((e): e is Extract<Element, { type: T }> => (types as string[]).includes(e.type));
    if (ids.length !== 1 || fit.length !== 1) {
      throw new StepError("wrong_kind", `"${ref}" should be one ${types.join(" or ")}.`);
    }
    return fit[0];
  }

  point(ref: string): Point {
    return this.one(ref, "point");
  }

  /** The segment drawn between two named points. */
  segment(pair: readonly [string, string]): Id {
    const [a, b] = [this.point(pair[0]).id, this.point(pair[1]).id];
    const s = this.doc.elements.find(
      (e) => e.type === "segment" && ((e.a === a && e.b === b) || (e.a === b && e.b === a)),
    );
    if (!s) throw new StepError("unknown_name", `There is no segment ${pair[0]}${pair[1]}. Draw it first.`);
    return s.id;
  }

  /** The angle marked at the middle point. */
  angle(triple: readonly [string, string, string]): Id {
    const [a, v, b] = triple.map((r) => this.point(r).id);
    const found = this.doc.elements.find(
      (e) => e.type === "angle" && e.vertex === v && ((e.a === a && e.b === b) || (e.a === b && e.b === a)),
    );
    if (!found) throw new StepError("unknown_name", `There is no angle ${triple.join("")}. Mark it first.`);
    return found.id;
  }

  created<T extends ElementType>(ids: Id[], type: T): Extract<Element, { type: T }>[] {
    return ids.map((id) => this.el(id)).filter((e): e is Extract<Element, { type: T }> => e.type === type);
  }

  /** Names a point: shows the name as its label and registers it. */
  namePoint(id: Id, name: string | undefined) {
    if (!name) return;
    this.register(name, [id]);
    this.update([id], (el) =>
      el.type === "point"
        ? { ...el, shape: el.shape === "none" ? this.styles.point.shape : el.shape, label: withText(el.label, name, this.styles.label) }
        : el,
    );
  }
}

function styleDefaults(d: RecipeDefaults | undefined): StyleDefaults {
  const s: StyleDefaults = JSON.parse(JSON.stringify(DEFAULT_STYLES)) as StyleDefaults;
  // A recipe draws what the teacher asked for: polygons are outlines unless a fill is asked for.
  s.polygonFilled = false;
  if (!d) return s;
  if (d.stroke) s.stroke = strokeWith(s.stroke, d.stroke);
  if (d.point) {
    if (d.point.color) s.point.color = color(d.point.color);
    if (d.point.shape) s.point.shape = d.point.shape;
    if (d.point.size !== undefined) s.point.size = d.point.size;
  }
  if (d.fill !== undefined && typeof d.fill === "object") s.fill = fillWith(s.fill, d.fill);
  if (d.fill !== undefined) s.polygonFilled = d.fill !== false;
  if (d.polygonFilled !== undefined) s.polygonFilled = d.polygonFilled;
  if (d.angle) {
    if (d.angle.radius !== undefined) s.angle.radius = d.angle.radius;
    if (d.angle.arcs !== undefined) s.angle.arcs = d.angle.arcs as 1 | 2 | 3;
    if (d.angle.rightMark !== undefined) s.angle.rightMark = d.angle.rightMark;
  }
  if (d.label) {
    if (d.label.size !== undefined) s.label.size = d.label.size;
    if (d.label.color) s.label.color = color(d.label.color);
    if (d.label.font) s.label.font = d.label.font;
    if (d.label.distance !== undefined) s.label.distance = d.label.distance;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Styles and labels

function strokeWith(stroke: Stroke, p: Pick<StylePatch, "color" | "width" | "dash" | "opacity">): Stroke {
  return {
    color: p.color ? color(p.color) : stroke.color,
    width: p.width ?? stroke.width,
    dash: p.dash ?? stroke.dash,
    opacity: p.opacity ?? stroke.opacity,
  };
}

const hasStroke = (p: StylePatch) => p.color !== undefined || p.width !== undefined || p.dash !== undefined || p.opacity !== undefined;

function fillWith(fill: Fill, p: Exclude<StylePatch["fill"], boolean | undefined>): Fill {
  return {
    color: p.color ? color(p.color) : fill.color,
    opacity: p.opacity ?? fill.opacity,
    pattern: p.pattern ?? fill.pattern,
    angle: p.angle ?? fill.angle,
  };
}

function fillFrom(current: Fill | null, p: StylePatch["fill"], styles: StyleDefaults): Fill | null {
  if (p === undefined) return current;
  if (p === false) return null;
  if (p === true) return current ?? { ...styles.fill };
  return fillWith(current ?? styles.fill, p);
}

/** Side segments of a polygon, between consecutive vertices. */
function polygonSides(doc: FigureDoc, poly: Polygon): Id[] {
  const n = poly.vertices.length;
  const out: Id[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly.vertices[i];
    const b = poly.vertices[(i + 1) % n];
    const s = doc.elements.find((e) => e.type === "segment" && ((e.a === a && e.b === b) || (e.a === b && e.b === a)));
    if (s) out.push(s.id);
  }
  return out;
}

function styleElements(build: Build, ids: Id[], p: StylePatch) {
  const styles = build.styles;
  // A polygon's outline is its side segments: line fields go there.
  const sides = ids.flatMap((id) => {
    const el = build.el(id);
    return el.type === "polygon" && hasStroke(p) ? polygonSides(build.doc, el) : [];
  });
  if (sides.length > 0) styleElements(build, sides, { color: p.color, width: p.width, dash: p.dash, opacity: p.opacity });

  build.update(ids, (el): Element => {
    switch (el.type) {
      case "point":
        return {
          ...el,
          color: p.color ? color(p.color) : el.color,
          shape: p.shape ?? el.shape,
          size: p.size ?? el.size,
        };
      case "segment":
        return { ...el, stroke: strokeWith(el.stroke, p), ticks: (p.ticks ?? el.ticks) as 0 | 1 | 2 | 3 };
      case "angle":
        return {
          ...el,
          stroke: strokeWith(el.stroke, p),
          ticks: (p.ticks ?? el.ticks) as 0 | 1 | 2 | 3,
          arcs: (p.arcs ?? el.arcs) as 1 | 2 | 3,
          radius: p.radius ?? el.radius,
          rightMark: p.rightMark ?? el.rightMark,
          fill: fillFrom(el.fill, p.fill, styles),
        };
      case "circle":
        return { ...el, stroke: strokeWith(el.stroke, p), fill: fillFrom(el.fill, p.fill, styles) };
      case "polygon":
        return { ...el, fill: fillFrom(el.fill, p.fill, styles) };
      case "region":
        return { ...el, fill: fillFrom(el.fill, p.fill, styles) ?? el.fill };
      case "text":
      case "vennitems":
        return { ...el, color: p.color ? color(p.color) : el.color, size: p.size ?? el.size };
      case "board":
      case "study":
      case "circuit":
        return { ...el, color: p.color ? color(p.color) : el.color };
      case "vector":
      case "component":
      case "extension":
      case "function":
      case "vline":
      case "axes":
      case "grid":
      case "numberline":
        return { ...el, stroke: strokeWith(el.stroke, p) };
    }
  });
}

const UNLABELED: ElementType[] = ["text", "axes", "grid", "numberline", "extension", "region", "vennitems", "board", "study", "circuit"];

function labelElement(build: Build, id: Id, spec: LabelSpec) {
  const el = build.el(id);
  if (UNLABELED.includes(el.type)) throw new StepError("wrong_kind", `A ${el.type} has no label.`);
  const base = build.styles.label;
  const s = typeof spec === "string" ? { text: spec } : spec;
  const current: Label = el.label ?? { ...base, text: "" };
  let label: Label = { ...current };

  if (s.measure) {
    const kind = s.measure === true ? undefined : (s.measure as MeasureKind);
    const decimals = s.decimals ?? (el.type === "angle" ? 1 : 2);
    const m = newMeasure(el, decimals, kind);
    if (!m || (kind && m.kind !== kind)) {
      throw new StepError("wrong_kind", `A ${el.type} can't show ${kind ? `its ${kind}` : "a measure"}.`);
    }
    const measure = { ...m, prefix: s.prefix ?? "", suffix: s.suffix ?? "" };
    label = { ...label, measure, text: measureNumber(build.doc, el, measure) ?? "" };
  } else if (s.text !== undefined) {
    label = withText(current, `${s.prefix ?? ""}${s.text}${s.suffix ?? ""}`, base);
  }
  if (s.angle !== undefined) label.angle = s.angle;
  if (s.distance !== undefined) label.distance = s.distance;
  if (s.angle !== undefined || s.distance !== undefined) build.placedLabels.add(id);
  if (s.size !== undefined) label.size = s.size;
  if (s.color) label.color = color(s.color);
  if (s.font) label.font = s.font;
  label.text = label.text.slice(0, LIMITS.labelLength);
  build.update([id], (e) => (e.id === id ? ({ ...e, label } as Element) : e));
}

/** Applies a step's own `style`, `label` and `as` to what it made. */
function finish(build: Build, ids: Id[], step: { as?: string; style?: StylePatch; label?: LabelSpec }) {
  if (step.style) styleElements(build, ids, step.style);
  if (step.label !== undefined) for (const id of ids) labelElement(build, id, step.label);
  build.register(step.as, ids);
}

function resolveTargets(build: Build, targets: Target[]): Id[] {
  const out: Id[] = [];
  for (const t of targets) {
    if (typeof t === "string") out.push(...build.ids(t));
    else if (Array.isArray(t)) {
      if (t.length === 2) out.push(build.segment([t[0], t[1]]));
      else out.push(build.angle([t[0], t[1], t[2]]));
    } else if ("sidesOf" in t) {
      out.push(...polygonSides(build.doc, build.one(t.sidesOf, "polygon")));
    } else if ("anglesOf" in t) {
      const poly = build.one(t.anglesOf, "polygon");
      const vs = poly.vertices;
      out.push(
        ...build.doc.elements
          .filter((e) => {
            if (e.type !== "angle") return false;
            const i = vs.indexOf(e.vertex);
            if (i < 0) return false;
            const around = [vs[(i + vs.length - 1) % vs.length], vs[(i + 1) % vs.length]];
            return around.includes(e.a) && around.includes(e.b);
          })
          .map((e) => e.id),
      );
    } else {
      out.push(...build.doc.elements.filter((e) => e.type === t.all).map((e) => e.id));
    }
  }
  const unique = [...new Set(out)];
  if (unique.length === 0) throw new StepError("unknown_name", "The targets match nothing in the figure.");
  return unique;
}

// ---------------------------------------------------------------------------
// Shapes from numbers

const pointName = (p: Point | undefined) => p?.label?.text || undefined;

function polygonName(poly: Polygon, pts: Map<Id, Point>): string | undefined {
  const names = poly.vertices.map((id) => pointName(pts.get(id)));
  return names.every(Boolean) ? names.join("") : undefined;
}

function trianglePositions(step: StepOf<"triangle">): Vec[] {
  const at = { x: step.at?.[0] ?? 0, y: step.at?.[1] ?? 0 };
  const rot = step.rotate ?? 0;
  let ab: number;
  let toC: Vec;
  if (step.sides) {
    if (step.base !== undefined || step.angles) throw new StepError("invalid", "Give either sides, or base and angles.");
    const [c, a, b] = step.sides; // |P0P1|, |P1P2|, |P2P0|
    if (c >= a + b || a >= b + c || b >= a + c) {
      throw new StepError("impossible", `Sides ${step.sides.join(", ")} break the triangle inequality.`);
    }
    ab = c;
    // P2 from P0: |P0P2| = b, and the angle at P0 from the law of cosines.
    const cosA = (b * b + c * c - a * a) / (2 * b * c);
    const angleA = (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI;
    toC = polar(b, rot + angleA);
  } else if (step.base !== undefined && step.angles) {
    const [alpha, beta] = step.angles;
    if (alpha + beta >= 180) throw new StepError("impossible", "The two base angles add up to 180° or more.");
    ab = step.base;
    const gamma = 180 - alpha - beta;
    const rad = (d: number) => (d * Math.PI) / 180;
    const b = (ab * Math.sin(rad(beta))) / Math.sin(rad(gamma));
    toC = polar(b, rot + alpha);
  } else {
    throw new StepError("invalid", "A triangle needs sides, or base and angles.");
  }
  return [at, add(at, polar(ab, rot)), add(at, toC)];
}

function regularPositions(step: StepOf<"regularPolygon">): Vec[] {
  const n = step.points.length;
  if ((step.side === undefined) === (step.radius === undefined)) {
    throw new StepError("invalid", "A regular polygon needs side or radius.");
  }
  const side = step.side ?? 2 * step.radius! * Math.sin(Math.PI / n);
  let p = { x: step.at?.[0] ?? 0, y: step.at?.[1] ?? 0 };
  let heading = step.rotate ?? 0;
  const out: Vec[] = [];
  for (let i = 0; i < n; i++) {
    out.push(p);
    p = add(p, polar(side, heading));
    heading += 360 / n;
  }
  return out;
}

const round = (v: number) => {
  const r = Math.round(v * 1e9) / 1e9;
  return Object.is(r, -0) ? 0 : r;
};

/** New named points; their names are registered. */
function newPoints(build: Build, specs: { name?: string; at: Vec }[]): Id[] {
  for (const s of specs) if (s.name && build.names.has(s.name)) throw new StepError("duplicate_name", `The name "${s.name}" is already used.`);
  const parsed: ParsedPoint[] = specs.map((s) => ({ x: round(s.at.x), y: round(s.at.y), ...(s.name ? { label: s.name } : {}) }));
  const ids = build.take(addPoints(build.doc, parsed, build.opts));
  ids.forEach((id, i) => build.register(specs[i].name, [id]));
  return ids;
}

function newPolygon(build: Build, vertexIds: Id[], step: { as?: string; style?: StylePatch; label?: LabelSpec }) {
  const created = build.take(makePolygon(build.doc, vertexIds, build.opts));
  const poly = build.created(created, "polygon")[0];
  build.registerQuietly(step.as ? undefined : polygonName(poly, pointMap(build.doc)), [poly.id]);
  finish(build, [poly.id], step);
}

// ---------------------------------------------------------------------------
// Steps

/** The point a construction made, or the existing one it landed on. */
function madePoint(build: Build, created: Id[]): Point | undefined {
  return build.created(created, "point")[0];
}

/** For constructions that draw from `from`: the segment they made, and its far end. */
function drawnFrom(build: Build, created: Id[], from: Id): { segment: Id; end: Id } {
  const s = build.created(created, "segment").find((e) => e.a === from || e.b === from) ?? build.created(created, "segment")[0];
  if (!s) throw new StepError("op_failed", "The construction drew nothing.");
  return { segment: s.id, end: s.a === from ? s.b : s.a };
}

function nameMade(build: Build, made: Point | undefined, end: Id, name: string | undefined, what: string) {
  if (!name) return;
  if (made && made.id === end) build.namePoint(made.id, name);
  else {
    const existing = pointName(build.el(end) as Point);
    build.warn(`The ${what} is the existing point ${existing ?? end}, so it keeps its name.`);
    build.registerQuietly(name, [end]);
  }
}

function curveId(build: Build, r: string | readonly [string, string]): Id {
  if (typeof r !== "string") return build.segment(r);
  return build.one(r, "segment", "circle", "function", "vline").id;
}

function runStep(build: Build, step: RecipeStep) {
  switch (step.do) {
    case "points": {
      // A point can start from one named earlier in the same step.
      const local = new Map<string, Vec>();
      const specs = step.points.map((p) => {
        const at = "at" in p ? { x: p.at[0], y: p.at[1] } : add(local.get(p.from) ?? build.point(p.from), polar(p.length, p.angle));
        if (p.name) local.set(p.name, at);
        return { name: p.name, at };
      });
      const ids = newPoints(build, specs);
      if (step.style) styleElements(build, ids, step.style);
      return;
    }
    case "input": {
      const pts = [...pointMap(build.doc).values()].map((p) => ({ id: p.id, x: p.x, y: p.y, label: pointName(p) }));
      const graphs = build.doc.elements.flatMap((e) => (e.type === "function" && e.label?.text ? [{ id: e.id, name: e.label.text }] : []));
      const before = new Set(build.doc.elements.map((e) => e.id));
      build.take(applyInput(build.doc, parseInput(step.text, { points: pts, graphs }), build.opts));
      for (const el of build.doc.elements) {
        if (before.has(el.id)) continue;
        if (el.type === "point" || el.type === "function") build.registerQuietly(el.label?.text, [el.id]);
      }
      return;
    }
    case "triangle": {
      const at = trianglePositions(step);
      const ids = newPoints(build, step.points.map((name, i) => ({ name, at: at[i] })));
      newPolygon(build, ids, step);
      return;
    }
    case "regularPolygon": {
      const at = regularPositions(step);
      const ids = newPoints(build, step.points.map((name, i) => ({ name, at: at[i] })));
      newPolygon(build, ids, step);
      return;
    }
    case "segment": {
      const ids = step.points.map((r) => build.point(r).id);
      const pairs: [string, string][] = [];
      for (let i = 0; i + 1 < step.points.length; i++) pairs.push([step.points[i], step.points[i + 1]]);
      if (step.closed) pairs.push([step.points[step.points.length - 1], step.points[0]]);
      const missing = pairs.filter((p) => {
        try {
          build.segment(p);
          return false;
        } catch {
          return true;
        }
      });
      if (missing.length > 0) build.take(connectPoints(build.doc, ids, step.closed ?? false, build.opts));
      finish(build, pairs.map((p) => build.segment(p)), step);
      return;
    }
    case "polygon": {
      newPolygon(build, step.points.map((r) => build.point(r).id), step);
      return;
    }
    case "circle": {
      const modes = [step.radius !== undefined, step.through, step.tangentTo, step.circumscribed].filter(Boolean).length;
      if (modes !== 1) throw new StepError("invalid", "A circle needs exactly one of radius, through, tangentTo or circumscribed.");
      if (step.circumscribed && step.center) throw new StepError("invalid", "A circumscribed circle makes its own center; use centerName.");
      if (!step.circumscribed && !step.center) throw new StepError("invalid", "This circle needs a center.");
      let created: Id[];
      if (step.circumscribed) {
        created = build.take(makeCircle(build.doc, step.circumscribed.map((r) => build.point(r).id), "circumcircle", build.opts));
        const center = build.created(created, "point")[0];
        if (center) build.namePoint(center.id, step.centerName);
      } else {
        const c = build.point(step.center!).id;
        if (step.radius !== undefined) created = build.take(makeCircle(build.doc, [c], "radius", build.opts));
        else if (step.through) created = build.take(makeCircle(build.doc, [c, build.point(step.through).id], "through", build.opts));
        else created = build.take(makeCircle(build.doc, [c, build.segment(step.tangentTo!)], "tangent", build.opts));
      }
      const circle = build.created(created, "circle")[0];
      if (step.radius !== undefined) build.update([circle.id], (e) => (e.type === "circle" ? { ...e, radius: step.radius! } : e));
      if (step.arc) {
        build.take(setCircleArc(build.doc, [circle.id], true));
        const [start, end] = step.arc;
        build.update([circle.id], (e) => (e.type === "circle" ? { ...e, arc: { start, end } } : e));
      }
      if (step.sector) {
        if (!step.arc) throw new StepError("invalid", "A sector needs an arc.");
        build.take(setSectorRadii(build.doc, [circle.id], true, build.opts));
      }
      if (step.ends) {
        if (!step.sector) throw new StepError("invalid", "Arc ends can be named only with sector: true.");
        for (const p of build.doc.elements) {
          if (p.type !== "point" || p.construction?.kind !== "arcEnd" || p.construction.circle !== circle.id) continue;
          build.namePoint(p.id, step.ends[p.construction.end]);
        }
      }
      finish(build, [circle.id], step);
      return;
    }
    case "angle": {
      const triple = step.points.map((r) => build.point(r).id);
      let id: Id;
      try {
        id = build.angle(step.points);
      } catch {
        id = build.created(build.take(makeAngles(build.doc, triple, build.opts)), "angle")[0].id;
      }
      if (step.reflex !== undefined) build.update([id], (e) => (e.type === "angle" ? { ...e, reflex: step.reflex! } : e));
      finish(build, [id], step);
      return;
    }
    case "angles": {
      const poly = build.one(step.of, "polygon");
      const result = makeAngles(build.doc, [poly.id], build.opts);
      if (!result.error) build.take(result);
      const ids = resolveTargets(build, [{ anglesOf: step.of }]);
      finish(build, ids, step);
      return;
    }
    case "text": {
      const ids = build.take(addText(build.doc, { x: step.at[0], y: step.at[1] }, step.text, build.opts));
      finish(build, ids, { ...step, label: undefined });
      return;
    }
    case "midpoint": {
      const created = build.take(makeMidpoint(build.doc, step.of.map((r) => build.point(r).id), build.opts));
      const p = madePoint(build, created)!;
      build.namePoint(p.id, step.name);
      finish(build, [p.id], step);
      return;
    }
    case "altitude":
    case "projection": {
      const from = build.point(step.do === "altitude" ? step.from : step.point).id;
      const line = step.do === "altitude" ? step.to : step.onto;
      const run = step.do === "altitude" ? makeAltitude : makeProjection;
      const created = build.take(run(build.doc, [from, ...line.map((r) => build.point(r).id)], build.opts));
      const { segment, end } = drawnFrom(build, created, from);
      nameMade(build, madePoint(build, created), end, step.foot, "foot");
      finish(build, [segment], step);
      return;
    }
    case "median": {
      const from = build.point(step.from).id;
      const created = build.take(makeMedian(build.doc, [from, ...step.to.map((r) => build.point(r).id)], build.opts));
      const { segment, end } = drawnFrom(build, created, from);
      nameMade(build, madePoint(build, created), end, step.midpoint, "midpoint");
      finish(build, [segment], step);
      return;
    }
    case "bisector": {
      const triple = step.angle.map((r) => build.point(r).id);
      const created = build.take(makeBisector(build.doc, triple, build.opts));
      const { segment, end } = drawnFrom(build, created, triple[1]);
      nameMade(build, madePoint(build, created), end, step.end, "end");
      finish(build, [segment], step);
      return;
    }
    case "perpendicularBisector": {
      const ends = step.of.map((r) => build.point(r).id);
      const created = build.take(makePerpendicularBisector(build.doc, ends, step.rightMark ?? true, build.opts));
      const segment = build.created(created, "segment")[0];
      const mid = build.created(created, "point").find((p) => p.construction?.kind === "midpoint");
      if (step.midpoint) {
        if (mid) build.namePoint(mid.id, step.midpoint);
        else build.warn("The midpoint was already there, so it keeps its name.");
      }
      finish(build, [segment.id], step);
      return;
    }
    case "intersection": {
      const ids = step.of.map((r) => curveId(build, r));
      const created = build.take(makeIntersection(build.doc, ids, build.opts));
      const points = build.created(created, "point");
      (step.names ?? []).forEach((name, i) => {
        if (points[i]) build.namePoint(points[i].id, name);
      });
      if ((step.names?.length ?? 0) > points.length) build.warn(`Only ${points.length} crossing(s) were found.`);
      if (step.style) styleElements(build, points.map((p) => p.id), step.style);
      return;
    }
    case "function": {
      if (step.name && build.names.has(step.name)) throw new StepError("duplicate_name", `The name "${step.name}" is already used.`);
      const created = build.take(addFunction(build.doc, step.expr, step.name ?? "", build.opts));
      const graph = build.created(created, "function")[0];
      build.update([graph.id], (e) =>
        e.type === "function"
          ? {
              ...e,
              domain: step.domain ? [...step.domain] : e.domain,
              range: step.range ? [...step.range] : e.range,
              ...(step.ends ? { ends: [...step.ends] } : {}),
            }
          : e,
      );
      if (step.domain && !(step.domain[0] < step.domain[1])) throw new StepError("invalid", "The domain must go from low to high.");
      if (step.range && !(step.range[0] < step.range[1])) throw new StepError("invalid", "The y cut must go from low to high.");
      if (step.domain || step.range) build.spans.set(graph.id, { domain: step.domain && [...step.domain], range: step.range && [...step.range] });
      build.register(graph.label?.text, [graph.id]);
      finish(build, [graph.id], step);
      return;
    }
    case "vline": {
      const created = build.take(addVerticalLine(build.doc, step.x, build.opts));
      const line = build.created(created, "vline")[0];
      if (step.range) {
        build.update([line.id], (e) => (e.type === "vline" ? { ...e, range: [...step.range!] } : e));
        build.spans.set(line.id, { range: [...step.range] });
      }
      finish(build, [line.id], step);
      return;
    }
    case "axes":
      return axesStep(build, step);
    case "grid": {
      let grid: Element | undefined = build.doc.elements.find((e) => e.type === "grid");
      if (!grid) grid = build.el(build.take(addGrid(build.doc))[0]);
      const id = grid!.id;
      if (step.step !== undefined) build.update([id], (e) => (e.type === "grid" ? { ...e, step: step.step! } : e));
      if (step.style) styleElements(build, [id], step.style);
      return;
    }
    case "numberline": {
      let line: Element | undefined = build.doc.elements.find((e) => e.type === "numberline");
      if (!line) line = build.el(build.take(addNumberLine(build.doc))[0]);
      const id = line!.id;
      build.update([id], (e) =>
        e.type === "numberline"
          ? { ...e, x: step.x ? [...step.x] : e.x, step: step.step ?? e.step, numbers: step.numbers ?? e.numbers }
          : e,
      );
      if (step.style) styleElements(build, [id], step.style);
      return;
    }
    case "interval": {
      const created = build.take(addInterval(build.doc, step.from, step.to, step.closed, build.opts));
      if (step.style) styleElements(build, [created[0]], step.style);
      return;
    }
    case "pointOnGraph": {
      const graph = build.one(step.graph, "function");
      if (step.name && build.names.has(step.name)) throw new StepError("duplicate_name", `The name "${step.name}" is already used.`);
      const [id] = build.take(addPointOnGraph(build.doc, graph.id, step.x, step.name ?? "", build.opts));
      build.register(pointName(build.el(id) as Point), [id]);
      finish(build, [id], step);
      return;
    }
    case "notable": {
      const graph = build.one(step.graph, "function");
      const points = build.created(build.take(markNotable(build.doc, [graph.id], step.feature, build.opts)), "point");
      points.forEach((p, i) => {
        const name = step.names?.[i];
        if (name) build.namePoint(p.id, name);
        else build.registerQuietly(pointName(p), [p.id]);
      });
      if (step.style) styleElements(build, points.map((p) => p.id), step.style);
      return;
    }
    case "tangent": {
      const created = build.take(makeTangent(build.doc, [build.point(step.point).id], build.opts));
      const segment = build.created(created, "segment")[0].id;
      if (step.length !== undefined) build.take(resizeTangent(build.doc, segment, step.length));
      if (step.fill) build.take(setTangentFill(build.doc, segment, true));
      finish(build, [segment], step);
      return;
    }
    case "guides": {
      const ids = step.points.map((r) => build.point(r)).filter((p) => !p.guides).map((p) => p.id);
      if (ids.length > 0) build.take(toggleGuides(build.doc, ids));
      return;
    }
    case "label":
      return labelStep(build, step);
    case "style":
      styleElements(build, resolveTargets(build, step.targets), step.style);
      return;
    case "vector": {
      const tail: { id: Id } | { x: number; y: number } = step.from ? { id: build.point(step.from).id } : { x: step.at?.[0] ?? 0, y: step.at?.[1] ?? 0 };
      let tip: { id: Id } | { x: number; y: number };
      if (step.to) tip = { id: build.point(step.to).id };
      else if (step.components) {
        const at = "id" in tail ? pointMap(build.doc).get(tail.id)! : tail;
        tip = { x: at.x + step.components[0], y: at.y + step.components[1] };
      } else throw new StepError("invalid", "A vector needs `to` or `components`.");
      const created = build.take(addVector(build.doc, step.name ?? "", tail, tip, build.opts));
      const v = build.created(created, "vector")[0];
      if (step.notation) build.update([v.id], (e) => (e.type === "vector" ? { ...e, notation: step.notation! } : e));
      build.register(v.label?.text, [v.id]);
      if (step.style) styleElements(build, [v.id], step.style);
      build.register(step.as, [v.id]);
      return;
    }
    case "vectorOp": {
      const ids = step.vectors.map((r) => build.one(r, "vector").id);
      const made = build.created(build.take(vectorOp(build.doc, ids, step.op, build.opts, step.k ?? 2)), "vector");
      for (const v of made) build.registerQuietly(v.label?.text, [v.id]);
      build.register(step.as, made.map((v) => v.id));
      return;
    }
    case "basis": {
      for (const v of build.created(build.take(addBasis(build.doc, build.opts)), "vector")) build.registerQuietly(v.label?.text, [v.id]);
      return;
    }
    case "venn": {
      for (const c of build.created(build.take(addVennDiagram(build.doc, step.sets, build.opts)), "circle")) build.registerQuietly(c.label?.text, [c.id]);
      return;
    }
    case "region": {
      const created = build.take(addRegion(build.doc, step.expr, build.opts));
      if (step.style) styleElements(build, created, step.style);
      return;
    }
    case "members":
      build.take(setMembers(build.doc, step.set, step.items, build.opts));
      return;
    case "count":
      build.take(setRegionCount(build.doc, step.expr, step.value, build.opts));
      return;
    case "component": {
      const [a, b] = [build.point(step.from).id, build.point(step.to).id];
      const [id] = build.take(addComponent(build.doc, [a, b], step.kind, build.opts));
      const patch = { value: step.value, internal: step.internal, closed: step.closed, name: step.name, shape: step.shape };
      const given = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      if (Object.keys(given).length > 0) build.take(updateComponent(build.doc, id, given));
      if (step.style) styleElements(build, [id], step.style);
      const piece = build.el(id);
      build.registerQuietly(piece.type === "component" ? piece.name : undefined, [id]);
      build.register(step.as, [id]);
      return;
    }
    case "circuit": {
      if (step.template) {
        const at = step.at ? { x: step.at[0], y: step.at[1] } : undefined;
        for (const id of build.take(addCircuitTemplate(build.doc, step.template, build.opts, at))) {
          const piece = build.el(id);
          if (piece.type === "component") build.registerQuietly(piece.name, [id]);
        }
      }
      const { on, current, values, decimals } = step;
      if (on !== undefined || current !== undefined || values !== undefined || decimals !== undefined) {
        const was = build.doc.elements.find((e) => e.type === "circuit");
        const base = was?.type === "circuit" ? was.values : { current: true, voltage: true, power: false };
        build.take(setCircuit(build.doc, { on, current, decimals, ...(values ? { values: { ...base, ...values } } : {}) }, build.opts));
      }
      return;
    }
    case "board": {
      const at = step.at ? { x: step.at[0], y: step.at[1] } : undefined;
      const [id] = build.take(addBoard(build.doc, step.source, build.opts, at));
      build.update([id], (e) =>
        e.type === "board"
          ? {
              ...e,
              show: step.show ?? e.show,
              method: step.method ?? e.method,
              places: step.places ?? e.places,
              marks: step.marks ?? e.marks,
              gaps: step.gaps ?? e.gaps,
              gapStyle: step.gapStyle ?? e.gapStyle,
              gapText: step.gapText ?? e.gapText,
              signSide: step.signSide ?? e.signSide,
              intervals: step.intervals ?? e.intervals,
              size: step.size ?? e.size,
            }
          : e,
      );
      return;
    }
  }
}

function axesStep(build: Build, step: StepOf<"axes">) {
  let axes = build.doc.elements.find((e): e is Axes => e.type === "axes");
  if (!axes) axes = build.el(build.take(addAxes(build.doc))[0]) as Axes;
  const id = axes.id;
  build.update([id], (e) => {
    if (e.type !== "axes") return e;
    const next: Axes = { ...e };
    if (step.xPi !== undefined) next.xPi = step.xPi;
    if (step.unit) next.unit = [...step.unit];
    if (step.numbers !== undefined) next.numbers = step.numbers;
    if (step.names) next.names = [...step.names];
    return next;
  });
  if (step.x || step.y) {
    const current = build.el(id) as Axes;
    const x = step.x ?? current.x;
    const y = step.y ?? current.y;
    build.update([id], (e) => (e.type === "axes" ? { ...e, fit: false } : e));
    build.take(setAxesWindow(build.doc, id, [...x], [...y]));
  }
  if (step.step !== undefined || step.yStep !== undefined) {
    // Steps typed by hand turn fitting off, as in the editor: set them on the fitted window, at the end.
    build.finishers.push(() =>
      build.update([id], (e) => {
        if (e.type !== "axes") return e;
        const next: Axes = { ...e, fit: false, step: step.step ?? e.step };
        if (step.yStep !== undefined) next.yStep = step.yStep;
        return next;
      }),
    );
  }
  if (step.style) styleElements(build, [id], step.style);
}

const SCHEME_TYPES: Record<string, ElementType[]> = {
  latin: ["point", "segment", "angle", "circle", "polygon"],
  "latin-lower": ["point", "segment", "angle", "circle", "polygon"],
  greek: ["point", "segment", "angle", "circle", "polygon"],
  numbered: ["point", "segment", "angle", "circle", "polygon"],
  coordinates: ["point"],
};

function labelStep(build: Build, step: StepOf<"label">) {
  const ids = resolveTargets(build, step.targets);
  if (step.remove) {
    const result = removeLabels(build.doc, ids);
    if (!result.error) build.take(result);
    return;
  }
  if (step.text === undefined && !step.scheme && step.label === undefined) {
    throw new StepError("invalid", "A label step needs text, scheme, label or remove.");
  }
  if (step.scheme === "opposite") {
    const pts = pointMap(build.doc);
    for (const id of ids) {
      const s = build.el(id);
      if (s.type !== "segment") throw new StepError("wrong_kind", "The opposite scheme labels segments.");
      const tri = build.doc.elements.find(
        (e): e is Polygon => e.type === "polygon" && e.vertices.length === 3 && e.vertices.includes(s.a) && e.vertices.includes(s.b),
      );
      const opposite = tri?.vertices.find((v) => v !== s.a && v !== s.b);
      const name = opposite ? pointName(pts.get(opposite)) : undefined;
      if (!name) throw new StepError("wrong_kind", "The opposite scheme needs sides of a triangle with named vertices.");
      labelElement(build, id, name.toLowerCase());
    }
  } else if (step.scheme) {
    const byType = new Map<ElementType, Id[]>();
    for (const id of ids) {
      const type = build.el(id).type;
      if (!SCHEME_TYPES[step.scheme].includes(type)) {
        throw new StepError("wrong_kind", `The ${step.scheme} scheme doesn't label a ${type}.`);
      }
      byType.set(type, [...(byType.get(type) ?? []), id]);
    }
    for (const [type, only] of byType) {
      build.take(autoLabel(build.doc, type as "point", step.scheme as LabelScheme, only, 2, build.opts));
    }
  }
  if (step.text !== undefined) for (const id of ids) labelElement(build, id, step.text);
  if (step.label !== undefined) for (const id of ids) labelElement(build, id, step.label);
}
