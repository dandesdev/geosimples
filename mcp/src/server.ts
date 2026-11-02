import { McpServer } from "@modelcontextprotocol/server";
import { DEFAULT_SITE, drawFigure, drawFigureInput, reference, referenceInput, renderDoc, renderDocInput } from "./tools";

export const SERVER_VERSION = "0.1.0";

const INSTRUCTIONS = `GeoSimples draws school geometry figures and function graphs for teaching material (tests, worksheets, books) and returns SVG, TikZ for LaTeX, or a link to the GeoSimples editor.

Before your first draw_figure call, read get_reference (topic "overview", then the topic you need): it explains recipes and has worked examples. Describe the figure as a recipe of steps; the server computes every coordinate, construction and mark. Don't compute constructed points yourself.

Give the user the output they asked for, and the editor link so they can adjust the figure. Show the link exactly as it comes, a markdown link [Abrir no GeoSimples](…), never as a bare URL: the URL holds the whole figure and is long. When SVG or TikZ is long, give it as a file or code block exactly as returned.`;

/** One fresh server per request: the handler is stateless. */
export function createServer(site: string = DEFAULT_SITE): McpServer {
  const server = new McpServer(
    { name: "geosimples", title: "GeoSimples", version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "draw_figure",
    {
      title: "Draw a figure",
      description:
        "Build a geometry figure or graph from a recipe (steps like triangle, altitude, angles, circle, function, axes, label, style) and return it as SVG, TikZ, a .tex file, an editor link or JSON. Read get_reference first.",
      inputSchema: drawFigureInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) => drawFigure(args, site),
  );

  server.registerTool(
    "render_doc",
    {
      title: "Export a saved figure",
      description:
        "Export an existing GeoSimples figure (FigureDoc JSON from a doc output or a .geosimples.json file, or a share link) as SVG, TikZ, a .tex file or an editor link.",
      inputSchema: renderDocInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) => renderDoc(args, site),
  );

  server.registerTool(
    "get_reference",
    {
      title: "Recipe guide",
      description: "The guide to writing draw_figure recipes, with worked examples. Read it before drawing.",
      inputSchema: referenceInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) => reference(args),
  );

  return server;
}
