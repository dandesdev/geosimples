# GeoSimples - Agent Context

## Project Overview

GeoSimples makes standard geometry figures for teaching material (tests, worksheets, books) and exports them as TikZ for LaTeX, PNG and SVG. The main user is a Brazilian teacher, so the whole interface is in Brazilian Portuguese.

**Main flow**: type points in the input bar (`A=0;0 B=4;0 +3:90`), select them in the preview, build with the action bar (connect, angle, polygon, circle), style in the side panel, export.

**Tools**: every tool is in the Ferramentas panel (`src/components/tools/`), one tab per kind of figure (Geometria, Gráficos, Vetores, Conjuntos, Circuitos, Contas), with what inserts something new and what builds on the selection, as tiles; `areas.ts` lists them, and a new kind of figure becomes a tab there. A tool that starts something typed puts the focus in the input bar with a balloon saying what to type (`inputHintStore.ts`). Inserir (`InsertCatalog.tsx`, shortcut I, with search) keeps everything that needs no selection. The classic layout also keeps its toolbar above the preview, where Gráficos, Vetores and Conjuntos appear only while the selection can use them and Circuito while the figure has a circuit; its row drops button labels on a narrow preview with a container query. The pro layout's left bar holds only file and history, the modes, and Janelas, theme, settings and help at its bottom, in a quieter tone than the modes; Inserir floats on the preview's corner as a round + that spells out its name after the pointer rests on it for 200 ms. The Figura group keeps one height for both its tabs (Prontos scrolls in it), so switching tabs never moves the panels below. In the tools, the area tabs are underlined in the accent, and a tile that can't run now keeps legible text but loses its card for a dashed outline. Phones (`src/components/phone/PhoneLayout.tsx`) are one screen that doesn't scroll: the preview on top, resized by its bottom edge (down to 10% of the screen), the input, modes and hint pinned under it, and the Ferramentas tabs, the only part that scrolls; the rest is in the menu over the preview's corner.

**Phones** (narrower than 640 px, or shorter than 500 px: `phone/PhoneLayout.tsx`, from `App.tsx`): one screen that doesn't scroll as a whole. The preview is flush with the top and sides; until its bottom edge is dragged it is no taller than a 4:3 picture as wide as the screen, nor a third of the screen (`--phone-preview` in `index.css`). An empty figure shows no starting card there: the short preview has no room for it. Pinned under it: Inserir as a plain +, the input bar, the modes and Vários as square tiles of one size that share the row's width, a round "i" switch for the hint at its end, and the hint. The Ferramentas tabs below are the only part that scrolls. The menu button over the preview's corner opens a sheet from the right and seems to turn into an X on the same spot; the panel lies on the sheet itself, not on a card, with the title and its buttons at the left, clear of the X. Configurações opens over the whole screen and closes with a back arrow. Inserir opens over the whole screen, and on any touch screen its search doesn't take the focus, so the keyboard stays down. Dropdown menus open on the tap, not on the press, under a finger (`ui/dropdown-menu.tsx`), so a swipe that starts on a button scrolls.

## Architecture

- **Layout**: kept from v1 (tikzgenerator), Adobe-like: a large preview with zoom on its edge, the point input below it, and a side panel with Figura (the open figure's name and a still picture of it, drawn as the preview draws it by `FigureSnapshot`) and Prontos (figures ready to use) as tabs, the Ferramentas panel, and Propriedades (measures, constructions and geometry of the selection), Formatação (looks only) and Rótulos (auto labels) as tabs. Free text is inserted from Inserir or typed as `texto: Figura 1`.
- **Figure model**: `FigureDoc` v1 in `core/src/figure/types.ts`. World units are cm at scale 1, Y up. Visual sizes (stroke, point, angle radius, labels) are in pt. Styles are stored in full on each element, so saved figures never change look.
- **One renderer**: `buildScene` (core) lays the figure out in pt. The preview injects the same markup that `toSvg` writes, so the preview is the export. `toTikz` writes TikZ from the doc with the same geometry helpers.
- **Editing operations** are pure functions in `core/src/figure/ops.ts` and return `{ doc, created, error }`. The app wraps them in `src/lib/actions.ts` and shows errors as toasts.
- **Store**: `src/store/figureStore.ts` (Zustand). Undo history starts from the loaded doc. Edits with the same key within 1 s merge into one undo step, and a drag is one step.
- **Vectors, sets and boards**: all are elements of the same `FigureDoc`. Vectors build on points, with `translate`, `unit` and `corner` constructions so results follow (`vectorOps.ts`). Venn regions hold an expression; `sets.ts` cuts the outlines of the sets where they cross and keeps the pieces with the region on one side, for one exact path in SVG and TikZ. A `board` (`board/`) is a placed layout typed as one line, like `1234÷5`, `mmc(12;18)`, `varal [1;3]∩]2;5[`, `sinal x²-4`, `quadro (x-1)/(x+2)` or `|x-1|=3`: it is laid out again from its text as marks in pt, which the SVG and the TikZ both write. `sinal`, `quadro` and modules also take inequalities (`board/relation.ts`: the solution set, drawn on the line and written as S). A "gaps" board leaves out the results listed in `gaps` (picked by clicking them in the preview; null draws them by `seed`), as a box, a blank or a text.
- **Circuits**: a `component` (resistor, lamp, source, switch, ideal ammeter and voltmeter, capacitor) sits between two points like a vector, and segments are its wires. Pieces and wires are inserted on their own (`placeComponent`, `placeWire`), between hidden points: dragged whole or by an end, and an end dropped on another end joins it (`joinEnds`, snapping in the preview through `endNear`). `circuit.ts` solves the figure by modified nodal analysis, with no special case for receptors (a source the current runs through backwards), and draws the symbols as board marks in plain TikZ. One `circuit` element per figure holds Ligar circuito (values by each piece, placed off wires and labels) and the current arrows, real or conventional. Ops are in `circuitOps.ts`, including the ready-made circuits (in Prontos) and `tidyJunctions` (dots only where three wires meet).
- **Fills between shapes**: two or more selected circles or polygons can fill their union, intersection, difference or exclusion, like Illustrator's Pathfinder (`fillShapeOperation` in `setOps.ts`): a `region` over those shapes, which follows them and is written as one exact path, as Venn regions are.
- **Input guide**: `guia.html` is a second page of the Vite build (`src/guide/`), with live examples that run the real input parser, drawn as the preview draws them (theme paper and `PreviewGrid`), with numbered axes where coordinates matter. An example that needs something not typed says so: `before` (what was in the figure and where it is inserted from) and `after` (what is done next by selecting and tapping). New input syntax gets an example there.
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

Usage: `text-primary/50`, `bg-primary`, `border-destructive`. The default border color is set only in `@layer base`: a rule outside the layers would beat every `border-*` color utility.

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
