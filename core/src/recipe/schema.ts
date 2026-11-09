import { z } from "zod";
import { graphFn, LIMITS } from "../figure";

/**
 * Recipe v1: a figure described as steps, the way an agent writes it. The
 * compiler runs each step through the editor's own operations, so a recipe
 * reaches every feature without restating how the editor builds things.
 *
 * Descriptions are short on purpose: the schema is sent to every agent
 * conversation, and the longer guide is in guide.ts.
 */

/** The value of a constant expression like "2π" or "sqrt(2)", or null when it isn't one. */
function constantValue(text: string): number | null {
  const fn = graphFn(text);
  if (!fn) return null;
  const v = fn(0);
  // An expression in x isn't a constant.
  return Number.isFinite(v) && fn(1.2345) === v ? v : null;
}

/**
 * A number, or an exact value written as an expression ("2π", "-π/2",
 * "sqrt(2)"), so agents keep π and roots instead of rounding them.
 */
const exact = z.union([z.number(), z.string().min(1).max(40)]).transform((v, ctx) => {
  if (typeof v === "number") return v;
  const n = constantValue(v);
  if (n === null) {
    ctx.addIssue({ code: "custom", message: `"${v}" is not a number. Write a number, or an exact value like "2π", "-π/2" or "sqrt(2)".` });
    return z.NEVER;
  }
  return n;
});
const EXACT = 'A number, or an exact value like "2π", "-π/2", "sqrt(2)"';
const coord = exact.pipe(z.number().min(-LIMITS.coordinate).max(LIMITS.coordinate)).meta({ id: "coord", description: EXACT });
const positive = exact.pipe(z.number().positive().max(LIMITS.coordinate)).meta({ id: "positive", description: EXACT });
const name = z.string().min(1).max(32).meta({ id: "name", description: "Name, also shown as the label" });
const ref = z.string().min(1).max(32).meta({ id: "ref" });
const pair = z.tuple([ref, ref]).meta({ id: "pair" });
const xy = z.tuple([coord, coord]).meta({ id: "xy" });
const interval = z.tuple([coord, coord]).meta({ id: "interval" });

export const colorSchema = z
  .string()
  .meta({
    id: "color",
    description: '"#rrggbb", "ink" (black in print) or black, gray, lightgray, white, red, orange, yellow, green, blue, cyan, purple, magenta',
  });

const dash = z.enum(["solid", "dashed", "dotted"]).meta({ id: "dash" });
const fillPattern = z.enum(["solid", "hatch", "crosshatch", "dots"]);

const fillSpec = z.union([
  z.boolean().describe("true: default fill, false: none"),
  z.strictObject({
    color: colorSchema.optional(),
    opacity: z.number().min(0).max(1).optional(),
    pattern: fillPattern.optional(),
    angle: z.number().optional().describe("Hatch direction, degrees"),
  }),
]).meta({ id: "fill" });

export const styleSchema = z
  .strictObject({
    color: colorSchema.optional(),
    width: z.number().positive().max(20).optional().describe("Line width, pt"),
    dash: dash.optional(),
    opacity: z.number().min(0).max(1).optional(),
    fill: fillSpec.optional(),
    ticks: z.number().int().min(0).max(3).optional().describe("Equal-length marks on segments, or on angle arcs"),
    arcs: z.number().int().min(1).max(3).optional().describe("Angle arcs"),
    radius: z.number().positive().max(200).optional().describe("Angle arc radius, pt"),
    rightMark: z.boolean().optional().describe("Square on 90° angles"),
    shape: z.enum(["dot", "ring", "none"]).optional().describe("Point mark"),
    size: z.number().positive().max(20).optional().describe("Point radius, pt"),
  })
  .meta({ id: "style", description: "Look. On a polygon, line fields go to its sides and fill to its inside" });

export const labelSchema = z.union([
  z.string().max(LIMITS.labelLength).describe("Plain text"),
  z.strictObject({
    text: z.string().max(LIMITS.labelLength).optional(),
    measure: z
      .union([z.boolean(), z.enum(["length", "angle", "radius", "area", "perimeter"])])
      .optional()
      .describe("Live measure; true picks the usual one (length, angle, radius, area)"),
    decimals: z.number().int().min(0).max(4).optional(),
    prefix: z.string().max(40).optional(),
    suffix: z.string().max(40).optional(),
    angle: z.number().optional().describe("Direction from the object, degrees (0 right, 90 up); omit for automatic"),
    distance: z.number().min(0).max(100).optional().describe("Gap, pt"),
    size: z.number().positive().max(72).optional().describe("Font size, pt"),
    color: colorSchema.optional(),
    font: z.enum(["serif", "sans"]).optional(),
  }),
]).meta({ id: "label" });

/** What a label or style step acts on. */
export const targetSchema = z.union([
  ref.describe("A point name or an `as` name"),
  z.array(ref).min(2).max(3).describe("[A,B] the segment AB; [A,V,B] the angle at V"),
  z.strictObject({ sidesOf: ref.describe("Polygon") }),
  z.strictObject({ anglesOf: ref.describe("Polygon") }),
  z.strictObject({
    all: z.enum(["point", "segment", "angle", "circle", "polygon", "function", "text"]),
  }),
]).meta({ id: "target" });

const targets = z.array(targetSchema).min(1).max(100).describe('["A","B"] are points A and B; [["A","B"]] is segment AB');

const asName = z.string().min(1).max(32).meta({ id: "as", description: "Name to refer to what this step makes" });

const common = {
  as: asName.optional(),
  style: styleSchema.optional(),
  label: labelSchema.optional(),
};

const pointSpec = z.union([
  z.strictObject({ name: name.optional(), at: xy }),
  z.strictObject({
    name: name.optional(),
    from: ref,
    length: exact.pipe(z.number().min(0).max(LIMITS.coordinate)),
    angle: z.number().describe("Direction, degrees counterclockwise from +x"),
  }),
]);

const step = z.discriminatedUnion("do", [
  z
    .strictObject({ do: z.literal("points"), points: z.array(pointSpec).min(1).max(200), style: styleSchema.optional() })
    .describe("Free points"),
  z
    .strictObject({ do: z.literal("input"), text: z.string().min(1).max(4000) })
    .describe('GeoSimples input-bar text, like "A=0;0 B=4;0 C=0;3 A-B-C-A"'),
  z
    .strictObject({
      do: z.literal("triangle"),
      points: z.tuple([name, name, name]),
      sides: z.tuple([positive, positive, positive]).optional().describe("|P0P1|, |P1P2|, |P2P0|"),
      base: positive.optional().describe("|P0P1|, with `angles`"),
      angles: z.tuple([positive, positive]).optional().describe("Angles at P0 and P1, degrees, with `base`"),
      at: xy.optional().describe("P0, default [0,0]"),
      rotate: z.number().optional().describe("Direction of P0P1, degrees; default 0, P2 above"),
      ...common,
    })
    .describe("Triangle from three sides, or a base and its two angles. Also makes the polygon, named after its points"),
  z
    .strictObject({
      do: z.literal("regularPolygon"),
      points: z.array(name).min(3).max(24),
      side: positive.optional(),
      radius: positive.optional().describe("Circumradius, instead of side"),
      at: xy.optional().describe("P0, default [0,0]"),
      rotate: z.number().optional().describe("Direction of P0P1, degrees; default 0"),
      ...common,
    })
    .describe("Regular polygon, counterclockwise from P0"),
  z
    .strictObject({ do: z.literal("segment"), points: z.array(ref).min(2).max(200), closed: z.boolean().optional(), ...common })
    .describe("Segments joining the points in order"),
  z
    .strictObject({ do: z.literal("polygon"), points: z.array(ref).min(3).max(200), ...common })
    .describe("Polygon with its sides; named after its points unless `as`"),
  z
    .strictObject({
      do: z.literal("circle"),
      center: ref.optional(),
      radius: positive.optional(),
      through: ref.optional().describe("A point on the circle"),
      tangentTo: pair.optional().describe("A segment the circle touches"),
      circumscribed: z.tuple([ref, ref, ref]).optional().describe("Through three points; the center is made"),
      centerName: name.optional().describe("Name for the made center"),
      arc: z.tuple([z.number(), z.number()]).optional().describe("Only the arc from..to, degrees"),
      sector: z.boolean().optional().describe("Draw the radii to the arc's ends"),
      ends: z.tuple([name, name]).optional().describe("Names for the arc's start and end points, with sector"),
      ...common,
    })
    .describe("Circle by center + radius | through | tangentTo, or circumscribed"),
  z
    .strictObject({ do: z.literal("angle"), points: z.tuple([ref, ref, ref]), reflex: z.boolean().optional(), ...common })
    .describe("Angle mark at the middle point"),
  z
    .strictObject({ do: z.literal("angles"), of: ref.describe("Polygon"), ...common })
    .describe("All interior angles of a polygon"),
  z
    .strictObject({ do: z.literal("text"), at: xy, text: z.string().min(1).max(LIMITS.labelLength), as: common.as, style: styleSchema.optional() })
    .describe("Free text centered at a point"),
  z.strictObject({ do: z.literal("midpoint"), of: pair, name: name.optional(), ...common }),
  z
    .strictObject({ do: z.literal("altitude"), from: ref, to: pair, foot: name.optional(), ...common })
    .describe("Height from a vertex to the line of a side, with the foot and its right-angle mark"),
  z
    .strictObject({ do: z.literal("projection"), point: ref, onto: pair, foot: name.optional(), ...common })
    .describe("Dashed perpendicular from a point to a line"),
  z.strictObject({ do: z.literal("median"), from: ref, to: pair, midpoint: name.optional(), ...common }),
  z
    .strictObject({ do: z.literal("bisector"), angle: z.tuple([ref, ref, ref]), end: name.optional(), ...common })
    .describe("Angle bisector at the middle point; ends on the opposite side in a triangle"),
  z
    .strictObject({
      do: z.literal("perpendicularBisector"),
      of: pair,
      midpoint: name.optional(),
      rightMark: z.boolean().optional(),
      ...common,
    })
    .describe("Mediatriz"),
  z
    .strictObject({
      do: z.literal("intersection"),
      of: z.tuple([z.union([ref, pair]), z.union([ref, pair])]).describe("Two of: segment [A,B], circle, function, vline"),
      names: z.array(name).max(12).optional().describe("For the crossings, in order"),
      style: styleSchema.optional(),
    })
    .describe("Points where two curves cross"),
  z
    .strictObject({
      do: z.literal("function"),
      expr: z.string().min(1).max(200).describe('y = expr, like "x^2 - 1" or "2sen(x)"'),
      name: name.optional().describe("Default f, g, h…"),
      domain: interval.optional(),
      range: interval.optional().describe("y cut"),
      ends: z.tuple([z.enum(["none", "closed", "open"]), z.enum(["none", "closed", "open"])]).optional(),
      style: styleSchema.optional(),
      as: asName.optional(),
    })
    .describe("Graph of y = f(x); adds axes when there are none"),
  z.strictObject({ do: z.literal("vline"), x: coord, range: interval.optional(), ...common }).describe("x = a, dashed"),
  z
    .strictObject({
      do: z.literal("axes"),
      x: interval.optional(),
      y: interval.optional(),
      step: positive.optional(),
      yStep: positive.optional(),
      xPi: positive.optional().describe("x ticks every xPi·π"),
      unit: z.tuple([positive, positive]).optional().describe("cm per unit on x and y"),
      numbers: z.boolean().optional(),
      names: z.tuple([z.string().max(20), z.string().max(20)]).optional(),
      style: styleSchema.optional(),
    })
    .describe("Axes; they fit the figure unless x or y is given"),
  z
    .strictObject({ do: z.literal("grid"), step: positive.optional(), style: styleSchema.optional() })
    .describe("Square grid (malha) behind the figure"),
  z
    .strictObject({
      do: z.literal("numberline"),
      x: interval.optional(),
      step: positive.optional(),
      numbers: z.boolean().optional(),
      style: styleSchema.optional(),
    })
    .describe("Number line"),
  z
    .strictObject({
      do: z.literal("interval"),
      from: coord.nullable().describe("null for -∞"),
      to: coord.nullable().describe("null for +∞"),
      closed: z.tuple([z.boolean(), z.boolean()]),
      style: styleSchema.optional(),
    })
    .describe("Interval on the number line"),
  z
    .strictObject({ do: z.literal("pointOnGraph"), graph: ref, x: coord, name: name.optional(), style: styleSchema.optional(), label: labelSchema.optional() })
    .describe("(x, f(x))"),
  z
    .strictObject({
      do: z.literal("notable"),
      graph: ref,
      feature: z.enum(["root", "extremum", "yAxis"]),
      names: z.array(name).max(12).optional().describe("Default x₁, x₂… and V"),
      style: styleSchema.optional(),
    })
    .describe("Roots, max/min or y-axis crossing of a graph"),
  z
    .strictObject({
      do: z.literal("tangent"),
      point: ref.describe("A point on a graph"),
      length: positive.optional(),
      fill: z.boolean().optional().describe("Span the axes' window"),
      ...common,
    })
    .describe("Tangent to a graph"),
  z
    .strictObject({ do: z.literal("guides"), points: z.array(ref).min(1).max(50) })
    .describe("Dashed lines from points to the axes"),
  z
    .strictObject({
      do: z.literal("label"),
      targets,
      text: z.string().max(LIMITS.labelLength).optional(),
      scheme: z
        .enum(["latin", "latin-lower", "greek", "numbered", "coordinates", "opposite"])
        .optional()
        .describe("opposite: side BC of triangle ABC is a"),
      label: labelSchema.optional().describe("Text or measure, with placement and look"),
      remove: z.boolean().optional(),
    })
    .describe("Label things made earlier"),
  z
    .strictObject({ do: z.literal("style"), targets, style: styleSchema })
    .describe("Restyle things made earlier"),
  z
    .strictObject({
      do: z.literal("vector"),
      name: name.optional().describe("Default u, v, w…"),
      from: ref.optional().describe("Point at the tail"),
      to: ref.optional().describe("Point at the tip"),
      components: xy.optional().describe("(x, y) of the vector, instead of `to`"),
      at: xy.optional().describe("Tail, when it isn't a point; default the origin"),
      notation: z.enum(["arrow", "hat", "none"]).optional().describe("Mark over its name"),
      style: styleSchema.optional(),
      as: asName.optional(),
    })
    .describe("An arrow, by two points or by its components"),
  z
    .strictObject({
      do: z.literal("vectorOp"),
      op: z.enum(["sum", "parallelogram", "difference", "projection", "unit", "components", "scale"]),
      vectors: z.array(ref).min(1).max(12).describe("In order: difference is first − second; projection is first on second"),
      k: z.number().optional().describe("Factor for scale; default 2"),
      as: asName.optional(),
    })
    .describe("Build on vectors. They follow when the originals move"),
  z.strictObject({ do: z.literal("basis") }).describe("The versors i and j from the origin"),
  z
    .strictObject({ do: z.literal("venn"), sets: z.array(name).min(1).max(3).describe('Default names are ["A","B"]') })
    .describe("A Venn diagram inside a rectangle U"),
  z
    .strictObject({ do: z.literal("region"), expr: z.string().min(1).max(100).describe("Like (A∪B)'∩C, A−B, A'"), style: styleSchema.optional() })
    .describe("Shade part of the Venn diagram"),
  z
    .strictObject({ do: z.literal("members"), set: name.describe("U for what is in no set"), items: z.array(z.string().min(1).max(40)).max(60) })
    .describe("Write a set's elements in the diagram; each goes where its sets overlap"),
  z
    .strictObject({ do: z.literal("count"), expr: z.string().min(1).max(100).describe("One region, like A∩B or A−B"), value: z.string().min(1).max(20) })
    .describe("Write how many elements one region has"),
  z
    .strictObject({
      do: z.literal("board"),
      source: z.string().min(1).max(200).describe('Like "1234÷5", "12,5+3", "7x8", "fatorar 360", "mmc(12;18)", "mdc(12;18)", "euclides(48;18)", "varal [1;3] ∩ ]2;5[", "sinal x²-4", "quadro (x-1)/(x+2)", "modular |x-1|=3"'),
      show: z.enum(["full", "blank", "gaps"]).optional().describe("blank: only the setup, to solve; gaps: some results as empty boxes"),
      method: z.enum(["long", "short"]).optional().describe("Division: write each subtraction, or only the remainders"),
      places: z.number().int().min(0).max(6).optional().describe("Division: decimal places of the quotient"),
      marks: z.boolean().optional().describe("Carries and borrows; default true"),
      at: xy.optional().describe("Top left corner; default under what is drawn"),
      size: z.number().min(6).max(40).optional().describe("Font size, pt"),
    })
    .describe("A worked layout: columns, long division, factoring, MMC, MDC, sign charts"),
]);

export const recipeSchema = z.strictObject({
  v: z.literal(1),
  locale: z
    .enum(["pt-BR", "en"])
    .optional()
    .describe('Language of the figure numbers: "pt-BR" (default) writes 2,5 and (1; 2), "en" writes 2.5 and (1, 2)'),
  defaults: z
    .strictObject({
      stroke: styleSchema.pick({ color: true, width: true, dash: true, opacity: true }).optional(),
      point: styleSchema.pick({ color: true, shape: true, size: true }).optional(),
      fill: fillSpec.optional().describe("Fill for new polygons and filled circles"),
      polygonFilled: z.boolean().optional().describe("New polygons start filled; default false, or true when defaults has a fill"),
      angle: styleSchema.pick({ radius: true, arcs: true, rightMark: true }).optional(),
      label: z
        .strictObject({
          size: z.number().positive().max(72).optional(),
          color: colorSchema.optional(),
          font: z.enum(["serif", "sans"]).optional(),
          distance: z.number().min(0).max(100).optional(),
        })
        .optional(),
    })
    .optional()
    .describe("Look of everything new, like a settings profile"),
  steps: z.array(step).min(1).max(500),
});

export type Recipe = z.infer<typeof recipeSchema>;
/** A recipe as written, before exact values like "2π" become numbers. */
export type RecipeInput = z.input<typeof recipeSchema>;
export type RecipeStep = Recipe["steps"][number];
export type StepOf<K extends RecipeStep["do"]> = Extract<RecipeStep, { do: K }>;
export type StylePatch = z.infer<typeof styleSchema>;
export type LabelSpec = z.infer<typeof labelSchema>;
export type Target = z.infer<typeof targetSchema>;
export type RecipeDefaults = NonNullable<Recipe["defaults"]>;
