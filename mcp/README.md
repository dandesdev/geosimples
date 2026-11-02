# GeoSimples MCP

An MCP server that lets agents (Claude and others) draw GeoSimples figures. The agent writes a recipe of steps (triangle, altitude, angles, label…), and the server compiles it with `@geosimples/core/recipe` through the editor's own operations, then returns SVG, TikZ, a standalone `.tex` file, an editor link or the figure JSON.

It is a stateless Cloudflare Worker: no storage, no sign-in, every tool read-only.

## Tools

- `draw_figure(recipe, output?, from?, name?, scale?)`: build a figure. `from` is a figure to build on (JSON or a share link).
- `render_doc(doc, output?, name?, scale?)`: export a figure that already exists.
- `get_reference(topic?)`: the recipe guide with examples, from `core/src/recipe/guide.ts`.

## Figure preview (MCP App)

Hosts that support MCP Apps (claude.ai) show the figure under `draw_figure` and `render_doc`, with Copiar SVG, Copiar TikZ, Baixar PNG, Baixar SVG and Abrir no GeoSimples. The view is `ui://geosimples/figure.html` (`src/view.ts`): one self-contained page with no network access. It reads the figure from the result's `_meta["geosimples/figure"]` (name, SVG, TikZ, link), so its buttons work whatever outputs the agent asked for, and what the model reads stays as asked. Other clients get the text content alone. Where the host's sandbox blocks downloads, the view says to use the editor instead.

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

`wrangler.jsonc` attaches the custom domain `geosimples.mcp.dandes.dev` (the `dandes.dev` zone must be on the same account; Cloudflare issues the certificate for the deeper subdomain for free) and keeps the `*.workers.dev` address for testing. Other projects get their own Worker on `<project>.mcp.dandes.dev`; all Workers on the account share the free plan's 100,000 requests a day, and each needs its own rate limit `namespace_id`. A rate limit of 300 requests per minute per IP and Cloudflare location stops a single client; it is generous because claude.ai calls from a few shared addresses.

## Connect

- Claude (web, desktop, mobile): Settings › Connectors › Add custom connector, URL `https://geosimples.mcp.dandes.dev/mcp`, no authentication.
- Claude Code: `claude mcp add --transport http geosimples https://geosimples.mcp.dandes.dev/mcp`
