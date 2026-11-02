import {
  decodeShareToken,
  encodeShareToken,
  normalizeDoc,
  parseFigureFile,
  shareTokenFromHash,
  shareUrl,
  toSvg,
  toTikz,
  type FigureDoc,
} from "@geosimples/core/figure";
import {
  compileRecipe,
  GUIDE_TOPIC_NAMES,
  guideText,
  recipeSchema,
  type GuideTopicName,
  type RecipeIssue,
} from "@geosimples/core/recipe";
import { z } from "zod";
import { FIGURE_META, type ViewFigure } from "./view";

/** Where "Abrir no GeoSimples" links point. */
export const DEFAULT_SITE = "https://geosimples.vercel.app/";

export const OUTPUTS = ["svg", "tikz", "tex", "link", "doc"] as const;
export type Output = (typeof OUTPUTS)[number];

const outputSchema = z
  .array(z.enum(OUTPUTS))
  .min(1)
  .max(OUTPUTS.length)
  .optional()
  .describe(
    'What to return; default ["svg", "link"]. svg: SVG code. tikz: a tikzpicture to paste. tex: a standalone .tex file. link: a markdown link that opens the figure in the GeoSimples editor. doc: the figure as JSON, to edit later with "from" or render_doc.',
  );

const scaleSchema = z.number().min(0.1).max(5).optional().describe("cm per unit when exported; default 1");

/** A saved figure: the JSON from a .geosimples.json file or a doc output. */
const docSchema = z
  .looseObject({ kind: z.literal("geo").optional(), elements: z.array(z.unknown()) })
  .describe("A GeoSimples figure (FigureDoc JSON), as returned in a doc output or saved in a .geosimples.json file");

const fromSchema = z
  .union([docSchema, z.string().max(20000).describe("A GeoSimples share link (…#figura=…)")])
  .optional()
  .describe("An existing figure to build on: its named points, graphs and polygons can be used in the steps");

export const drawFigureInput = z.strictObject({
  recipe: recipeSchema,
  output: outputSchema,
  from: fromSchema,
  name: z.string().max(80).optional().describe('Name of the figure in the editor\'s library; default "Figura"'),
  scale: scaleSchema,
});

export const renderDocInput = z.strictObject({
  doc: z.union([docSchema, z.string().max(20000).describe("A GeoSimples share link (…#figura=…)")]),
  output: outputSchema,
  name: z.string().max(80).optional(),
  scale: scaleSchema,
});

export const referenceInput = z.strictObject({
  topic: z
    .enum(GUIDE_TOPIC_NAMES)
    .optional()
    .describe("One topic, or all of them when omitted. overview first; the others hold the step kinds with examples."),
});

type Text = { type: "text"; text: string };
export interface ToolResult {
  [key: string]: unknown;
  content: Text[];
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

const text = (t: string): Text => ({ type: "text", text: t });

function issueLine(issue: RecipeIssue): string {
  const where = issue.step === null ? "recipe" : `step ${issue.step}`;
  return `- ${where} [${issue.code}]: ${issue.message}`;
}

/** Reads `from` / `doc`: a FigureDoc object, or a share link, bare or as the markdown link a link output gives. */
async function readFigure(value: unknown, fallbackName: string): Promise<{ doc: FigureDoc; name: string } | { error: string }> {
  if (typeof value !== "string") return { doc: normalizeDoc(value), name: fallbackName };
  const link = value.match(/\]\((\S+)\)\s*$/)?.[1] ?? value;
  const hash = link.includes("#") ? link.slice(link.indexOf("#")) : link;
  const token = shareTokenFromHash(hash) ?? (link.trim().startsWith("{") ? null : link.trim());
  if (!token) {
    const parsed = parseFigureFile(link, fallbackName);
    return parsed.ok ? { doc: parsed.file.doc, name: parsed.file.name } : { error: "Not a GeoSimples figure or share link." };
  }
  const parsed = await decodeShareToken(token, fallbackName);
  return parsed.ok ? { doc: parsed.file.doc, name: parsed.file.name } : { error: "The share link is incomplete or damaged." };
}

/** The requested outputs of a figure, one text block each. */
async function outputs(doc: FigureDoc, wanted: readonly Output[], name: string, scale: number | undefined, site: string): Promise<Text[]> {
  const blocks: Text[] = [];
  for (const kind of new Set(wanted)) {
    switch (kind) {
      case "svg":
        blocks.push(text(toSvg(doc, { scale, background: "#ffffff" })));
        break;
      case "tikz":
        blocks.push(text(toTikz(doc, { scale })));
        break;
      case "tex":
        blocks.push(text(toTikz(doc, { scale, standalone: true })));
        break;
      case "link":
        blocks.push(text(`[Abrir no GeoSimples](${shareUrl(site, await encodeShareToken({ name, doc }))})`));
        break;
      case "doc":
        blocks.push(text(JSON.stringify(doc)));
        break;
    }
  }
  return blocks;
}

const DEFAULT_OUTPUT: Output[] = ["svg", "link"];

/** The figure for the preview hosts show: SVG, TikZ and the editor link, whatever outputs were asked for. */
async function viewMeta(doc: FigureDoc, name: string, scale: number | undefined, site: string): Promise<Record<string, unknown>> {
  const figure: ViewFigure = {
    name,
    svg: toSvg(doc, { scale, background: "#ffffff" }),
    tikz: toTikz(doc, { scale }),
    link: shareUrl(site, await encodeShareToken({ name, doc })),
  };
  return { [FIGURE_META]: figure };
}

export async function drawFigure(args: z.infer<typeof drawFigureInput>, site = DEFAULT_SITE): Promise<ToolResult> {
  const name = args.name?.trim() || "Figura";
  let base: FigureDoc | undefined;
  if (args.from !== undefined) {
    const read = await readFigure(args.from, name);
    if ("error" in read) return { isError: true, content: [text(`from: ${read.error}`)] };
    base = read.doc;
  }
  const result = compileRecipe(args.recipe, { base });
  if (!result.ok) {
    return {
      isError: true,
      content: [
        text(
          `The recipe failed, so no figure was made. Fix the step and send the whole recipe again.\n${result.errors.map(issueLine).join("\n")}`,
        ),
      ],
    };
  }
  const summary = [`Figure built with ${result.doc.elements.length} elements.`];
  if (result.warnings.length > 0) summary.push(`Warnings:\n${result.warnings.map(issueLine).join("\n")}`);
  return {
    content: [text(summary.join("\n")), ...(await outputs(result.doc, args.output ?? DEFAULT_OUTPUT, name, args.scale, site))],
    _meta: await viewMeta(result.doc, name, args.scale, site),
  };
}

export async function renderDoc(args: z.infer<typeof renderDocInput>, site = DEFAULT_SITE): Promise<ToolResult> {
  const read = await readFigure(args.doc, args.name?.trim() || "Figura");
  if ("error" in read) return { isError: true, content: [text(`doc: ${read.error}`)] };
  const name = args.name?.trim() || read.name;
  return {
    content: await outputs(read.doc, args.output ?? DEFAULT_OUTPUT, name, args.scale, site),
    _meta: await viewMeta(read.doc, name, args.scale, site),
  };
}

export function reference(args: { topic?: GuideTopicName }): ToolResult {
  return { content: [text(guideText(args.topic))] };
}
