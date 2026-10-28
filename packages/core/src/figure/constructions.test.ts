import { describe, expect, it } from "vitest";
import {
  addPoints,
  angleArc,
  connectPoints,
  construct,
  deleteElements,
  emptyDoc,
  freePoints,
  makeCircle,
  makePolygon,
  markPerpendicularBisector,
  movePoints,
  normalizeDoc,
  perpendicularBisectorOf,
  autoLabel,
  pointMap,
  resizePerpendicularBisector,
  sectorRadii,
  setCircleArc,
  setSectorRadii,
  updateElements,
  type Circle,
  toTikz,
  type Angle,
  type FigureDoc,
  type Id,
  type Point,
  type Segment,
} from "./index";

/** Triangle p1 (0,0), p2 (6,0), p3 (2,4) with sides s1 = p1p2, s2 = p2p3, s3 = p3p1. */
function triangle(): FigureDoc {
  const doc = addPoints(emptyDoc(), [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 2, y: 4 },
  ]).doc;
  return connectPoints(doc, ["p1", "p2", "p3"], true).doc;
}

const point = (doc: FigureDoc, id: Id) => pointMap(doc).get(id)!;
const created = <T extends string>(doc: FigureDoc, ids: Id[], type: T) =>
  doc.elements.filter((e) => ids.includes(e.id) && e.type === type);
const isRight = (doc: FigureDoc, angle: Angle) =>
  angleArc(point(doc, angle.a), point(doc, angle.vertex), point(doc, angle.b), angle.reflex)?.isRight;

describe("constructions", () => {
  it("makes the midpoint of a segment or two points and keeps it there", () => {
    const r = construct(triangle(), ["s1"], "midpoint");
    expect(r.error).toBeUndefined();
    const m = r.created[0];
    expect(point(r.doc, m)).toMatchObject({ x: 3, y: 0, construction: { kind: "midpoint", points: ["p1", "p2"] } });
    expect(point(movePoints(r.doc, [{ id: "p2", x: 8, y: 2 }]), m)).toMatchObject({ x: 4, y: 1 });
    expect(construct(r.doc, ["p2", "p1"], "midpoint").error).toMatch(/já existe/);
    expect(construct(triangle(), ["p1", "p3"], "midpoint").created).toHaveLength(1);
    expect(construct(triangle(), ["p1"], "midpoint").error).toBeDefined();
  });

  it("draws a height with its foot and right angle, following the vertex", () => {
    const r = construct(triangle(), ["p3", "s1"], "altitude");
    expect(r.error).toBeUndefined();
    const [foot] = created(r.doc, r.created, "point") as Point[];
    expect(foot).toMatchObject({ x: 2, y: 0 });
    const [angle] = created(r.doc, r.created, "angle") as Angle[];
    expect(angle.rightMark).toBe(true);
    expect(isRight(r.doc, angle)).toBe(true);
    const moved = movePoints(r.doc, [{ id: "p3", x: 5, y: 3 }]);
    expect(point(moved, foot.id)).toMatchObject({ x: 5, y: 0 });
    expect(isRight(moved, angle)).toBe(true);
    expect(construct(r.doc, ["p3", "p1", "p2"], "altitude").error).toMatch(/já existe/);
  });

  it("extends the side with a dashed segment when the foot falls outside it", () => {
    const doc = movePoints(triangle(), [{ id: "p3", x: -2, y: 3 }]);
    const r = construct(doc, ["p3", "s1"], "altitude");
    const segments = created(r.doc, r.created, "segment") as Segment[];
    const extension = segments.find((s) => s.stroke.dash === "dashed");
    expect(extension).toMatchObject({ a: "p1" });
    expect(point(r.doc, extension!.b)).toMatchObject({ x: -2, y: 0 });
  });

  it("uses the existing vertex as the foot in a right triangle", () => {
    const doc = movePoints(triangle(), [{ id: "p3", x: 0, y: 3 }]);
    const r = construct(doc, ["p3", "s1"], "altitude");
    expect(created(r.doc, r.created, "point")).toHaveLength(0);
    expect(created(r.doc, r.created, "angle")).toMatchObject([{ vertex: "p1" }]);
  });

  it("finds the opposite side from a lone vertex, or draws all three heights of a triangle", () => {
    expect(construct(triangle(), ["p3"], "altitude").error).toBeUndefined();
    const poly = makePolygon(triangle(), ["p1", "p2", "p3"]).doc;
    const all = construct(poly, ["g1"], "altitude");
    expect(created(all.doc, all.created, "angle")).toHaveLength(3);
    expect(construct(addPoints(emptyDoc(), [{ x: 0, y: 0 }]).doc, ["p1"], "altitude").error).toMatch(/lado oposto/);
  });

  it("draws a median to the midpoint of the opposite side, reusing it", () => {
    const withMid = construct(triangle(), ["s1"], "midpoint").doc;
    const r = construct(withMid, ["p3", "s1"], "median");
    expect(created(r.doc, r.created, "point")).toHaveLength(0);
    expect(created(r.doc, r.created, "segment")).toMatchObject([{ a: "p3", b: "p4" }]);
  });

  it("ends a triangle's bisector on the opposite side and keeps it there", () => {
    const r = construct(triangle(), ["p1", "p3", "p2"], "bisector");
    expect(r.error).toBeUndefined();
    const [end] = created(r.doc, r.created, "point") as Point[];
    const check = (doc: FigureDoc) => {
      const [a, c, b, d] = ["p1", "p3", "p2", end.id].map((id) => point(doc, id));
      // Angle bisector theorem: AD / DB = CA / CB, with D on AB.
      expect(Math.hypot(d.x - a.x, d.y - a.y) / Math.hypot(d.x - b.x, d.y - b.y)).toBeCloseTo(
        Math.hypot(a.x - c.x, a.y - c.y) / Math.hypot(b.x - c.x, b.y - c.y),
      );
      expect(d.y).toBeCloseTo(0);
    };
    check(r.doc);
    check(movePoints(r.doc, [{ id: "p3", x: 1, y: 5 }]));
  });

  it("gives a loose angle's bisector a hidden end as long as the shorter arm", () => {
    const doc = addPoints(emptyDoc(), [
      { x: 2, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 5 },
    ]).doc;
    const r = construct(doc, ["p1", "p2", "p3"], "bisector");
    const [end] = created(r.doc, r.created, "point") as Point[];
    expect(end.shape).toBe("none");
    expect(end.x).toBeCloseTo(Math.SQRT2);
    expect(end.y).toBeCloseTo(Math.SQRT2);
  });

  it("draws a perpendicular bisector through the midpoint that follows the segment", () => {
    const r = construct(triangle(), ["s1"], "perpendicularBisector");
    expect(r.error).toBeUndefined();
    const ends = (created(r.doc, r.created, "point") as Point[]).filter((p) => p.shape === "none");
    expect(ends.map((p) => [p.x, p.y])).toEqual([
      [3, 3],
      [3, -3],
    ]);
    const [angle] = created(r.doc, r.created, "angle") as Angle[];
    const moved = movePoints(r.doc, [{ id: "p2", x: 6, y: 6 }]);
    expect(isRight(moved, angle)).toBe(true);
    expect(point(moved, ends[0].id)).toMatchObject({ x: 0, y: 6 });
  });

  it("resizes a perpendicular bisector, in proportion or at a fixed length", () => {
    const r = construct(triangle(), ["s1"], "perpendicularBisector");
    const seg = (created(r.doc, r.created, "segment") as Segment[])[0];
    const info = perpendicularBisectorOf(r.doc, seg)!;
    expect(info).toMatchObject({ points: ["p1", "p2"], length: 6, fixed: false });
    expect(info.mark).not.toBeNull();
    expect(perpendicularBisectorOf(r.doc, r.doc.elements.find((e) => e.id === "s1")!)).toBeNull();

    // In proportion: twice as long as p1p2 now and after p2 moves.
    let doc = resizePerpendicularBisector(r.doc, seg.id, 12, false).doc;
    expect(perpendicularBisectorOf(doc, seg)!.length).toBeCloseTo(12);
    doc = movePoints(doc, [{ id: "p2", x: 3, y: 0 }]);
    expect(perpendicularBisectorOf(doc, seg)!.length).toBeCloseTo(6);

    // Fixed: keeps 4 when p2 moves, and survives a save.
    doc = resizePerpendicularBisector(doc, seg.id, 4, true).doc;
    doc = movePoints(doc, [{ id: "p2", x: 10, y: 0 }]);
    expect(perpendicularBisectorOf(doc, seg)).toMatchObject({ fixed: true });
    expect(perpendicularBisectorOf(doc, seg)!.length).toBeCloseTo(4);
    expect(normalizeDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    expect(resizePerpendicularBisector(doc, "s1", 4, true).error).toBeDefined();
    expect(resizePerpendicularBisector(doc, seg.id, 0, true).error).toBeDefined();
  });

  it("removes and restores the right-angle mark of a perpendicular bisector", () => {
    const r = construct(triangle(), ["s1"], "perpendicularBisector");
    const seg = (created(r.doc, r.created, "segment") as Segment[])[0];
    const off = markPerpendicularBisector(r.doc, seg.id, false).doc;
    expect(perpendicularBisectorOf(off, seg)!.mark).toBeNull();
    expect(off.elements.some((e) => e.type === "point" && e.id === perpendicularBisectorOf(off, seg)!.midpoint)).toBe(true);
    const on = markPerpendicularBisector(off, seg.id, true);
    const mark = on.doc.elements.find((e) => e.id === perpendicularBisectorOf(on.doc, seg)!.mark) as Angle;
    expect(mark.rightMark).toBe(true);
    expect(isRight(on.doc, mark)).toBe(true);
    expect(markPerpendicularBisector(on.doc, seg.id, true).error).toBeDefined();
  });

  it("marks where two segments cross and follows them", () => {
    let doc = addPoints(emptyDoc(), [
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
      { x: 4, y: 0 },
    ]).doc;
    doc = connectPoints(doc, ["p1", "p2"], false).doc;
    doc = connectPoints(doc, ["p3", "p4"], false).doc;
    const r = construct(doc, ["s1", "s2"], "intersection");
    expect(r.error).toBeUndefined();
    const x = r.created[0];
    expect(point(r.doc, x)).toMatchObject({ x: 2, y: 2 });
    expect(point(movePoints(r.doc, [{ id: "p2", x: 4, y: 2 }]), x).y).toBeCloseTo(4 / 3);
    expect(construct(triangle(), ["s1", "s2"], "intersection").error).toMatch(/já se cruzam/);
    const apart = movePoints(doc, [{ id: "p4", x: 1, y: 3.5 }]);
    expect(construct(apart, ["s1", "s2"], "intersection").error).toMatch(/não se cruzam/);
  });

  it("marks where a segment crosses a circle, and where two circles cross", () => {
    let doc = addPoints(emptyDoc(), [
      { x: 0, y: 0 },
      { x: -3, y: 0 },
      { x: 3, y: 0 },
      { x: 0, y: 1 },
    ]).doc;
    doc = makeCircle(doc, ["p1"], "radius").doc;
    doc = connectPoints(doc, ["p2", "p3"], false).doc;
    const line = construct(doc, ["s1", "c1"], "intersection");
    expect((created(line.doc, line.created, "point") as Point[]).map((p) => p.x)).toEqual([-1, 1]);

    doc = makeCircle(line.doc, ["p4"], "radius").doc;
    const two = construct(doc, ["c1", "c2"], "intersection");
    const pts = created(two.doc, two.created, "point") as Point[];
    expect(pts).toHaveLength(2);
    // Left of the line between the centers first.
    expect(pts[0].x).toBeCloseTo(-Math.sqrt(3) / 2);
    expect(pts[0].y).toBeCloseTo(0.5);
  });

  it("frees constructed points when a parent is deleted and drops unused hidden ends", () => {
    const mid = construct(triangle(), ["s1"], "midpoint");
    const freed = deleteElements(mid.doc, ["p2"]).doc;
    const m = point(freed, mid.created[0]);
    expect(m.construction).toBeUndefined();
    expect(m).toMatchObject({ x: 3, y: 0 });

    const bis = construct(triangle(), ["s1"], "perpendicularBisector", {});
    const segment = (created(bis.doc, bis.created, "segment") as Segment[])[0];
    const angle = (created(bis.doc, bis.created, "angle") as Angle[])[0];
    const after = deleteElements(bis.doc, [segment.id, angle.id]).doc;
    expect(after.elements.filter((e) => e.type === "point" && e.shape === "none")).toHaveLength(0);
  });

  it("keeps constructions through save and drops broken ones", () => {
    let doc = construct(triangle(), ["p3", "s1"], "altitude").doc;
    doc = construct(doc, ["s2"], "perpendicularBisector").doc;
    doc = construct(doc, ["p1", "p3", "p2"], "bisector").doc;
    doc = construct(doc, ["s1", "s2"], "midpoint").doc;
    const saved = JSON.parse(JSON.stringify(doc));
    expect(normalizeDoc(saved)).toEqual(doc);

    const broken = normalizeDoc({
      kind: "geo",
      version: 1,
      elements: [
        { id: "p1", type: "point", x: 0, y: 0 },
        { id: "p2", type: "point", x: 1, y: 0, construction: { kind: "midpoint", points: ["p1", "p9"] } },
        { id: "p3", type: "point", x: 1, y: 0, construction: { kind: "intersection", of: ["s1", "c1"] } },
      ],
    });
    expect(broken.elements.every((e) => e.type === "point" && !e.construction)).toBe(true);
    expect(toTikz(doc)).toContain("\\coordinate");
  });

  it("makes the projection's foot follow too", () => {
    const r = construct(triangle(), ["p3", "p1", "p2"], "projection");
    const [foot] = created(r.doc, r.created, "point");
    expect(point(movePoints(r.doc, [{ id: "p3", x: 4, y: 4 }]), foot.id)).toMatchObject({ x: 4, y: 0 });
  });
});

describe("orthogonal projection", () => {
  it("projects a point onto a selected segment, dashed, with a right angle", () => {
    const r = construct(triangle(), ["p3", "s1"], "projection");
    expect(r.error).toBeUndefined();
    const [foot] = created(r.doc, r.created, "point") as Point[];
    expect(foot).toMatchObject({ x: 2, y: 0, construction: { kind: "foot", point: "p3", line: ["p1", "p2"] } });
    const [height] = created(r.doc, r.created, "segment") as Segment[];
    expect(height).toMatchObject({ a: "p3", b: foot.id, stroke: { dash: "dashed" } });
    const [angle] = created(r.doc, r.created, "angle") as Angle[];
    expect(isRight(r.doc, angle)).toBe(true);
    expect(construct(r.doc, ["p3", "s1"], "projection").error).toMatch(/já existe/);
  });

  it("projects onto the line through two points, and says when it can't", () => {
    const r = construct(triangle(), ["p3", "p1", "p2"], "projection");
    expect(created(r.doc, r.created, "point")[0]).toMatchObject({ x: 2, y: 0 });
    expect(construct(triangle(), ["p1", "s1"], "projection").error).toMatch(/sobre a reta/);
    expect(construct(triangle(), ["p1", "p2"], "projection").error).toMatch(/Selecione/);
  });
});

describe("sector radii", () => {
  /** A quarter arc of radius 2 around p1, from 0° to 90°. */
  function sector(): { doc: FigureDoc; circle: Circle } {
    let doc = makeCircle(triangle(), ["p1"], "radius").doc;
    const id = doc.elements.find((e) => e.type === "circle")!.id;
    doc = updateElements(doc, [id], (c) => (c.type === "circle" ? { ...c, radius: 2, arc: { start: 0, end: 90 } } : c));
    return { doc, circle: doc.elements.find((e): e is Circle => e.id === id)! };
  }

  it("draws the radii as segments that follow the arc", () => {
    const { doc, circle } = sector();
    const r = setSectorRadii(doc, [circle.id], true);
    expect(r.error).toBeUndefined();
    const [first, second] = sectorRadii(r.doc, circle);
    expect(point(r.doc, first.b)).toMatchObject({ x: 2, y: 0, shape: "none" });
    expect(point(r.doc, second.b).y).toBeCloseTo(2);
    const turned = updateElements(r.doc, [circle.id], (c) => (c.type === "circle" ? { ...c, arc: { start: 0, end: 180 } } : c));
    expect(point(turned, second.b).x).toBeCloseTo(-2);
    expect(setSectorRadii(r.doc, [circle.id], true).error).toMatch(/já tem/);
    // The radii export as ordinary segments to the arc's ends.
    const tikz = toTikz(r.doc);
    expect(tikz).toContain(`\coordinate (${first.b})`);
    expect(tikz).toContain(`(${first.a}) -- (${first.b})`);
  });

  it("labels a drawn radius on its segment", () => {
    const { doc, circle } = sector();
    const withRadii = setSectorRadii(doc, [circle.id], true).doc;
    const labeled = autoLabel(withRadii, "circle", "radius", null).doc;
    const [first] = sectorRadii(labeled, circle);
    expect(first.label?.measure?.kind).toBe("length");
    expect(labeled.elements.find((e) => e.id === circle.id)?.label).toBeUndefined();
    const plain = autoLabel(doc, "circle", "radius", null).doc;
    expect(plain.elements.find((e) => e.id === circle.id)?.label?.measure?.kind).toBe("radius");
  });

  it("removes the radii when switched off, with the arc, or with the circle", () => {
    const { doc, circle } = sector();
    const on = setSectorRadii(doc, [circle.id], true).doc;
    const count = (d: FigureDoc) => d.elements.length;
    expect(count(setSectorRadii(on, [circle.id], false).doc)).toBe(count(doc));
    expect(count(setCircleArc(on, [circle.id], false).doc)).toBe(count(doc));
    expect(count(deleteElements(on, [circle.id]).doc)).toBe(count(doc) - 1);
  });

  it("turns the old drawn-in radii into segments", () => {
    const { doc, circle } = sector();
    const old = updateElements(doc, [circle.id], (c) => (c.type === "circle" ? { ...c, radii: true } : c));
    const r = setSectorRadii(old, [circle.id], true);
    expect(r.doc.elements.find((e): e is Circle => e.id === circle.id)?.radii).toBe(false);
    expect(sectorRadii(r.doc, circle)).toHaveLength(2);
  });
});

describe("freePoints", () => {
  it("stops a constructed point from following", () => {
    const r = construct(triangle(), ["s1"], "midpoint");
    const free = freePoints(r.doc, r.created).doc;
    expect(point(movePoints(free, [{ id: "p2", x: 10, y: 0 }]), r.created[0])).toMatchObject({ x: 3, y: 0 });
    expect(freePoints(free, r.created).error).toBeDefined();
  });
});
