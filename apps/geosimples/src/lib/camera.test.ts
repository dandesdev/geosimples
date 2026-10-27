import { describe, expect, it } from "vitest";
import { pinchOf, pinchView, zoomView, type View } from "./camera";

/** Screen to view coordinates for a view drawn from the client origin at `u` units per px. */
const toView = (v: View, u: number, p: { x: number; y: number }) => ({ x: v.x + p.x * u, y: v.y + p.y * u });

const view: View = { x: -20, y: -10, w: 400, h: 300 };
const u = 0.5;

describe("zoomView", () => {
  it("keeps the anchor in place", () => {
    const at = { x: 30, y: 40 };
    const z = zoomView(view, 0.5, at);
    expect(z.w).toBeCloseTo(200);
    expect(z.h).toBeCloseTo(150);
    // The anchor sits at the same fraction of the view before and after.
    expect((at.x - z.x) / z.w).toBeCloseTo((at.x - view.x) / view.w);
    expect((at.y - z.y) / z.h).toBeCloseTo((at.y - view.y) / view.h);
  });

  it("clamps the zoom", () => {
    expect(zoomView(view, 1e-9, { x: 0, y: 0 }).w).toBe(5);
    expect(zoomView(view, 1e9, { x: 0, y: 0 }).w).toBe(1e6);
  });
});

describe("pinchOf", () => {
  it("measures the midpoint and the distance", () => {
    expect(pinchOf({ x: 0, y: 0 }, { x: 6, y: 8 })).toEqual({ x: 3, y: 4, dist: 10 });
  });
});

describe("pinchView", () => {
  it("pans with two fingers moving together", () => {
    const from = pinchOf({ x: 100, y: 100 }, { x: 200, y: 100 });
    const to = pinchOf({ x: 130, y: 80 }, { x: 230, y: 80 });
    const next = pinchView(view, u, toView(view, u, from), from, to);
    expect(next.w).toBeCloseTo(view.w);
    expect(next.x).toBeCloseTo(view.x - 30 * u);
    expect(next.y).toBeCloseTo(view.y + 20 * u);
  });

  it("zooms in when the fingers spread, around their midpoint", () => {
    const from = pinchOf({ x: 100, y: 100 }, { x: 200, y: 100 });
    const to = pinchOf({ x: 50, y: 100 }, { x: 250, y: 100 });
    const at = toView(view, u, from);
    const next = pinchView(view, u, at, from, to);
    expect(next.w).toBeCloseTo(view.w / 2);
    // The point under the midpoint is still under it.
    const after = toView(next, u / 2, to);
    expect(after.x).toBeCloseTo(at.x);
    expect(after.y).toBeCloseTo(at.y);
  });

  it("keeps the figure point under the fingers while pinching and moving", () => {
    const from = pinchOf({ x: 120, y: 90 }, { x: 180, y: 170 });
    const to = pinchOf({ x: 60, y: 200 }, { x: 140, y: 260 });
    const at = toView(view, u, from);
    const next = pinchView(view, u, at, from, to);
    const scale = next.w / view.w;
    expect(scale).toBeCloseTo(from.dist / to.dist);
    const after = toView(next, u * scale, to);
    expect(after.x).toBeCloseTo(at.x);
    expect(after.y).toBeCloseTo(at.y);
  });

  it("stays finite when the fingers touch", () => {
    const from = pinchOf({ x: 100, y: 100 }, { x: 200, y: 100 });
    const to = pinchOf({ x: 150, y: 100 }, { x: 150, y: 100 });
    const next = pinchView(view, u, toView(view, u, from), from, to);
    expect(Number.isFinite(next.x) && Number.isFinite(next.w)).toBe(true);
    expect(next.w).toBeGreaterThan(view.w);
  });
});
