import { createMcpHandler } from "@modelcontextprotocol/server";
import { createServer, SERVER_VERSION } from "./server";
import { DEFAULT_SITE } from "./tools";

export interface Env {
  /** The editor that "Abrir no GeoSimples" links open. */
  SITE_URL?: string;
  /** Requests per client IP, per Cloudflare location. Absent in tests. */
  LIMITER?: RateLimit;
}

/** Recipes are small; this leaves room for a big figure sent back through render_doc. */
const MAX_BODY = 512 * 1024;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

function withCors(response: Response): Response {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
}

const ABOUT = `GeoSimples MCP ${SERVER_VERSION}

Draws school geometry figures and function graphs as SVG or TikZ.
MCP endpoint: /mcp (streamable HTTP, no sign-in).

Claude: Settings > Connectors > Add custom connector, URL https://geosimples.mcp.dandes.dev/mcp
Claude Code: claude mcp add --transport http geosimples https://geosimples.mcp.dandes.dev/mcp

Editor: https://geosimples.vercel.app
`;

export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (url.pathname === "/" && request.method === "GET") {
    return new Response(ABOUT, { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (url.pathname !== "/mcp") return new Response("Not found. The MCP endpoint is /mcp.", { status: 404 });

  // Generous on purpose: Claude's connectors call from a few shared addresses.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (env.LIMITER && !(await env.LIMITER.limit({ key: ip })).success) {
    return withCors(new Response("Too many requests. Try again in a minute.", { status: 429, headers: { "retry-after": "60" } }));
  }

  const site = env.SITE_URL || DEFAULT_SITE;
  const handler = createMcpHandler(() => createServer(site), { maxRequestBodySize: MAX_BODY, responseMode: "json" });
  return withCors(await handler.fetch(request));
}

export default {
  fetch: (request, env) => handle(request, env),
} satisfies ExportedHandler<Env>;
