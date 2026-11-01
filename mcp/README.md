# GeoSimples MCP

An MCP server that lets agents (Claude and others) draw GeoSimples figures. The agent writes a recipe of steps (triangle, altitude, angles, label…), and the server compiles it with `@geosimples/core/recipe` through the editor's own operations, then returns SVG, TikZ, a standalone `.tex` file, an editor link or the figure JSON.

It is a stateless Cloudflare Worker: no storage, no sign-in, every tool read-only.

## Tools

- `draw_figure(recipe, output?, from?, name?, scale?)`: build a figure. `from` is a figure to build on (JSON or a share link).
- `render_doc(doc, output?, name?, scale?)`: export a figure that already exists.
- `get_reference(topic?)`: the recipe guide with examples, from `core/src/recipe/guide.ts`.

## Develop

```sh
npm test -w mcp          # tool and HTTP tests (Node)
npm run typecheck -w mcp
npm run dev -w mcp       # wrangler dev on http://localhost:8787/mcp
```

## Deploy

On a Cloudflare account on the Workers Free plan with no card on file, so going past the daily free requests returns errors instead of a bill.

```sh
npx wrangler login       # once
npm run deploy -w mcp
```

`wrangler.jsonc` attaches the custom domain `mcp.dandes.dev` (the `dandes.dev` zone must be on the same account) and keeps the `*.workers.dev` address for testing. A rate limit of 300 requests per minute per IP and Cloudflare location stops a single client; it is generous because claude.ai calls from a few shared addresses.

## Connect

- Claude (web, desktop, mobile): Settings › Connectors › Add custom connector, URL `https://mcp.dandes.dev/mcp`, no authentication.
- Claude Code: `claude mcp add --transport http geosimples https://mcp.dandes.dev/mcp`
