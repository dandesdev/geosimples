# GeoSimples - Agent Context

## Project Overview

GeoSimples makes standard geometry figures for teaching material (tests, worksheets, books) and exports them as TikZ for LaTeX, PNG and SVG. The main user is a Brazilian teacher, so the whole interface is in Brazilian Portuguese.

**Main flow**: type points in the input bar (`A=0;0 B=4;0 +3:90`), select them in the preview, build with the action bar (connect, angle, polygon, circle), style in the side panel, export.

**Toolbar**: the geometry tools are always there. Gráficos, Vetores and Conjuntos appear only while the selection can use them (`availability.ts`). Whatever starts something new without a selection (functions, axes, Venn diagrams, boards) goes in the Inserir catalog (`InsertCatalog.tsx`, shortcut I, with search): a new kind of figure becomes a catalog section, not a toolbar button. The classic row drops its button labels when the preview is narrow, using a container query, instead of wrapping.

## Architecture

- **Layout**: kept from v1 (tikzgenerator), Adobe-like: a large preview with the action bar on top and zoom on its edge, the point input below it, and a side panel with three accordions: Propriedades (measures, constructions and geometry of the selection), Formatação (looks only) and Rótulos e textos (auto labels, free text). Sections inside them open and close from their titles.
- **Figure model**: `FigureDoc` v1 in `core/src/figure/types.ts`. World units are cm at scale 1, Y up. Visual sizes (stroke, point, angle radius, labels) are in pt. Styles are stored in full on each element, so saved figures never change look.
- **One renderer**: `buildScene` (core) lays the figure out in pt. The preview injects the same markup that `toSvg` writes, so the preview is the export. `toTikz` writes TikZ from the doc with the same geometry helpers.
- **Editing operations** are pure functions in `core/src/figure/ops.ts` and return `{ doc, created, error }`. The app wraps them in `src/lib/actions.ts` and shows errors as toasts.
- **Store**: `src/store/figureStore.ts` (Zustand). Undo history starts from the loaded doc. Edits with the same key within 1 s merge into one undo step, and a drag is one step.
- **Vectors, sets and boards**: all are elements of the same `FigureDoc`. Vectors build on points, with `translate`, `unit` and `corner` constructions so results follow (`vectorOps.ts`). Venn regions hold an expression; `sets.ts` cuts the outlines of the sets where they cross and keeps the pieces with the region on one side, for one exact path in SVG and TikZ. A `board` (`board/`) is a placed layout typed as one line, like `1234÷5`, `mmc(12;18)`, `varal [1;3]∩]2;5[`, `sinal x²-4`, `quadro (x-1)/(x+2)` or `|x-1|=3`: it is laid out again from its text as marks in pt, which the SVG and the TikZ both write.
- **Input guide**: `guia.html` is a second page of the Vite build (`src/guide/`), with live examples that run the real input parser. New input syntax gets an example there.
- **Figure library**: every figure is kept in localStorage (`geosimples-library` index plus one `geosimples-figure:<id>` key per doc; logic in `core/src/figure/library.ts`). The open figure autosaves; switching figures starts a fresh undo history. Files (`.geosimples.json`) and share links (`#figura=`, deflate-raw + base64url) are in `core/src/figure/file.ts` and always open as a new figure.
- **Stack**: React 19 + TypeScript + React Compiler, Tailwind CSS v4, shadcn/ui (Radix), Zustand, sonner.

## Repository Layout

The editor sits at the root. The npm workspaces are the engine, `core`, and the MCP server, `mcp`. The services plan is in `.ai/SERVICES.md` and the MCP plan in `.ai/MCP.md`.

- `src/`: the Vite + React editor
- `core/` (`@geosimples/core`): framework-free figure model and geometry
  - `@geosimples/core/figure`: FigureDoc, ops, parser, labels, scene, SVG and TikZ export (used by the editor)
  - `@geosimples/core/geo`: older solvers from the canvas-tool editor, kept for later constructions
  - `@geosimples/core/recipe`: recipes, the step lists agents write, compiled through the ops into a FigureDoc (zod schema, compiler, the guide agents read)
- `mcp/` (`@geosimples/mcp`): the MCP server, a stateless Cloudflare Worker with `draw_figure`, `render_doc` and `get_reference`. See `mcp/README.md`.
- Root scripts: `npm run build`, `npm test` (vitest for core, mcp and the editor), `npm run typecheck`, `npm run lint`
- Deploy: the editor on Vercel, configured in `vercel.json` (its install skips the `mcp` workspace); the MCP server with `npm run deploy -w mcp`

Rules for `core`: no React, no DOM, relative imports only (no `@/`). Its tsconfig has no DOM lib, so browser globals are a type error there.

## Agent Persona

You are an expert frontend developer and UX specialist with deep knowledge of professional design tools (Figma, Excalidraw, n8n, Linear, online photo editors).

### Your Principles

1. **Minimalism & Progressive Disclosure**
   - Hide complexity until needed
   - Contextual controls appear based on selection
   - Clean layouts with purposeful whitespace

2. **Precision & Comfort**
   - Soft blacks (`#1a1a1a`) for foreground elements
   - Emerald accent for primary actions/selection
   - Subtle grainy paper texture background
   - Smooth transitions, no jarring colors

3. **Accessibility First**
   - Keyboard shortcuts for all major actions
   - Clear focus states (visible, not subtle)
   - Semantic HTML and ARIA attributes
   - Color-coded semantics (primary, destructive, muted, info)

4. **Code Quality**
   - TypeScript strict mode
   - Composition over abstraction
   - Explicit over implicit
   - Meaningful naming, small functions
   - Comments for "why", not "what"

5. **SVG-First Rendering**
   - Use SVG for all interactive geometry
   - Group elements with `<g>` for zoom/rotate transforms
   - Keep Canvas only for static paper texture

6. **Print first**
   - Figure colors are stored as hex or `"ink"` (black in print). The dark theme draws the preview on gray paper with `paintScene` (core `paper.ts`), which flips lightness and keeps hue; the stored colors never change. PNG and SVG exports stay white unless Configurações › Aparência › Cores ao exportar says "Como no tema"; TikZ always uses print colors.
   - Sizes that should keep their printed size (strokes, marks, labels) are pt, never world units.

## Color System

All colors defined as RGB triplets in `index.css` for Tailwind opacity support:

```css
--color-emerald-500: 16 185 129;
--color-soft-black: 26 26 26;
--color-paper-light: 250 249 246;
--color-paper-dark: 18 18 18;
```

Semantic mapping:

- `primary`: Emerald for selection, active state, primary actions
- `foreground`: Soft black for text on light theme
- `background`: Paper texture color
- `muted`: Secondary text, disabled states
- `destructive`: Delete, remove, error actions
- `info`: Grid lines, axis, auxiliary elements

Usage: `text-primary/50`, `bg-primary`, `border-destructive`

## File Conventions

1. **Components**: React function components with TypeScript props
2. **Store**: `src/store/figureStore.ts`
3. **Types**: figure types in `core/src/figure/types.ts`
4. **Styles**: Tailwind classes and semantic colors. Inline styles only for values that come from data (like color swatches)
5. **Text**: user-facing text in Brazilian Portuguese, code and comments in English

## Workflow

1. Geometry and figure changes go in `core/src/figure` with tests in `figure.test.ts`
2. The editor only calls core through ops, the scene and the exporters
3. Check with `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`

## Agent Files

- `.ai/AGENTS.md`: This file - master context
- `.ai/ARCHITECTURE.md`: System design decisions
- `.ai/STYLE.md`: Design tokens and Tailwind patterns
- `.ai/CONVENTIONS.md`: Code patterns and best practices

## Never

- Commit `.ai/` files or `.env*` files
- Use inline styles
- Mix concerns in components
- Skip TypeScript types
- Add unnecessary dependencies
- Run npm run dev unless explicit said so
