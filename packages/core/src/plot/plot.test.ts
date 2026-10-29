import { describe, expect, it } from "vitest";
import { parseExpr, sampleFunction, type Pt } from "./index";

const value = (text: string, x: number) => {
  const r = parseExpr(text);
  if (!r.ok) throw new Error(r.error);
  return r.fn(x);
};

describe("expressions", () => {
  it("reads what teachers type", () => {
    expect(value("x^2 - 1", 3)).toBe(8);
    expect(value("2x + 1", 2)).toBe(5);
    expect(value("-x^2", 3)).toBe(-9);
    expect(value("2^-x", 1)).toBe(0.5);
    expect(value("2^3^2", 0)).toBe(512);
    expect(value("(x+1)(x-1)", 3)).toBe(8);
    expect(value("1,5x", 2)).toBe(3);
    expect(value("x²", 4)).toBe(16);
    expect(value("3sen(x)", Math.PI / 2)).toBeCloseTo(3);
    expect(value("sen x + 1", 0)).toBe(1);
    expect(value("tg(pi/4)", 0)).toBeCloseTo(1);
    expect(value("raiz(x)", 9)).toBe(3);
    expect(value("|x - 2|", 0)).toBe(2);
    expect(value("2|x|", -3)).toBe(6);
    expect(value("|x| + |x - 1|", 0.5)).toBe(1);
    expect(value("2pix", 1)).toBeCloseTo(2 * Math.PI);
    expect(value("e^x", 1)).toBeCloseTo(Math.E);
    expect(value("ln(e)", 0)).toBeCloseTo(1);
    expect(value("log(100)", 0)).toBe(2);
    expect(value("x^(1/3)", -8)).toBeCloseTo(-2);
    expect(value("1/x", 0)).toBe(Infinity);
    expect(value("sqrt(x)", -1)).toBeNaN();
    // e is the constant, not an exponent: 2e+1 is 2·e + 1.
    expect(value("2e+1", 0)).toBeCloseTo(2 * Math.E + 1);
    expect(value("x+2e-1", 0)).toBeCloseTo(2 * Math.E - 1);
    // Without parentheses a function takes the factors written together.
    expect(value("sen 2x", Math.PI / 4)).toBeCloseTo(1);
    expect(value("sen x cos x", Math.PI / 4)).toBeCloseTo(0.5);
    expect(value("x^(2/3)", -8)).toBeCloseTo(4);
  });

  it("explains mistakes, with where they are", () => {
    const bad = (text: string) => {
      const r = parseExpr(text);
      if (r.ok) throw new Error(`${text} parsed`);
      return r;
    };
    expect(bad("").error).toMatch(/Digite/);
    expect(bad("x +").error).toMatch(/termina/);
    expect(bad("(x + 1").error).toMatch(/parêntese/);
    expect(bad("x + 1)").error).toMatch(/\)/);
    expect(bad("2y").at).toBe(1);
    expect(bad("x # 2").error).toMatch(/#/);
  });
});

const flat = (lines: Pt[][]) => lines.flat();

describe("sampling", () => {
  it("draws a parabola as one line inside the range", () => {
    const lines = sampleFunction((x) => x * x - 1, [-3, 3], [-2, 5]);
    for (const p of flat(lines)) expect(p.y).toBeGreaterThanOrEqual(-2);
    for (const p of flat(lines)) expect(p.y).toBeLessThanOrEqual(5);
    // x² - 1 reaches y = 5 at x = ±√6: one piece, cut there.
    expect(lines).toHaveLength(1);
    const xs = flat(lines).map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(-Math.sqrt(6), 2);
    expect(Math.max(...xs)).toBeCloseTo(Math.sqrt(6), 2);
  });

  it("breaks at an asymptote instead of crossing it", () => {
    const lines = sampleFunction((x) => 1 / x, [-4, 4], [-5, 5]);
    expect(lines).toHaveLength(2);
    expect(lines[0].every((p) => p.x < 0)).toBe(true);
    expect(lines[1].every((p) => p.x > 0)).toBe(true);
  });

  it("leaves out where the function is undefined", () => {
    const lines = sampleFunction(Math.sqrt, [-4, 4], [-1, 3]);
    expect(lines).toHaveLength(1);
    expect(Math.min(...lines[0].map((p) => p.x))).toBeGreaterThanOrEqual(0);
    expect(lines[0][0].x).toBeLessThan(0.01);
  });

  it("splits tan x into a branch per period", () => {
    const lines = sampleFunction(Math.tan, [-Math.PI, Math.PI], [-4, 4]);
    // Branches around -π, 0 and π: cut at ±π/2.
    expect(lines).toHaveLength(3);
  });

  it("keeps a steep line that crosses the whole range between two samples", () => {
    const lines = sampleFunction((x) => 1000 * x, [-5, 5], [-1, 1], { steps: 4 });
    expect(lines).toHaveLength(1);
    expect(Math.min(...lines[0].map((p) => p.y))).toBeCloseTo(-1, 2);
    expect(Math.max(...lines[0].map((p) => p.y))).toBeCloseTo(1, 2);
  });

  it("returns nothing for an empty domain or range", () => {
    expect(sampleFunction((x) => x, [1, 1], [-1, 1])).toEqual([]);
    expect(sampleFunction((x) => x, [0, 1], [2, 2])).toEqual([]);
  });

  it("follows a line exactly with few points", () => {
    const lines = sampleFunction((x) => 2 * x + 1, [0, 2], [-10, 10]);
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toEqual({ x: 0, y: 1 });
    expect(lines[0][lines[0].length - 1]).toEqual({ x: 2, y: 5 });
  });
});
