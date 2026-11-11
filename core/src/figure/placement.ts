import { angleArc, pointMap } from "./geometry";
import { estimateTextWidth, labelPlacement, labelText } from "./labels";
import { figureUnits } from "./plot";
import { grow, LineIndex, overlap, pathLines, textBox } from "./lines";
import { buildScene, type Box } from "./render";
import type { Element, ElementType, FigureDoc, Id, Label } from "./types";
import type { Vec } from "./vec";

export { pathLines } from "./lines";

/**
 * Moves automatic labels off the lines and labels they would cover.
 *
 * Automatic placement only looks at the element itself: a point's name goes
 * away from its neighbors, a side's length goes outward, an angle's measure
 * goes along its bisector. So the 90° of a right angle lands on the height
 * drawn from it, and a long length crosses its own dashed line. This pass
 * tries nearby directions and distances for each label and keeps the one that
 * covers the least, preferring the automatic spot.
 *
 * Only labels that are automatic (angle null) and listed in `ids` move. A
 * label whose automatic spot is already clear stays automatic, so it keeps
 * following its element when the figure changes. A label that moves gets a
 * fixed angle and distance, like one set by hand.
 */
export function unclutterLabels(doc: FigureDoc, ids?: Iterable<Id>): FigureDoc {
  const wanted = ids ? new Set(ids) : null;
  const movable = doc.elements.filter(
    (e) => (!wanted || wanted.has(e.id)) && hasAutoLabel(e) && labelPlacement(doc, e) !== null,
  );
  if (movable.length === 0) return doc;

  const scene = buildScene(doc);
  const types = new Map(doc.elements.map((e) => [e.id, e.type] as const));
  const moving = new Set(movable.map((e) => e.id));
  const lines = new LineIndex();
  const taken: Box[] = [];
  for (const p of scene.prims) {
    const type = types.get(p.owner);
    if (p.kind === "text") {
      // Labels about to be placed don't block yet; everything else written on the figure does.
      if (!moving.has(p.owner)) taken.push(textBox(p, p.text, p.size));
      continue;
    }
    // The printed grid is under everything, and fills alone (a polygon's inside) are fine to write on.
    if (type === "grid" || (!p.stroke && type !== "point")) continue;
    for (const line of pathLines(p.d)) lines.add(line);
  }

  const O = (w: Vec, o: Vec): Vec => ({ x: w.x * scene.kx + o.x, y: -w.y * scene.ky - o.y });
  const order = [...movable].sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type]);
  const placed = new Map<Id, Label>();
  for (const el of order) {
    const label = el.label!;
    const text = labelText(doc, el);
    const boxAt = (candidate: Element): Box | null => {
      const at = labelPlacement(doc, candidate);
      return at ? textBox(O(at.anchor, at.offset), text, label.size) : null;
    };
    const cost = (box: Box) => lines.lengthIn(grow(box, PAD)) + overlap(box, taken) / label.size;

    const start = boxAt(el)!;
    const startCost = cost(start);
    let best = { box: start, cost: startCost, label: null as Label | null };
    if (startCost > CLEAR) {
      for (const c of candidates(doc, el, label, text)) {
        const moved = { ...label, angle: normalize(c.angle), distance: Math.max(0, c.distance) };
        const box = boxAt({ ...el, label: moved } as Element);
        if (!box) continue;
        const total = cost(box) + c.penalty;
        if (total < best.cost) best = { box, cost: total, label: moved };
      }
    }
    taken.push(best.box);
    if (best.label) placed.set(el.id, best.label);
  }
  if (placed.size === 0) return doc;
  return {
    ...doc,
    elements: doc.elements.map((e) => {
      const label = placed.get(e.id);
      return label ? ({ ...e, label } as Element) : e;
    }),
  };
}

/** Padding around a label's box, in pt, so text doesn't touch a line either. */
const PAD = 1.5;
/** Cover in pt of line below which a spot counts as clear. */
const CLEAR = 0.5;

/** Points first, since their names sit closest to the shapes; then marks, then the rest. */
const PRIORITY: Record<ElementType, number> = {
  point: 0,
  angle: 1,
  segment: 2,
  vector: 2,
  component: 2,
  circuit: 9,
  region: 9,
  vennitems: 9,
  board: 9,
  polygon: 3,
  circle: 4,
  function: 5,
  vline: 6,
  extension: 9,
  text: 9,
  axes: 9,
  grid: 9,
  numberline: 9,
};

function hasAutoLabel(el: Element): boolean {
  return "label" in el && !!el.label && el.label.angle === null;
}

interface Candidate {
  angle: number;
  distance: number;
  /** Cost of leaving the automatic spot, in pt of covered line. */
  penalty: number;
}

/** Other spots to try for a label, with what it costs to move there. */
function candidates(doc: FigureDoc, el: Element, label: Label, text: string): Candidate[] {
  const d = label.distance;
  const out: Candidate[] = [];
  const auto = labelPlacement(doc, el);
  const autoDir = auto && (auto.offset.x !== 0 || auto.offset.y !== 0) ? degrees(auto.offset) : 90;
  const farther = (angle: number, penalty: number, steps: number[]) => {
    for (const [i, extra] of steps.entries()) out.push({ angle, distance: d + extra, penalty: penalty + i * 0.4 });
  };

  switch (el.type) {
    case "point": {
      // A point's label is centered at a fixed distance, which fits a letter. A wider one, like
      // coordinates, reaches back over the point sideways, so it also tries spots out by its extra half-width.
      const wide = Math.max(0, estimateTextWidth(text, label.size) / 2 - label.size * 0.4);
      const steps = (angle: number) => {
        const out = Math.abs(Math.cos((angle * Math.PI) / 180)) * wide;
        return out > 1 ? [0, 3, out, out + 3] : [0, 3];
      };
      for (let i = 1; i <= 15; i++) {
        const turn = Math.ceil(i / 2) * 22.5 * (i % 2 ? 1 : -1);
        farther(autoDir + turn, 0.3 * Math.ceil(i / 2), steps(autoDir + turn));
      }
      farther(autoDir, 0, steps(autoDir).slice(1).concat(6));
      break;
    }
    case "segment":
    case "vector":
      for (const side of [0, 180]) {
        for (const tilt of [0, 20, -20, 40, -40]) {
          farther(autoDir + side + tilt, (side ? 2 : 0) + Math.abs(tilt) / 40, [0, 4, 8, 12, 18, 26]);
        }
      }
      break;
    case "angle": {
      const pts = pointMap(doc);
      const u = figureUnits(doc);
      const S = (p: Vec): Vec => ({ x: p.x * u.x, y: p.y * u.y });
      const a = pts.get(el.a);
      const v = pts.get(el.vertex);
      const b = pts.get(el.b);
      const arc = a && v && b ? angleArc(S(a), S(v), S(b), el.reflex) : null;
      if (!arc) break;
      for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        farther(arc.start + arc.sweep * t, Math.abs(t - 0.5) * 4, [0, 4, 8, 14, 20]);
      }
      break;
    }
    case "polygon":
      for (const [ring, distance] of [label.size * 1.2, label.size * 2.2, label.size * 3.2].entries()) {
        for (let i = 0; i < 8; i++) out.push({ angle: 90 - i * 45, distance, penalty: 1 + ring });
      }
      break;
    case "circle":
      for (let i = 1; i < 8; i++) out.push({ angle: (label.angle ?? 45) + i * 45, distance: d, penalty: 0.4 * i });
      break;
    case "function":
    case "vline":
      for (const turn of [45, -45, 90, -90, 135, -135, 180]) {
        farther(autoDir + turn, Math.abs(turn) / 45, [0, 4, 8]);
      }
      break;
  }
  return out;
}

function degrees(v: Vec): number {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI;
}

function normalize(deg: number): number {
  const r = Math.round((((deg % 360) + 360) % 360) * 10) / 10;
  return r === 360 ? 0 : r;
}
