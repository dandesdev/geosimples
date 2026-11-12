import { spotBelow } from "./boardOps";
import { DEFAULT_STYLES, LIMITS, PT_PER_CM } from "./defaults";
import { idMaker, LIMIT_ERROR, roomFor, withElements, type OpOptions, type OpResult } from "./ops";
import {
  MAX_STUDY_POINTS,
  MAX_STUDY_SKETCHES,
  MAX_STUDY_TEXT,
  STUDY_LIMITS,
  STUDY_STRETCH,
  newStudyPoint,
  nextStudyId,
  readStudy,
  studyFromSpec,
  intervalTexts,
  studyPaths,
  studyLayout,
  studyPiece,
} from "./study";
import type { FigureDoc, Id, Study, StudyAxis, StudyBall, StudyPoint, StudySketch } from "./types";

/** An op on a study that may pick one of its pieces afterwards, by its path. */
export interface StudyOpResult extends OpResult {
  part?: string | null;
}

const fail = (doc: FigureDoc, error: string): StudyOpResult => ({ doc, created: [], error });

/** Changes the line of the study `id`: `change` returns its new line, or a string saying why it can't. */
function withStudy(doc: FigureDoc, id: Id, change: (a: StudyAxis, s: Study) => StudyAxis | string, part?: string | null): StudyOpResult {
  const study = doc.elements.find((e): e is Study => e.id === id && e.type === "study");
  if (!study) return fail(doc, "Selecione um estudo na reta.");
  const axis = change(study.axis, study);
  if (typeof axis === "string") return fail(doc, axis);
  return { doc: withElements(doc, doc.elements.map((e) => (e === study ? { ...study, axis } : e))), created: [], part };
}

/** Adds an Estudo na reta from what was typed, like estudo ?; ?; ? or estudo x-2; x²-5x+4. */
export function addStudy(doc: FigureDoc, source: string, opts: OpOptions = {}, at?: { x: number; y: number }): OpResult {
  const spec = readStudy(source, doc.locale);
  if (spec === null) return fail(doc, "Comece com estudo, como estudo ?; ?; ?.");
  if (typeof spec === "string") return fail(doc, spec);
  if (!roomFor(doc, 1)) return fail(doc, LIMIT_ERROR);
  const styles = opts.styles ?? DEFAULT_STYLES;
  const spot = at ?? spotBelow(doc);
  if (Math.abs(spot.x) > LIMITS.coordinate || Math.abs(spot.y) > LIMITS.coordinate) return fail(doc, "A figura chegou ao limite de espaço.");
  const size = 12;
  const placed: Study = {
    id: idMaker(doc)("study"),
    type: "study",
    x: spot.x,
    y: spot.y,
    axis: studyFromSpec(spec, size),
    sketchDash: "solid",
    size,
    color: styles.label.color,
    width: 0.8,
    font: styles.label.font,
  };
  // The spot is where its top goes, and its line is lower by what is written over it.
  const over = Math.max(0, studyLayout(placed).box.maxY) / PT_PER_CM;
  const study = { ...placed, y: Math.round((spot.y - over) * 100) / 100 };
  return { doc: withElements(doc, [...doc.elements, study]), created: [study.id] };
}

/** Puts a blank point in the middle of a stretch, splitting it in two. Its text stays on the left part. */
export function insertStudyPoint(doc: FigureDoc, id: Id, stretch: number): StudyOpResult {
  let added: Id | null = null;
  const result = withStudy(doc, id, (a, s) => {
    if (a.points.length >= MAX_STUDY_POINTS) return `Use até ${MAX_STUDY_POINTS} pontos.`;
    if (stretch < 0 || stretch > a.points.length) return "Esse trecho não existe.";
    const pid = nextStudyId("p", a.points);
    added = pid;
    // A new point between points with dividers gets one too, so the columns stay whole.
    const divided = [a.points[stretch - 1], a.points[stretch]].some((p) => p?.divider);
    const points = [...a.points.slice(0, stretch), newStudyPoint(pid, "", divided), ...a.points.slice(stretch)];
    const intervals = [...a.intervals.slice(0, stretch + 1), "", ...a.intervals.slice(stretch + 1)];
    const least = s.size * STUDY_STRETCH;
    const widths = [...a.widths.slice(0, stretch + 1), least, ...a.widths.slice(stretch + 1)];
    return { ...a, points, intervals, widths };
  });
  return result.error ? result : { ...result, part: added ? studyPaths.point(added) : null };
}

/**
 * Removes a piece: a point takes its stretch after it along (keeping the text
 * of either, and dropping it from the sketches through it), a divider and a
 * sketch go, and a stretch's text is cleared.
 */
export function removeStudyPiece(doc: FigureDoc, id: Id, path: string): StudyOpResult {
  return withStudy(
    doc,
    id,
    (a, s) => {
      const piece = studyPiece(s, path);
      if (!piece) return "Essa parte não existe mais.";
      switch (piece.kind) {
        case "point": {
          const i = piece.index;
          const merged = a.intervals[i].trim() ? a.intervals[i] : a.intervals[i + 1];
          const intervals = [...a.intervals.slice(0, i), merged, ...a.intervals.slice(i + 2)];
          const widths = [...a.widths.slice(0, i), Math.max(a.widths[i], a.widths[i + 1]), ...a.widths.slice(i + 2)];
          // A line through the point has nothing left to cross; a parabola keeps its other roots.
          const sketches = a.sketches
            .map((sk) => ({ ...sk, roots: sk.roots.filter((r) => r !== piece.point.id) }))
            .filter((sk) => sk.shape === "parabola" || sk.roots.length > 0);
          return { ...a, points: a.points.filter((p) => p.id !== piece.point.id), intervals, widths, sketches };
        }
        case "divider":
          return { ...a, points: a.points.map((p) => (p.id === piece.point.id ? { ...p, divider: false, drop: 0 } : p)) };
        case "interval":
          return { ...a, intervals: a.intervals.map((t, i) => (i === piece.index ? "" : t)) };
        case "sketch":
          return { ...a, sketches: a.sketches.filter((sk) => sk.id !== piece.sketch.id) };
      }
    },
    null,
  );
}

/** Types over the text of a piece: a point's name, a stretch's text or a sketch's name. */
export function setStudyText(doc: FigureDoc, id: Id, path: string, text: string): StudyOpResult {
  const typed = text.slice(0, MAX_STUDY_TEXT);
  return withStudy(
    doc,
    id,
    (a, s) => {
      const piece = studyPiece(s, path);
      if (!piece) return "Essa parte não existe mais.";
      switch (piece.kind) {
        case "point":
          return { ...a, points: a.points.map((p) => (p.id === piece.point.id ? { ...p, label: typed } : p)) };
        case "interval":
          return { ...a, intervals: a.intervals.map((t, i) => (i === piece.index ? typed : t)) };
        case "sketch":
          return { ...a, sketches: a.sketches.map((sk) => (sk.id === piece.sketch.id ? { ...sk, label: typed } : sk)) };
        case "divider":
          return "A divisória não tem texto.";
      }
    },
  );
}

/** Every point with the same ball. */
export function setStudyBalls(doc: FigureDoc, id: Id, ball: StudyBall): StudyOpResult {
  return withStudy(doc, id, (a) => ({ ...a, points: a.points.map((p) => ({ ...p, ball })) }));
}

/** Writes each stretch as an interval of x from the names of the points: x < a, a ≤ x < b, x ≥ b. */
export function fillStudyIntervals(doc: FigureDoc, id: Id): StudyOpResult {
  return withStudy(doc, id, (a) => {
    if (a.points.length === 0) return "Ponha ao menos um ponto na reta.";
    if (a.points.some((p) => !p.label.trim())) return "Dê nome a todos os pontos primeiro.";
    return { ...a, intervals: intervalTexts(a.points.map((p) => p.label.trim())) };
  });
}

/** Changes how a point shows: its ball, its divider and how far the divider goes. */
export function updateStudyPoint(doc: FigureDoc, id: Id, point: Id, patch: Partial<Pick<StudyPoint, "ball" | "divider" | "drop">>): StudyOpResult {
  return withStudy(doc, id, (a) => {
    if (!a.points.some((p) => p.id === point)) return "Esse ponto não existe mais.";
    const drop = patch.drop === undefined ? undefined : Math.round(Math.max(STUDY_LIMITS.drop[0], Math.min(patch.drop, STUDY_LIMITS.drop[1])));
    return { ...a, points: a.points.map((p) => (p.id === point ? { ...p, ...patch, ...(drop === undefined ? {} : { drop }) } : p)) };
  });
}

/** Every point with a divider, or none. */
export function setStudyDividers(doc: FigureDoc, id: Id, on: boolean): StudyOpResult {
  return withStudy(doc, id, (a) => ({ ...a, points: a.points.map((p) => ({ ...p, divider: on, drop: on ? p.drop : 0 })) }));
}

/** Roots a sketch can have, in the order of the points on the line. */
function rootsFor(a: StudyAxis, shape: StudySketch["shape"], roots: Id[]): Id[] {
  const order = new Map(a.points.map((p, i) => [p.id, i]));
  const kept = [...new Set(roots.filter((r) => order.has(r)))].sort((a, b) => order.get(a)! - order.get(b)!);
  return kept.slice(0, shape === "line" ? 1 : 2);
}

/** Adds a sketch: a rising line through the middle point, or a parabola through the first two points. */
export function addStudySketch(doc: FigureDoc, id: Id, shape: StudySketch["shape"]): StudyOpResult {
  let added: Id | null = null;
  const result = withStudy(doc, id, (a) => {
    if (a.sketches.length >= MAX_STUDY_SKETCHES) return `Use até ${MAX_STUDY_SKETCHES} esboços.`;
    if (shape === "line" && a.points.length === 0) return "Uma reta precisa de um ponto onde corta a linha.";
    const sid = nextStudyId("s", a.sketches);
    added = sid;
    const ids = a.points.map((p) => p.id);
    const roots = shape === "line" ? [ids[Math.floor((ids.length - 1) / 2)]] : ids.slice(0, 2);
    return { ...a, sketches: [...a.sketches, { id: sid, shape, up: true, roots, label: "" }] };
  });
  return result.error ? result : { ...result, part: added ? studyPaths.sketch(added) : null };
}

/** Changes a sketch: its shape, which way it goes and the points it meets the line at. */
export function updateStudySketch(doc: FigureDoc, id: Id, sketch: Id, patch: Partial<Pick<StudySketch, "shape" | "up" | "roots">>): StudyOpResult {
  return withStudy(doc, id, (a) => {
    const old = a.sketches.find((sk) => sk.id === sketch);
    if (!old) return "Esse esboço não existe mais.";
    const shape = patch.shape ?? old.shape;
    const roots = rootsFor(a, shape, patch.roots ?? old.roots);
    if (shape === "line" && roots.length === 0) {
      if (a.points.length === 0) return "Uma reta precisa de um ponto onde corta a linha.";
      roots.push(a.points[0].id);
    }
    return { ...a, sketches: a.sketches.map((sk) => (sk.id === sketch ? { ...sk, ...patch, shape, roots } : sk)) };
  });
}

/** Sets the least width of a stretch, in pt, as dragging a point does. */
export function setStudyWidth(doc: FigureDoc, id: Id, stretch: number, width: number): StudyOpResult {
  return withStudy(doc, id, (a) => {
    if (stretch < 0 || stretch >= a.widths.length) return "Esse trecho não existe.";
    const w = Math.round(Math.max(STUDY_LIMITS.width[0], Math.min(width, STUDY_LIMITS.width[1])));
    return { ...a, widths: a.widths.map((v, i) => (i === stretch ? w : v)) };
  });
}
