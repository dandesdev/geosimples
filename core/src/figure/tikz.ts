import { AXES_GRID, INK, isValidColor } from "./defaults";
import {
  angleArc,
  angleArcRadii,
  angleTicks,
  pointMap,
  rightAngleSquare,
  segmentTicks,
  type OffsetLine,
} from "./geometry";
import { estimateTextWidth, formatNumber, labelPlacement, labelText, labelToLatex, measureNumber, measureToLatex } from "./labels";
import {
  axesOrigin,
  axesStepX,
  axisTicks,
  endDotRadius,
  functionEnds,
  functionLines,
  gridValues,
  pointGuides,
  xTickText,
} from "./plot";
import { PATTERN } from "./svg";
import type { Axes, Element, FigureDoc, Fill, LabelFont, Stroke } from "./types";
import { polar, type Vec } from "./vec";

export interface TikzOptions {
  /** cm per world unit. Default 1. */
  scale?: number;
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
  const colors = new Map<string, string>();
  let usesPatterns = false;

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
    "coords" | "axes" | "guide" | "polygon" | "circle" | "function" | "angle" | "segment" | "point" | "label",
    string[]
  > = {
    coords: [],
    axes: [],
    guide: [],
    polygon: [],
    circle: [],
    function: [],
    angle: [],
    segment: [],
    point: [],
    label: [],
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
          sections.segment.push(offsetLines(at(m), segmentTicks(a, b, el.ticks), el.stroke));
        }
        break;
      }
      case "angle": {
        const a = pts.get(el.a);
        const v = pts.get(el.vertex);
        const b = pts.get(el.b);
        const geo = a && v && b ? angleArc(a, v, b, el.reflex) : null;
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
        const ys = axisTicks(el.y, el.step, o.y);
        if (el.grid) {
          const grid = gridValues(el.x, axesStepX(el))
            .map((x) => `(${at({ x, y: el.y[0] })}) -- (${at({ x, y: el.y[1] })})`)
            .concat(gridValues(el.y, el.step).map((y) => `(${at({ x: el.x[0], y })}) -- (${at({ x: el.x[1], y })})`));
          sections.axes.push(`\\draw${opts(strokeOpts(AXES_GRID))} ${grid.join(" ")};`);
        }
        const xEnd = at({ x: el.x[1], y: o.y });
        const yEnd = at({ x: o.x, y: el.y[1] });
        sections.axes.push(
          `\\draw${opts(strokeOpts(el.stroke))} (${at({ x: el.x[0], y: o.y })}) -- (${xEnd}) (${at({ x: o.x, y: el.y[0] })}) -- (${yEnd});`,
        );
        // Arrowheads drawn like the SVG's, so no arrows library is needed.
        const len = 4 + el.stroke.width * 2;
        const half = len * 0.4;
        const head = (tip: string, dx: number, dy: number) =>
          `(${tip}) -- ${shifted(tip, { x: -dx * len - dy * half, y: -dy * len + dx * half })} -- ${shifted(tip, { x: -dx * len + dy * half, y: -dy * len - dx * half })} -- cycle`;
        const headOpts = [color(el.stroke.color)];
        if (el.stroke.opacity < 1) headOpts.push(`fill opacity=${n(el.stroke.opacity)}`);
        sections.axes.push(`\\fill${opts(headOpts)} ${head(xEnd, 1, 0)} ${head(yEnd, 0, 1)};`);
        const tick = 2.5;
        const ticks = [
          ...xs.map((x) => at({ x, y: o.y })).map((b) => `${shifted(b, { x: 0, y: -tick })} -- ${shifted(b, { x: 0, y: tick })}`),
          ...ys.map((y) => at({ x: o.x, y })).map((b) => `${shifted(b, { x: -tick, y: 0 })} -- ${shifted(b, { x: tick, y: 0 })}`),
        ];
        if (ticks.length) sections.axes.push(`\\draw${opts(strokeOpts({ ...el.stroke, dash: "solid" }))} ${ticks.join(" ")};`);
        const node = (text: string, base: string, offset: Vec) =>
          `\\node${opts(textOptions(el.stroke.color, el.size, "serif", color))} at ${shifted(base, offset)} {${labelToLatex(text, "serif")}};`;
        if (el.numbers) {
          const gap = el.size * 0.9;
          for (const x of xs) sections.label.push(node(xTickText(el, x), at({ x, y: o.y }), { x: 0, y: -(tick + gap * 0.7) }));
          for (const y of ys) {
            const s = formatNumber(y);
            sections.label.push(node(s, at({ x: o.x, y }), { x: -(tick + 2 + estimateTextWidth(s, el.size) / 2), y: 0 }));
          }
        }
        if (el.names[0]) sections.label.push(node(el.names[0], xEnd, { x: 2, y: -el.size }));
        if (el.names[1]) sections.label.push(node(el.names[1], yEnd, { x: el.size * 0.9, y: 0 }));
        break;
      }
      case "numberline": {
        const from = at({ x: el.x[0], y: el.y });
        const tip = at({ x: el.x[1], y: el.y });
        sections.axes.push(`\\draw${opts(strokeOpts(el.stroke))} (${from}) -- (${tip});`);
        const len = 4 + el.stroke.width * 2;
        const half = len * 0.4;
        const headOpts = [color(el.stroke.color)];
        if (el.stroke.opacity < 1) headOpts.push(`fill opacity=${n(el.stroke.opacity)}`);
        sections.axes.push(
          `\\fill${opts(headOpts)} (${tip}) -- ${shifted(tip, { x: -len, y: half })} -- ${shifted(tip, { x: -len, y: -half })} -- cycle;`,
        );
        const tick = 2.5;
        const xs = axisTicks(el.x, el.step, NaN);
        const ticks = xs.map((x) => at({ x, y: el.y })).map((b) => `${shifted(b, { x: 0, y: -tick })} -- ${shifted(b, { x: 0, y: tick })}`);
        if (ticks.length) sections.axes.push(`\\draw${opts(strokeOpts({ ...el.stroke, dash: "solid" }))} ${ticks.join(" ")};`);
        if (el.numbers) {
          for (const x of xs) {
            sections.label.push(
              `\\node${opts(textOptions(el.stroke.color, el.size, "serif", color))} at ${shifted(at({ x, y: el.y }), { x: 0, y: -(tick + el.size * 0.9) })} {${labelToLatex(formatNumber(x), "serif")}};`,
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
  lines.push(`\\begin{tikzpicture}[x=${n(scale)}cm, y=${n(scale)}cm, miter limit=4]`);
  for (const [hex, name] of colors) lines.push(`\\definecolor{${name}}{HTML}{${hex.slice(1).toUpperCase()}}`);
  const order = ["coords", "axes", "guide", "polygon", "circle", "function", "angle", "segment", "point", "label"] as const;
  for (const key of order) lines.push(...sections[key]);
  lines.push("\\end{tikzpicture}");
  return lines.join("\n") + "\n";
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
  if (el.type === "text" || el.type === "axes" || el.type === "numberline") return null;
  const placement = labelPlacement(doc, el);
  if (!placement || !el.label) return null;
  const { size, measure } = el.label;
  const base = el.type === "point" ? el.id : at(placement.anchor);
  const o = textOptions(el.label.color, size, el.label.font, color);
  // A live measure is written with the value it has at export time.
  const number = measure ? measureNumber(doc, el, measure) : null;
  const latex = measure && number !== null ? measureToLatex(measure, number, el.label.font) : labelToLatex(labelText(doc, el), el.label.font);
  return `\\node[${o.join(", ")}] at ${shifted(base, placement.offset)} {${latex}};`;
}

