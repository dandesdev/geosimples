import type { RecipeInput } from "./schema";

/**
 * The recipe guide an agent reads through the MCP's get_reference tool. The
 * schema says what fields exist; this says how to use them. Every example
 * here is compiled by the tests, so the guide can't drift from the compiler.
 */

export interface GuideExample {
  /** What a teacher might ask, in their words. */
  request: string;
  recipe: RecipeInput;
}

export interface GuideTopic {
  title: string;
  text: string;
  examples: GuideExample[];
}

export const GUIDE_TOPIC_NAMES = ["overview", "geometry", "constructions", "graphs", "labels"] as const;
export type GuideTopicName = (typeof GUIDE_TOPIC_NAMES)[number];

export const GUIDE: Record<GuideTopicName, GuideTopic> = {
  overview: {
    title: "How recipes work",
    text: `A recipe is { "v": 1, "locale"?: "en", "defaults"?: {...}, "steps": [...] }. Steps run in order; each one does what a button in the GeoSimples editor does, so constructions keep their usual marks (an altitude comes with its foot and right-angle mark).

Units: coordinates and lengths are in cm at scale 1, y up. Line widths, point sizes, arc radii and font sizes are in pt. Angles in degrees, counterclockwise from +x. Write exact values as text, never rounded: "2π", "-π/2", "sqrt(2)", "3sqrt(3)/2" wherever a number goes. Measures the figure rounds show with ≈ (≈ 2,24), and exact ones without it (2,4).

Names: give points names ("A") and refer to them by name. A segment is [A, B], an angle [A, V, B] with the vertex in the middle. Anything else gets an "as" name. Triangles and polygons are named after their points ("ABC") unless "as" is given. A name is also the label shown on a point.

Targets ("label" and "style" steps) are always a list: ["A", "B"] are the points A and B; [["A", "B"]] is the segment AB; [["A", "C", "B"]] the angle at C; {"sidesOf": "ABC"}, {"anglesOf": "ABC"}, {"all": "segment"}.

Style is partial: give only what changes. "style" and "label" on a step apply to what that step makes. On a polygon, line fields (color, width, dash) go to its sides and "fill" to its inside. Polygons are outlines: fill one only when the teacher asks, with "fill" on its step or style, or in "defaults" for all of them. Draw nothing else the teacher didn't ask for: no extra labels, measures, colors or marks.

Language: GeoSimples is Brazilian, so figures default to the decimal comma (2,4) and coordinates as (1; 2). When the teacher writes in English, add "locale": "en" to the recipe for 2.4 and (1, 2). Write labels and texts in the teacher's language. Expressions take either sin or sen, tan or tg, and a decimal point or comma.

Errors come back as { step, code, message }. Fix that step and send the whole recipe again; the same recipe always gives the same figure, so follow-up changes are edits to the recipe.`,
    examples: [
      {
        request: "Triângulo retângulo 3-4-5 com a hipotenusa na base, a altura tracejada, os lados com letras, a medida da altura e todos os ângulos.",
        recipe: {
          v: 1,
          steps: [
            { do: "triangle", points: ["A", "B", "C"], sides: [5, 4, 3] },
            { do: "angles", of: "ABC", label: { measure: true, decimals: 0 } },
            {
              do: "altitude",
              from: "C",
              to: ["A", "B"],
              foot: "H",
              style: { dash: "dashed" },
              label: { measure: true, prefix: "h = " },
            },
            { do: "label", targets: [{ sidesOf: "ABC" }], scheme: "opposite" },
          ],
        },
      },
    ],
  },
  geometry: {
    title: "Points, polygons, circles and angles",
    text: `Points: "points" with {name, at: [x, y]} or {name, from, length, angle} (polar from another point, which may come earlier in the same step). "input" takes the editor's input-bar text, like "A=0;0 B=4;0 C=0;3 A--B--C--".

Shapes that need math: "triangle" from three sides [|P0P1|, |P1P2|, |P2P0|], or a base with the two angles on it; P0 sits at "at" (default origin), P0P1 points along "rotate" (default 0, so P2 is above). "regularPolygon" from "side" or "radius", counterclockwise from P0. Both also draw the polygon.

"segment" joins points in order ("closed" joins the last to the first). "polygon" draws the sides and the polygon. "circle" takes a center and one of radius, through (a point on it) or tangentTo (a segment), or circumscribed (three points; the center is made, named by centerName). "arc": [from, to] draws only that arc and "sector": true adds the two radii; "ends" names the arc's end points, so the sector's angle can be marked.

"angle" marks one angle; "angles" marks every interior angle of a polygon. 90° angles get a square unless "rightMark": false. Use "arcs" and "ticks" to show equal angles, and "ticks" on segments for equal sides.`,
    examples: [
      {
        request: "Hexágono regular de lado 2 sem preenchimento, com um lado vermelho.",
        recipe: {
          v: 1,
          steps: [
            { do: "regularPolygon", points: ["A", "B", "C", "D", "E", "F"], side: 2 },
            { do: "style", targets: [["A", "B"]], style: { color: "red", width: 1.6 } },
          ],
        },
      },
      {
        request: "Setor circular de 60° com raio 3, preenchido, com a medida do ângulo.",
        recipe: {
          v: 1,
          steps: [
            { do: "points", points: [{ name: "O", at: [0, 0] }] },
            { do: "circle", center: "O", radius: 3, arc: [0, 60], sector: true, ends: ["A", "B"], style: { fill: true } },
            { do: "angle", points: ["A", "O", "B"], label: { measure: true, decimals: 0 } },
          ],
        },
      },
      {
        request: "Triângulo isósceles com base 6 e ângulos da base de 50°, marcando os lados iguais.",
        recipe: {
          v: 1,
          steps: [
            { do: "triangle", points: ["A", "B", "C"], base: 6, angles: [50, 50] },
            { do: "style", targets: [["B", "C"], ["C", "A"]], style: { ticks: 1 } },
            { do: "angle", points: ["C", "A", "B"], label: { measure: true, decimals: 0 } },
            { do: "angle", points: ["A", "B", "C"], label: { measure: true, decimals: 0 } },
          ],
        },
      },
    ],
  },
  constructions: {
    title: "Constructions",
    text: `Each construction follows its points, as in the editor, and adds what the textbook drawing has:

- "midpoint" of [A, B], with "name".
- "altitude" from a vertex to the line of a side [A, B]: the foot ("foot" names it), the height and its right-angle mark. When the foot is outside the side, a dashed extension of the side reaches it.
- "projection" of a point onto the line [A, B]: like altitude, dashed.
- "median" from a vertex to the midpoint of [A, B] ("midpoint" names it).
- "bisector" of the angle [A, V, B]; in a triangle it ends on the opposite side ("end" names that point).
- "perpendicularBisector" (mediatriz) of [A, B], with its right-angle mark.
- "intersection" of two curves: segments [A, B], circles, functions or vertical lines by name. "names" names the crossings in order.
- "tangent" at a point on a graph (see graphs).

The step's "style", "label" and "as" apply to the line it draws (the height, the median…).`,
    examples: [
      {
        request: "Triângulo com as três medianas e o baricentro G.",
        recipe: {
          v: 1,
          steps: [
            { do: "triangle", points: ["A", "B", "C"], sides: [6, 5, 4] },
            { do: "median", from: "A", to: ["B", "C"], midpoint: "M", as: "ma" },
            { do: "median", from: "B", to: ["C", "A"], midpoint: "N", as: "mb" },
            { do: "median", from: "C", to: ["A", "B"], midpoint: "P", as: "mc" },
            { do: "intersection", of: ["ma", "mb"], names: ["G"] },
          ],
        },
      },
      {
        request: "Circunferência circunscrita a um triângulo, com o centro O.",
        recipe: {
          v: 1,
          steps: [
            { do: "triangle", points: ["A", "B", "C"], sides: [5, 6, 4] },
            { do: "circle", circumscribed: ["A", "B", "C"], centerName: "O" },
          ],
        },
      },
    ],
  },
  graphs: {
    title: "Graphs, axes and number lines",
    text: `"function" draws y = expr (like "x^2 - 4", "2sen(x)", "sqrt(x)", "1/x"); it adds axes when there are none, and is named f, g, h… unless "name" is given. "domain" limits x and "range" cuts y; "ends" puts closed or open dots at the ends.

Axes fit the figure by themselves: a window centered on the graph's symmetry when it has one (a parabola's axis, a hyperbola's center), 4:3 or square, with y scaled for a flat or steep curve. Give "domain" only when the teacher asks for one. An "axes" step changes names, numbers, step, unit (cm per unit on x and y) or xPi (ticks in multiples of π); giving "x" or "y" fixes the window. "grid" adds a printed square grid. "vline" draws x = a, dashed like an asymptote.

On a graph: "pointOnGraph" at x, "notable" for roots (x₁, x₂…), turning points (V) or the y-axis crossing, "tangent" at a point on the graph ("fill": true spans the window), "guides" for the dashed lines from a point to the axes.

"numberline" plus "interval" (from/to, null for ±∞, closed: [bool, bool]) draws intervals.`,
    examples: [
      {
        request: "Parábola y = x² − 4 com as raízes, o vértice e a reta tangente em x = 1.",
        recipe: {
          v: 1,
          steps: [
            { do: "function", expr: "x^2 - 4" },
            { do: "notable", graph: "f", feature: "root" },
            { do: "notable", graph: "f", feature: "extremum" },
            { do: "pointOnGraph", graph: "f", x: 1, name: "P" },
            { do: "tangent", point: "P", style: { dash: "dashed" } },
            { do: "guides", points: ["P"] },
          ],
        },
      },
      {
        request: "Seno de −2π a 2π com o eixo x em π/2.",
        recipe: {
          v: 1,
          steps: [
            { do: "function", expr: "sen(x)", domain: ["-2π", "2π"] },
            { do: "axes", xPi: 0.5, x: [-7, 7], y: [-1.5, 1.5] },
          ],
        },
      },
      {
        request: "Intervalo [−2, 3[ na reta numérica.",
        recipe: {
          v: 1,
          steps: [
            { do: "numberline", x: [-4, 5] },
            { do: "interval", from: -2, to: 3, closed: [true, false] },
          ],
        },
      },
    ],
  },
  labels: {
    title: "Labels and style",
    text: `Labels are placed automatically: a point's name goes outside its shapes, a side's length outward, an angle's measure inside the angle. After the last step, every automatic label that would cover a line or another label moves to a nearby clear spot (another direction or a little farther out). Set "angle" (the direction from the object in degrees, 0 right, 90 up) or "distance" (pt) only to put a label somewhere on purpose; a label with either one stays exactly where written.

A "label" field is plain text ("x") or an object: {text} or {measure} plus decimals, prefix, suffix, angle (direction from the object, omit for automatic), distance, size, color, font. "measure": true shows the usual live measure: length on segments, the angle on angles, the radius on circles, the area on polygons ("perimeter" also works). Measures follow the figure. Numbers use the decimal comma (2,5) unless the recipe has "locale": "en" (2.5): use "en" when the teacher writes in English.

A "label" step labels earlier things: "text" for all targets, "scheme" (latin A B C, latin-lower, greek α β γ, numbered, coordinates for points, opposite for triangle sides: side BC of ABC is a), or "label" for the full form. "remove": true clears labels.

A "style" step restyles earlier things. Colors: "#rrggbb", "ink" (black in print) or a color name (black, gray, lightgray, white, red, orange, yellow, green, blue, cyan, purple, magenta). Dash: solid, dashed, dotted. Fill: true, false or {color, opacity, pattern: solid|hatch|crosshatch|dots, angle}.

"defaults" sets the look of everything made afterwards: stroke, point, fill, polygonFilled, angle (radius, arcs, rightMark) and label (size, color, font, distance).`,
    examples: [
      {
        request: "Quadrado de lado 4 com a diagonal tracejada, sua medida com duas casas e a área dentro.",
        recipe: {
          v: 1,
          defaults: { fill: { color: "blue", opacity: 0.15 } },
          steps: [
            { do: "regularPolygon", points: ["A", "B", "C", "D"], side: 4, label: { measure: "area", prefix: "S = ", decimals: 0 } },
            { do: "segment", points: ["A", "C"], style: { dash: "dashed" }, label: { measure: true, prefix: "d = " } },
          ],
        },
      },
    ],
  },
};

/** One topic, or all of them, as the text the tool returns. */
export function guideText(topic?: GuideTopicName): string {
  const topics = topic ? [topic] : GUIDE_TOPIC_NAMES;
  return topics
    .map((name) => {
      const t = GUIDE[name];
      const examples = t.examples
        .map((e) => `Request: ${e.request}\n${JSON.stringify(e.recipe)}`)
        .join("\n\n");
      return `# ${t.title}\n\n${t.text}${examples ? `\n\n## Examples\n\n${examples}` : ""}`;
    })
    .join("\n\n");
}
