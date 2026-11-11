import { decodeShareToken, shareTokenFromHash } from "@geosimples/core/figure";
import { GUIDE } from "@geosimples/core/recipe";
import { describe, expect, it } from "vitest";
import { handle, type Env } from "./index";
import { FIGURE_META, VIEW_URI } from "./view";

const VERSION = "2025-06-18";

function request(body: unknown, init: { path?: string; method?: string; raw?: string } = {}): Request {
  return new Request(`https://mcp.test${init.path ?? "/mcp"}`, {
    method: init.method ?? "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": VERSION,
    },
    body: init.raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}

/** The JSON-RPC message in a response, sent as JSON or as one SSE event. */
async function message(response: Response): Promise<any> {
  const text = await response.text();
  if (!text.startsWith("event:") && !text.startsWith("data:")) return JSON.parse(text);
  const data = text.split("\n").find((l) => l.startsWith("data:"));
  return JSON.parse(data!.slice(5));
}

let id = 0;
async function rpc(method: string, params: unknown, env: Env = {}) {
  const response = await handle(request({ jsonrpc: "2.0", id: ++id, method, params }), env);
  expect(response.status).toBe(200);
  return message(response);
}

const call = async (name: string, args: unknown) => (await rpc("tools/call", { name, arguments: args })).result;
const texts = (result: { content: { type: string; text: string }[] }) => result.content.map((c) => c.text);

const PYTHAGOREAN = GUIDE.overview.examples[0].recipe;

describe("MCP over HTTP", () => {
  it("introduces itself and points agents to the guide", async () => {
    const r = await rpc("initialize", { protocolVersion: VERSION, capabilities: {}, clientInfo: { name: "test", version: "1" } });
    expect(r.result.serverInfo).toMatchObject({ name: "geosimples", title: "GeoSimples" });
    expect(r.result.instructions).toContain("get_reference");
  });

  it("lists three read-only tools with a compact recipe schema", async () => {
    const { tools } = (await rpc("tools/list", {})).result;
    expect(tools.map((t: { name: string }) => t.name)).toEqual(["draw_figure", "render_doc", "get_reference"]);
    for (const t of tools) {
      expect(t.title).toBeTruthy();
      expect(t.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    }
    const schema = JSON.stringify(tools[0].inputSchema);
    expect(schema).toContain('"locale"');
    // About 6,5k tokens: the schema loads into every conversation with the connector on. Circuits took it past 26 000.
    expect(schema.length).toBeLessThan(27500);
  });

  it("draws the Pythagorean triangle as SVG with an editor link that opens the same figure", async () => {
    const result = await call("draw_figure", { recipe: PYTHAGOREAN, output: ["svg", "link", "doc"], name: "Pitágoras" });
    expect(result.isError).toBeFalsy();
    const [summary, svg, link, doc] = texts(result);
    expect(summary).toMatch(/^Figure built with \d+ elements\.$/);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("2,4");
    expect(link).toMatch(/^\[Abrir no GeoSimples\]\(https:\/\/geosimples\.vercel\.app\/#figura=[\w-]+\)$/);
    const opened = await decodeShareToken(shareTokenFromHash(link.slice(link.indexOf("#"), -1))!, "x");
    expect(opened.ok && opened.file.name).toBe("Pitágoras");
    expect(opened.ok && opened.file.doc).toEqual(JSON.parse(doc));
  });

  it("writes TikZ and a standalone .tex file", async () => {
    const [, tikz, tex] = texts(await call("draw_figure", { recipe: PYTHAGOREAN, output: ["tikz", "tex"] }));
    expect(tikz).toMatch(/^\begin\{tikzpicture\}|^%/);
    expect(tex).toContain("\documentclass[border=2pt]{standalone}");
  });

  it("explains a failing step in English", async () => {
    const result = await call("draw_figure", {
      recipe: { v: 1, steps: [{ do: "points", points: [{ name: "A", at: [0, 0] }] }, { do: "segment", points: ["A", "Z"] }] },
    });
    expect(result.isError).toBe(true);
    expect(texts(result)[0]).toContain("step 1 [unknown_name]");
  });

  it("rejects input that doesn't match the schema", async () => {
    const result = await call("draw_figure", { recipe: { v: 1, steps: [{ do: "teleport" }] } });
    expect(result.isError).toBe(true);
  });

  it("builds on a figure from a share link, and exports one", async () => {
    const first = texts(await call("draw_figure", { recipe: PYTHAGOREAN, output: ["link"] }))[1];
    // Agents pass the link back as it came, in markdown.
    const link = first;
    const more = await call("draw_figure", {
      from: link,
      recipe: { v: 1, steps: [{ do: "circle", center: "H", radius: 1 }] },
      output: ["doc"],
    });
    expect(more.isError).toBeFalsy();
    expect(JSON.parse(texts(more)[1]).elements.some((e: { type: string }) => e.type === "circle")).toBe(true);

    const exported = await call("render_doc", { doc: link, output: ["svg"] });
    expect(texts(exported)[0]).toMatch(/^<svg /);
    const broken = await call("render_doc", { doc: "https://geosimples.vercel.app/#figura=@@@" });
    expect(broken.isError).toBe(true);
  });

  it("returns the guide", async () => {
    const [all] = texts(await call("get_reference", {}));
    const [labels] = texts(await call("get_reference", { topic: "labels" }));
    expect(all).toContain("How recipes work");
    expect(labels.length).toBeLessThan(all.length);
  });
});

describe("the Worker around it", () => {
  it("answers / with how to connect, and 404 elsewhere", async () => {
    const about = await handle(new Request("https://mcp.test/"), {});
    expect(await about.text()).toContain("/mcp");
    expect((await handle(new Request("https://mcp.test/nope"), {})).status).toBe(404);
  });

  it("allows browser clients", async () => {
    const pre = await handle(new Request("https://mcp.test/mcp", { method: "OPTIONS" }), {});
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("refuses oversized bodies before parsing them", async () => {
    const big = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { pad: "x".repeat(600 * 1024) } });
    const r = await handle(request(undefined, { raw: big }), {});
    expect(r.status).toBe(413);
  });

  it("answers 429 when the client is over its rate", async () => {
    const env: Env = { LIMITER: { limit: async () => ({ success: false }) } as unknown as RateLimit };
    const r = await handle(request({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }), env);
    expect(r.status).toBe(429);
  });

  it("links to the configured editor", async () => {
    const env: Env = { SITE_URL: "https://geo.dandes.dev/" };
    const r = await message(
      await handle(request({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "draw_figure", arguments: { recipe: PYTHAGOREAN, output: ["link"] } } }), env),
    );
    expect(r.result.content[1].text).toContain("https://geo.dandes.dev/#figura=");
  });
});

describe("figure preview (MCP App)", () => {
  it("links the drawing tools to a ui:// view that hosts can read", async () => {
    const { tools } = (await rpc("tools/list", {})).result;
    const byName = Object.fromEntries(tools.map((t: { name: string }) => [t.name, t]));
    expect(byName.draw_figure._meta).toEqual({ ui: { resourceUri: VIEW_URI } });
    expect(byName.render_doc._meta).toEqual({ ui: { resourceUri: VIEW_URI } });
    expect(byName.get_reference._meta).toBeUndefined();
    const listed = (await rpc("resources/list", {})).result.resources;
    expect(listed).toContainEqual(expect.objectContaining({ uri: VIEW_URI, mimeType: "text/html;profile=mcp-app" }));
    const [content] = (await rpc("resources/read", { uri: VIEW_URI })).result.contents;
    expect(content).toMatchObject({ uri: VIEW_URI, mimeType: "text/html;profile=mcp-app" });
    expect(content.text).toContain('"ui/initialize"');
    expect(content.text).toContain("Copiar TikZ");
  });

  it("hands the view the figure whatever outputs the agent asked for, and nothing on an error", async () => {
    const result = await call("draw_figure", { recipe: PYTHAGOREAN, output: ["link"], name: "Pitágoras" });
    const figure = result._meta[FIGURE_META];
    expect(figure.name).toBe("Pitágoras");
    expect(figure.svg).toMatch(/^<svg /);
    expect(figure.tikz).toContain(String.raw`\begin{tikzpicture}`);
    expect(figure.link).toMatch(/^https:\/\/geosimples\.vercel\.app\/#figura=/);
    // What the model reads stays as asked: no SVG it didn't want.
    expect(texts(result).some((t) => t.startsWith("<svg"))).toBe(false);
    const failed = await call("draw_figure", { recipe: { v: 1, steps: [{ do: "segment", points: ["A", "Z"] }] } });
    expect(failed.isError).toBe(true);
    expect(failed._meta?.[FIGURE_META]).toBeUndefined();
  });
});
