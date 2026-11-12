import { INK, isValidColor, PT_PER_CM } from "./defaults";
import { gridWindow } from "./fit";
import {
  angleArc,
  angleArcRadii,
  angleTicks,
  extensionEnds,
  pointMap,
  rightAngleSquare,
  segmentTicks,
  type OffsetLine,
} from "./geometry";
import { canHaveLabel, formatNumber, labelPlacement, labelText, labelToLatex, measureNumber, measureToLatex, vectorLabelToLatex } from "./labels";
import { boardLayout, mathToLatex, type Mark } from "./board";
import { circuitDrawings, componentDrawing } from "./circuit";
import { regionOutline, vennItemSpots } from "./sets";
import {
  axesOrigin,
  axesStepX,
  axesStepY,
  axisTicks,
  figureUnits,
  endDotRadius,
  functionEnds,
  functionLines,
  gridValues,
  pointGuides,
  xTickText,
} from "./plot";
import { buildScene, OPEN_HEAD, type AxisNumberSpots } from "./render";
import { PATTERN } from "./svg";
import type { Axes, Dash, Element, FigureDoc, Fill, LabelFont, Stroke } from "./types";
import { polar, type Vec } from "./vec";

export interface TikzOptions {
  /** cm per world unit. Default 1. */
  scale?: number;
  /** A whole .tex file that compiles on its own, instead of the tikzpicture to paste. Default false. */
  standalone?: boolean;
}

/** Rounds to 3 decimals and drops trailing zeros. */
const n = (x: number) => {
  const r = Math.round(x * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};

const at = (w: Vec) => `${n(w.x)},${n(w.y)}`;
/** A point shifted by an offset in pt, which ignores the picture scale. */
const shifted = (base: string, o: Vec) => `([shift={(${n(o.x)}pt,${n(o.y)}pt)}]${base})`;

export function toTikz(doc: FigureDoc, options: TikzOptions = {}): string {
  const scale = options.scale ?? 1;
  const pts = pointMap(doc);
  const u = figureUnits(doc);
  const S = (w: Vec): Vec => ({ x: w.x * u.x, y: w.y * u.y });
  const colors = new Map<string, string>();
  let usesPatterns = false;
  // Laid out once, and only when a number needs it.
  let spots: Map<string, AxisNumberSpots> | null = null;
  const numberSpots = () => (spots ??= buildScene(doc, { scale }).numberSpots);

  const color = (c: string): string => {
    if (c === INK || !isValidColor(c)) return "black";
    const hex = c.toLowerCase();
    if (hex === "#000000") return "black";
    if (hex === "#ffffff") return "white";
    let name = colors.get(hex);
    if (!name) {
      name = `gs${colors.size + 1}`;
      colors.set(hex, name);
    }
    return name;
  };

  const strokeOpts = (s: Stroke): string[] => {
    const o = [`draw=${color(s.color)}`, `line width=${n(s.width)}pt`];
    if (s.dash !== "solid") o.push(s.dash);
    if (s.opacity < 1) o.push(`draw opacity=${n(s.opacity)}`);
    return o;
  };

  const fillOpts = (fl: Fill): string[] => {
    const c = color(fl.color);
    const o: string[] = [];
    if (fl.pattern === "solid") {
      o.push(`fill=${c}`);
    } else {
      usesPatterns = true;
      const angle = `angle=${n(fl.angle)}`;
      const distance = `distance=${PATTERN.distance}pt`;
      const spec =
        fl.pattern === "dots"
          ? `Dots[${angle},${distance},radius=${PATTERN.dotRadius}pt]`
          : `${fl.pattern === "crosshatch" ? "Hatch" : "Lines"}[${angle},${distance},line width=${PATTERN.lineWidth}pt]`;
      o.push(`pattern={${spec}}`, `pattern color=${c}`);
    }
    if (fl.opacity < 1) o.push(`fill opacity=${n(fl.opacity)}`);
    return o;
  };

  const opts = (o: string[]) => (o.length ? `[${o.join(", ")}]` : "");

  const offsetLines = (base: string, lines: OffsetLine[], s: Stroke): string =>
    lines
      .map((l) => `\\draw${opts(strokeOpts({ ...s, dash: "solid" }))} ${shifted(base, l.from)} -- ${shifted(base, l.to)};`)
      .join("\n");

  const sections: Record<
    "coords" | "grid" | "axes" | "guide" | "polygon" | "region" | "circle" | "function" | "angle" | "segment" | "board" | "point" | "label",
    string[]
  > = {
    coords: [],
    grid: [],
    axes: [],
    guide: [],
    polygon: [],
    region: [],
    circle: [],
    function: [],
    angle: [],
    segment: [],
    board: [],
    point: [],
    label: [],
  };

  /** Writes board marks, in pt from `base` with Y up: boards and circuit pieces, as the SVG draws them. */
  const writeMarks = (base: string, marks: Mark[], look: { color: string; width: number; font: LabelFont; opacity: number }, out: string[]) => {
    const c = color(look.color);
    const faded = look.opacity < 1 ? [`opacity=${n(look.opacity)}`] : [];
    const lineOpts = (width?: number, dash?: Dash) => {
      const o = [`draw=${c}`, `line width=${n(width ?? look.width)}pt`, ...faded];
      if (dash && dash !== "solid") o.push(dash);
      return opts(o);
    };
    const P = (v: Vec) => shifted(base, v);
    for (const m of marks) {
      switch (m.kind) {
        case "line":
          out.push(`\\draw${lineOpts(m.width, m.dash)} ${P(m.a)} -- ${P(m.b)};`);
          break;
        case "curve":
          out.push(`\\draw${lineOpts(m.width, m.dash)} ${m.points.map(P).join(" -- ")};`);
          break;
        case "text":
          out.push(`\\node${opts(textOptions(look.color, m.size, look.font, color))} at ${P(m.at)} {${mathToLatex(m.node)}};`);
          break;
        case "dot":
          out.push(
            m.open
              ? `\\filldraw[draw=${c}, fill=white, line width=0.7pt] ${P(m.at)} circle[radius=${n(m.r)}pt];`
              : `\\fill[${c}] ${P(m.at)} circle[radius=${n(m.r)}pt];`,
          );
          break;
        case "ring":
          out.push(`\\draw${lineOpts(m.width ?? 0.6)} ${P(m.at)} circle[radius=${n(m.r)}pt];`);
          break;
        case "head": {
          const back = { x: m.tip.x - m.dir.x * m.length, y: m.tip.y - m.dir.y * m.length };
          if (m.open) {
            const h = m.length * OPEN_HEAD;
            out.push(
              `\\draw${opts([`draw=${c}`, "line width=0.6pt", ...faded, "line join=round"])} ${P({ x: back.x - m.dir.y * h, y: back.y + m.dir.x * h })} -- ${P(m.tip)} -- ${P({ x: back.x + m.dir.y * h, y: back.y - m.dir.x * h })} ${P(back)} -- ${P(m.tip)};`,
            );
            break;
          }
          const half = m.length * 0.4;
          out.push(
            `\\fill${opts([c, ...faded])} ${P(m.tip)} -- ${P({ x: back.x - m.dir.y * half, y: back.y + m.dir.x * half })} -- ${P({ x: back.x + m.dir.y * half, y: back.y - m.dir.x * half })} -- cycle;`,
          );
          break;
        }
        case "box": {
          const corner = { x: m.at.x - m.w / 2, y: m.at.y - m.h / 2 };
          out.push(`\\draw${lineOpts(0.5)} ${P(corner)} rectangle ${P({ x: corner.x + m.w, y: corner.y + m.h })};`);
          break;
        }
      }
    }
  };

  const axes = doc.elements.find((e): e is Axes => e.type === "axes");

  for (const p of pts.values()) sections.coords.push(`\\coordinate (${p.id}) at (${at(p)});`);

  for (const el of doc.elements) {
    switch (el.type) {
      case "point":
        if (el.shape === "dot") {
          sections.point.push(`\\fill[${color(el.color)}] (${el.id}) circle[radius=${n(el.size)}pt];`);
        } else if (el.shape === "ring") {
          sections.point.push(
            `\\filldraw[draw=${color(el.color)}, fill=white, line width=0.6pt] (${el.id}) circle[radius=${n(el.size)}pt];`,
          );
        }
        if (el.guides && axes) {
          const lines = pointGuides(el, axes).map(([, b]) => `(${el.id}) -- (${at(b)})`);
          if (lines.length) sections.guide.push(`\\draw${opts(strokeOpts(el.guides))} ${lines.join(" ")};`);
        }
        break;
      case "segment": {
        const a = pts.get(el.a);
        const b = pts.get(el.b);
        if (!a || !b) break;
        sections.segment.push(`\\draw${opts(strokeOpts(el.stroke))} (${el.a}) -- (${el.b});`);
        if (el.ticks > 0) {
          const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          sections.segment.push(offsetLines(at(m), segmentTicks(S(a), S(b), el.ticks), el.stroke));
        }
        break;
      }
      case "vector": {
        const a = pts.get(el.a);
        const b = pts.get(el.b);
        if (!a || !b) break;
        // On paper, where an arrowhead keeps its size and shape whatever the scale.
        const dx = (b.x - a.x) * u.x * 28.3465 * scale;
        const dy = (b.y - a.y) * u.y * 28.3465 * scale;
        const length = Math.hypot(dx, dy);
        if (length === 0) break;
        const dir = { x: dx / length, y: dy / length };
        const head = Math.min(el.head, length * 0.6);
        const half = head * 0.38;
        sections.segment.push(`\\draw${opts(strokeOpts(el.stroke))} (${el.a}) -- ${shifted(el.b, { x: -dir.x * head * 0.8, y: -dir.y * head * 0.8 })};`);
        const headOpts = [color(el.stroke.color)];
        if (el.stroke.opacity < 1) headOpts.push(`fill opacity=${n(el.stroke.opacity)}`);
        const back = { x: -dir.x * head, y: -dir.y * head };
        sections.segment.push(
          `\\fill${opts(headOpts)} (${el.b}) -- ${shifted(el.b, { x: back.x - dir.y * half, y: back.y + dir.x * half })} -- ${shifted(el.b, { x: back.x + dir.y * half, y: back.y - dir.x * half })} -- cycle;`,
        );
        break;
      }
      case "region": {
        const loops = regionOutline(doc, el);
        if (loops.length === 0) break;
        const path = loops
          .map((loop) => {
            const body = loop
              .map((e, i) => {
                const join = i === 0 ? `(${at(e.from)})` : `-- (${at(e.from)})`;
                if (e.kind === "line") return `${join} -- (${at(e.to)})`;
                return `${join} arc[start angle=${n(e.start)}, end angle=${n(e.start + e.sweep)}, radius=${n(e.r)}]`;
              })
              .join(" ");
            return `${body} -- cycle`;
          })
          .join(" ");
        const o = [...fillOpts(el.fill), ...(el.stroke ? strokeOpts(el.stroke) : [])];
        sections.region.push(`\\path${opts(o)} ${path};`);
        break;
      }
      case "vennitems":
        for (const spot of vennItemSpots(doc, el)) {
          sections.label.push(
            `\\node${opts(textOptions(el.color, el.size, el.font, color))} at ${shifted(at(spot.anchor), spot.offset)} {${labelToLatex(spot.text, el.font)}};`,
          );
        }
        break;
      case "board": {
        const layout = boardLayout(el, doc);
        if (!layout) break;
        writeMarks(at(el), layout.marks, { color: el.color, width: el.width, font: el.font, opacity: 1 }, sections.board);
        break;
      }
      case "component": {
        const drawing = componentDrawing(doc, el, PT_PER_CM * scale);
        if (drawing) writeMarks(at(drawing.mid), drawing.marks, { color: el.stroke.color, width: el.stroke.width, font: el.label?.font ?? "serif", opacity: el.stroke.opacity }, sections.segment);
        break;
      }
      case "circuit":
        for (const drawing of circuitDrawings(doc, el, PT_PER_CM * scale)) {
          writeMarks(at(drawing.mid), drawing.marks, { color: el.color, width: 0.6, font: el.font, opacity: 1 }, sections.label);
        }
        break;
      case "extension": {
        const ends = extensionEnds(el, pts);
        if (ends) sections.segment.push(`\\draw${opts(strokeOpts(el.stroke))} (${ends[0].id}) -- (${ends[1].id});`);
        break;
      }
      case "angle": {
        const a = pts.get(el.a);
        const v = pts.get(el.vertex);
        const b = pts.get(el.b);
        // Marks go by the angle as drawn, which axes at different scales bend.
        const geo = a && v && b ? angleArc(S(a), S(v), S(b), el.reflex) : null;
        if (!geo) break;
        const vtx = el.vertex;
        const end = geo.start + geo.sweep;
        if (el.rightMark && geo.isRight) {
          const [u1, corner, u2] = rightAngleSquare(geo, el.radius);
          if (el.fill) {
            sections.angle.push(
              `\\fill${opts(fillOpts(el.fill))} (${vtx}) -- ${shifted(vtx, u1)} -- ${shifted(vtx, corner)} -- ${shifted(vtx, u2)} -- cycle;`,
            );
          }
          sections.angle.push(
            `\\draw${opts(strokeOpts(el.stroke))} ${shifted(vtx, u1)} -- ${shifted(vtx, corner)} -- ${shifted(vtx, u2)};`,
          );
          const dot = polar(el.radius * 0.35 * Math.SQRT2, geo.start + 45);
          // The dot fades with the square's stroke, like in the SVG.
          const dotOpts = [color(el.stroke.color)];
          if (el.stroke.opacity < 1) dotOpts.push(`fill opacity=${n(el.stroke.opacity)}`);
          sections.angle.push(
            `\\fill${opts(dotOpts)} ${shifted(vtx, dot)} circle[radius=${n(Math.max(0.7, el.stroke.width))}pt];`,
          );
          break;
        }
        const arcTo = (r: number) =>
          `++(${n(geo.start)}:${n(r)}pt) arc[start angle=${n(geo.start)}, end angle=${n(end)}, radius=${n(r)}pt]`;
        if (el.fill) {
          sections.angle.push(`\\fill${opts(fillOpts(el.fill))} (${vtx}) -- ${arcTo(el.radius)} -- cycle;`);
        }
        for (const r of angleArcRadii(el)) {
          sections.angle.push(`\\draw${opts(strokeOpts(el.stroke))} (${vtx}) ${arcTo(r)};`);
        }
        if (el.ticks > 0) sections.angle.push(offsetLines(vtx, angleTicks(geo, el.radius, el.ticks), el.stroke));
        break;
      }
      case "circle": {
        if (!pts.has(el.center)) break;
        const c = el.center;
        const r = n(el.radius);
        const full = !el.arc || ((el.arc.end - el.arc.start) % 360 + 360) % 360 === 0;
        if (full) {
          const o = [...(el.fill ? fillOpts(el.fill) : []), ...strokeOpts(el.stroke)];
          sections.circle.push(`\\path${opts(o)} (${c}) circle[radius=${r}];`);
        } else {
          const s = el.arc!.start;
          const sweep = ((el.arc!.end - s) % 360 + 360) % 360;
          const arcPath = `++(${n(s)}:${r}) arc[start angle=${n(s)}, end angle=${n(s + sweep)}, radius=${r}]`;
          if (el.fill) sections.circle.push(`\\fill${opts(fillOpts(el.fill))} (${c}) -- ${arcPath} -- cycle;`);
          sections.circle.push(`\\draw${opts(strokeOpts(el.stroke))} (${c}) ${arcPath};`);
          if (el.radii) {
            sections.circle.push(
              `\\draw${opts(strokeOpts(el.stroke))} (${c}) ++(${n(s)}:${r}) -- (${c}) -- ++(${n(s + sweep)}:${r});`,
            );
          }
        }
        break;
      }
      case "polygon": {
        const vs = el.vertices.filter((id) => pts.has(id));
        if (vs.length < 3 || (!el.fill && !el.stroke)) break;
        const o = [...(el.fill ? fillOpts(el.fill) : []), ...(el.stroke ? strokeOpts(el.stroke) : [])];
        sections.polygon.push(`\\path${opts(o)} ${vs.map((id) => `(${id})`).join(" -- ")} -- cycle;`);
        break;
      }
      case "function": {
        // The sampled points, as in the SVG: plain TikZ, no pgfplots, and pgf's degree-based trig never comes in.
        for (const line of functionLines(el)) {
          const coords: string[] = [];
          for (let i = 0; i < line.length; i += 6) {
            coords.push(line.slice(i, i + 6).map((p) => `(${at(p)})`).join(" "));
          }
          sections.function.push(`\\draw${opts(strokeOpts(el.stroke))} plot coordinates {\n  ${coords.join("\n  ")}\n};`);
        }
        const r = n(endDotRadius(el.stroke.width));
        const dotColor = color(el.stroke.color);
        const dotOpacity = el.stroke.opacity < 1 ? [`fill opacity=${n(el.stroke.opacity)}`] : [];
        for (const end of functionEnds(el)) {
          // An open dot is filled white, like a ring point, so the curve doesn't show through.
          sections.function.push(
            end.open
              ? `\\filldraw[draw=${dotColor}, fill=white, line width=${n(Math.max(0.6, el.stroke.width * 0.8))}pt] (${at(end.at)}) circle[radius=${r}pt];`
              : `\\fill${opts([dotColor, ...dotOpacity])} (${at(end.at)}) circle[radius=${r}pt];`,
          );
        }
        break;
      }
      case "vline":
        sections.function.push(
          `\\draw${opts(strokeOpts(el.stroke))} (${at({ x: el.x, y: el.range[0] })}) -- (${at({ x: el.x, y: el.range[1] })});`,
        );
        break;
      case "axes": {
        const o = axesOrigin(el);
        const xs = axisTicks(el.x, axesStepX(el), o.x);
        const ys = axisTicks(el.y, axesStepY(el), o.y);
        const xEnd = at({ x: el.x[1], y: o.y });
        const yEnd = at({ x: o.x, y: el.y[1] });
        sections.axes.push(
          `\\draw${opts(strokeOpts(el.stroke))} (${at({ x: el.x[0], y: o.y })}) -- (${xEnd}) (${at({ x: o.x, y: el.y[0] })}) -- (${yEnd});`,
        );
        // Open arrowheads drawn like the SVG's, so no arrows library is needed.
        const len = 4 + el.stroke.width * 2;
        const half = len * OPEN_HEAD;
        const head = (tip: string, dx: number, dy: number) =>
          `${shifted(tip, { x: -dx * len - dy * half, y: -dy * len + dx * half })} -- (${tip}) -- ${shifted(tip, { x: -dx * len + dy * half, y: -dy * len - dx * half })}`;
        sections.axes.push(`\\draw${opts([...strokeOpts({ ...el.stroke, dash: "solid" }), "line join=round"])} ${head(xEnd, 1, 0)} ${head(yEnd, 0, 1)};`);
        const tick = 2.5;
        const ticks = [
          ...xs.map((x) => at({ x, y: o.y })).map((b) => `${shifted(b, { x: 0, y: -tick })} -- ${shifted(b, { x: 0, y: tick })}`),
          ...ys.map((y) => at({ x: o.x, y })).map((b) => `${shifted(b, { x: -tick, y: 0 })} -- ${shifted(b, { x: tick, y: 0 })}`),
        ];
        if (ticks.length) sections.axes.push(`\\draw${opts(strokeOpts({ ...el.stroke, dash: "solid" }))} ${ticks.join(" ")};`);
        const node = (text: string, base: string, offset: Vec) =>
          `\\node${opts(textOptions(el.stroke.color, el.size, "serif", color))} at ${shifted(base, offset)} {${labelToLatex(text, "serif")}};`;
        if (el.numbers) {
          // The SVG's spot for each number (offsets in pt, y down), so a curve crosses neither.
          const spots = numberSpots().get(el.id);
          const write = (s: string, base: string, spot: Vec | null | undefined) => {
            if (spot) sections.label.push(node(s, base, { x: spot.x, y: -spot.y }));
          };
          xs.forEach((x, i) => write(xTickText(el, x, doc.locale), at({ x, y: o.y }), spots?.x[i]));
          ys.forEach((y, i) => write(formatNumber(y, 2, doc.locale), at({ x: o.x, y }), spots?.y[i]));
        }
        if (el.names[0]) sections.label.push(node(el.names[0], xEnd, { x: 2, y: -el.size }));
        if (el.names[1]) sections.label.push(node(el.names[1], yEnd, { x: el.size * 0.9, y: 0 }));
        break;
      }
      case "grid": {
        const w = gridWindow(doc, el);
        const grid = gridValues(w.x, w.stepX)
          .map((x) => `(${at({ x, y: w.y[0] })}) -- (${at({ x, y: w.y[1] })})`)
          .concat(gridValues(w.y, w.stepY).map((y) => `(${at({ x: w.x[0], y })}) -- (${at({ x: w.x[1], y })})`));
        if (grid.length) sections.grid.push(`\\draw${opts(strokeOpts(el.stroke))} ${grid.join(" ")};`);
        break;
      }
      case "numberline": {
        const from = at({ x: el.x[0], y: el.y });
        const tip = at({ x: el.x[1], y: el.y });
        sections.axes.push(`\\draw${opts(strokeOpts(el.stroke))} (${from}) -- (${tip});`);
        const len = 4 + el.stroke.width * 2;
        const half = len * OPEN_HEAD;
        sections.axes.push(
          `\\draw${opts([...strokeOpts({ ...el.stroke, dash: "solid" }), "line join=round"])} ${shifted(tip, { x: -len, y: half })} -- (${tip}) -- ${shifted(tip, { x: -len, y: -half })};`,
        );
        const tick = 2.5;
        const xs = axisTicks(el.x, el.step, NaN);
        const ticks = xs.map((x) => at({ x, y: el.y })).map((b) => `${shifted(b, { x: 0, y: -tick })} -- ${shifted(b, { x: 0, y: tick })}`);
        if (ticks.length) sections.axes.push(`\\draw${opts(strokeOpts({ ...el.stroke, dash: "solid" }))} ${ticks.join(" ")};`);
        if (el.numbers) {
          for (const x of xs) {
            sections.label.push(
              `\\node${opts(textOptions(el.stroke.color, el.size, "serif", color))} at ${shifted(at({ x, y: el.y }), { x: 0, y: -(tick + el.size * 0.9) })} {${labelToLatex(formatNumber(x, 2, doc.locale), "serif")}};`,
            );
          }
        }
        break;
      }
      case "text":
        sections.label.push(
          `\\node${opts(textOptions(el.color, el.size, el.font, color))} at (${at(el)}) {${labelToLatex(el.text, el.font)}};`,
        );
        break;
    }
    const label = labelCommand(doc, el, color);
    if (label) sections.label.push(label);
  }

  const lines: string[] = [];
  lines.push("% Figura feita no GeoSimples: https://geosimples.vercel.app");
  lines.push(
    usesPatterns
      ? "% Preâmbulo: \\usepackage{tikz} e \\usetikzlibrary{patterns.meta}"
      : "% Preâmbulo: \\usepackage{tikz}",
  );
  // SVG's default miter limit: sharp corners get beveled instead of drawing long spikes.
  // Axes at different scales stretch x and y; TikZ then draws circles as ellipses, as the SVG does.
  lines.push(`\\begin{tikzpicture}[x=${n(scale * u.x)}cm, y=${n(scale * u.y)}cm, miter limit=4]`);
  for (const [hex, name] of colors) lines.push(`\\definecolor{${name}}{HTML}{${hex.slice(1).toUpperCase()}}`);
  const order = ["coords", "grid", "axes", "guide", "polygon", "region", "circle", "function", "angle", "segment", "board", "point", "label"] as const;
  for (const key of order) lines.push(...sections[key]);
  lines.push("\\end{tikzpicture}");
  if (!options.standalone) return lines.join("\n") + "\n";
  return [
    "\\documentclass[border=2pt]{standalone}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{tikz}",
    ...(usesPatterns ? ["\\usetikzlibrary{patterns.meta}"] : []),
    "\\begin{document}",
    // The preamble comment is for pasting into a document; this file already has it.
    ...lines.filter((l) => !l.startsWith("% Preâmbulo")),
    "\\end{document}",
    "",
  ].join("\n");
}

function textOptions(c: string, size: number, font: LabelFont, color: (c: string) => string): string[] {
  const o = [`text=${color(c)}`];
  // 10 pt is the default: the text then follows the document's font size.
  const family = font === "sans" ? "\\sffamily" : "";
  const sizing = size !== 10 ? `\\fontsize{${n(size)}}{${n(size * 1.2)}}\\selectfont` : "";
  if (family || sizing) o.push(`font=${family}${sizing}`);
  return o;
}

function labelCommand(doc: FigureDoc, el: Element, color: (c: string) => string): string | null {
  if (!canHaveLabel(el)) return null;
  const placement = labelPlacement(doc, el);
  if (!placement || !el.label) return null;
  const { size, measure } = el.label;
  const base = el.type === "point" ? el.id : at(placement.anchor);
  const o = textOptions(el.label.color, size, el.label.font, color);
  // A live measure is written with the value it has at export time.
  const number = measure ? measureNumber(doc, el, measure) : null;
  let latex = measure && number !== null ? measureToLatex(measure, number, el.label.font) : labelToLatex(labelText(doc, el), el.label.font);
  if (el.type === "vector" && !measure) latex = vectorLabelToLatex(labelText(doc, el), el.notation, el.label.font);
  return `\\node[${o.join(", ")}] at ${shifted(base, placement.offset)} {${latex}};`;
}

