import { describe, expect, it } from "vitest";
import {
  DEFAULT_LINE_STYLE,
  DEFAULT_POINT_STYLE,
  arePointsCollinear,
  findCircleFromThreePoints,
  getDependents,
  lineIntersection,
  polygonArea,
  type GeometryElement,
  type Point,
} from "./index";

function point(id: string, x: number, y: number): Point {
  return {
    id,
    type: "point",
    x,
    y,
    style: DEFAULT_POINT_STYLE,
    lockedBy: [],
  };
}

describe("core/geo", () => {
  it("loads without a DOM", () => {
    // Vitest runs this file in plain Node. Importing ./index above is the real check.
    expect("document" in globalThis).toBe(false);
  });

  it("intersects two lines", () => {
    const p = lineIntersection(
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 2, y: 0 },
    );
    expect(p).toEqual({ x: 1, y: 1 });
  });

  it("returns null for parallel lines", () => {
    expect(
      lineIntersection(
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ),
    ).toBeNull();
  });

  it("computes polygon area regardless of winding", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
    ];
    expect(polygonArea(square)).toBe(9);
    expect(polygonArea([...square].reverse())).toBe(9);
  });

  it("finds the circumcircle of three points", () => {
    const c = findCircleFromThreePoints(
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    );
    expect(c?.center.x).toBeCloseTo(0);
    expect(c?.center.y).toBeCloseTo(0);
    expect(c?.radius).toBeCloseTo(1);
  });

  it("rejects collinear points", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 1 };
    const c = { x: 2, y: 2 };
    expect(findCircleFromThreePoints(a, b, c)).toBeNull();
    expect(arePointsCollinear(a, b, c)).toBe(true);
  });

  it("finds elements locked by a point", () => {
    const elements: GeometryElement[] = [
      point("A", 0, 0),
      point("B", 1, 0),
      {
        id: "s1",
        type: "line",
        startPoint: "A",
        endPoint: "B",
        style: DEFAULT_LINE_STYLE,
        lockedBy: ["A", "B"],
      },
    ];
    expect(getDependents(elements, "A")).toEqual(["s1"]);
    expect(getDependents(elements, "s1")).toEqual([]);
  });
});
