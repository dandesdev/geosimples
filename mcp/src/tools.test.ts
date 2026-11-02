import { GUIDE } from "@geosimples/core/recipe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { drawFigure, renderDoc } from "./tools";
import { FIGURE_META } from "./view";

/** How many times each export ran: every call to the server's tools goes through these. */
const built = vi.hoisted(() => ({ svg: 0, tikz: 0, link: 0 }));

vi.mock("@geosimples/core/figure", async (importOriginal) => {
  const real = await importOriginal<typeof import("@geosimples/core/figure")>();
  return {
    ...real,
    toSvg: (...args: Parameters<typeof real.toSvg>) => (built.svg++, real.toSvg(...args)),
    toTikz: (...args: Parameters<typeof real.toTikz>) => (built.tikz++, real.toTikz(...args)),
    encodeShareToken: (...args: Parameters<typeof real.encodeShareToken>) => (built.link++, real.encodeShareToken(...args)),
  };
});

const PYTHAGOREAN = GUIDE.overview.examples[0].recipe;

describe("each export is built once per call", () => {
  beforeEach(() => Object.assign(built, { svg: 0, tikz: 0, link: 0 }));

  it("shares the SVG, TikZ and link between the outputs and the preview", async () => {
    const result = await drawFigure({ recipe: PYTHAGOREAN, output: ["svg", "tikz", "link"] } as Parameters<typeof drawFigure>[0]);
    const view = result._meta?.[FIGURE_META] as { svg: string; tikz: string; link: string };
    const [, svg, tikz, link] = result.content.map((c) => c.text);
    expect([view.svg, view.tikz, `[Abrir no GeoSimples](${view.link})`]).toEqual([svg, tikz, link]);
    expect(built).toEqual({ svg: 1, tikz: 1, link: 1 });
  });

  it("builds for the preview what the outputs didn't ask for, once", async () => {
    const drawn = await drawFigure({ recipe: PYTHAGOREAN, output: ["doc"] } as Parameters<typeof drawFigure>[0]);
    Object.assign(built, { svg: 0, tikz: 0, link: 0 });
    await renderDoc({ doc: JSON.parse(drawn.content[1].text), output: ["svg", "svg"] });
    expect(built).toEqual({ svg: 1, tikz: 1, link: 1 });
  });
});
