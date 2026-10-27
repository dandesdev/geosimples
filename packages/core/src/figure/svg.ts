import { buildScene, type Box, type PaintFill, type PaintStroke, type Prim, type Scene } from "./render";
import type { FigureDoc } from "./types";

/** Pattern spacing and mark sizes in pt, shared with the TikZ export. */
export const PATTERN = { distance: 4, lineWidth: 0.4, dotRadius: 0.6 } as const;

export const LABEL_FONT =
  "'Latin Modern Roman', 'CMU Serif', 'Times New Roman', Times, serif";

const f = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};

export function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (ch) =>
    ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === "&" ? "&amp;" : ch === '"' ? "&quot;" : "&apos;",
  );
}

function patternId(fl: PaintFill): string {
  return `gs-${fl.pattern}-${fl.color.slice(1)}-${Math.round(fl.angle)}`;
}

function patternDef(fl: PaintFill): string {
  const d = PATTERN.distance;
  const id = patternId(fl);
  const rotate = `rotate(${f(-fl.angle)})`;
  let body: string;
  if (fl.pattern === "dots") {
    body = `<circle cx="${d / 2}" cy="${d / 2}" r="${PATTERN.dotRadius}" fill="${fl.color}"/>`;
  } else {
    const lines = fl.pattern === "crosshatch" ? `M0 ${d / 2}H${d}M${d / 2} 0V${d}` : `M0 ${d / 2}H${d}`;
    body = `<path d="${lines}" stroke="${fl.color}" stroke-width="${PATTERN.lineWidth}" fill="none"/>`;
  }
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${d}" height="${d}" patternTransform="${rotate}">${body}</pattern>`;
}

function dashArray(s: PaintStroke): string | null {
  if (s.dash === "dashed") return "3 3";
  if (s.dash === "dotted") return `${f(s.width)} 2`;
  return null;
}

function primMarkup(p: Prim): string {
  if (p.kind === "text") {
    // A baseline offset instead of dominant-baseline, which some editors ignore.
    const y = p.y + p.size * 0.35;
    const style = p.italic ? ' font-style="italic"' : "";
    return `<text x="${f(p.x)}" y="${f(y)}" font-size="${f(p.size)}" text-anchor="middle" fill="${p.color}"${style}>${escapeXml(p.text)}</text>`;
  }
  const attrs: string[] = [`d="${p.d}"`];
  if (p.fill) {
    attrs.push(`fill="${p.fill.pattern === "solid" ? p.fill.color : `url(#${patternId(p.fill)})`}"`);
    if (p.fill.opacity < 1) attrs.push(`fill-opacity="${f(p.fill.opacity)}"`);
  } else {
    attrs.push('fill="none"');
  }
  if (p.stroke) {
    attrs.push(`stroke="${p.stroke.color}"`, `stroke-width="${f(p.stroke.width)}"`);
    const dash = dashArray(p.stroke);
    if (dash) attrs.push(`stroke-dasharray="${dash}"`);
    if (p.stroke.opacity < 1) attrs.push(`stroke-opacity="${f(p.stroke.opacity)}"`);
  }
  return `<path ${attrs.join(" ")}/>`;
}

/** Defs and drawing of a scene, without the outer <svg>. */
export function sceneMarkup(scene: Scene): string {
  const patterns = new Map<string, string>();
  for (const p of scene.prims) {
    if (p.kind === "path" && p.fill && p.fill.pattern !== "solid") {
      patterns.set(patternId(p.fill), patternDef(p.fill));
    }
  }
  const defs = patterns.size ? `<defs>${[...patterns.values()].join("")}</defs>` : "";
  const body = scene.prims.map(primMarkup).join("");
  return `${defs}<g font-family="${escapeXml(LABEL_FONT)}">${body}</g>`;
}

export interface SvgOptions {
  /** cm per world unit. Default 1. */
  scale?: number;
  /** Space around the figure, in pt. Default 6. */
  margin?: number;
  /** Background color, or null for transparent. Default null. */
  background?: string | null;
}

export function paddedBox(box: Box | null, margin: number): Box {
  const b = box ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX: b.minX - margin, minY: b.minY - margin, maxX: b.maxX + margin, maxY: b.maxY + margin };
}

/** A standalone SVG file. Sizes are in pt, so it prints at the figure's real size. */
export function toSvg(doc: FigureDoc, options: SvgOptions = {}): string {
  const scene = buildScene(doc, { scale: options.scale });
  const b = paddedBox(scene.box, options.margin ?? 6);
  const w = Math.max(b.maxX - b.minX, 1);
  const h = Math.max(b.maxY - b.minY, 1);
  const bg = options.background
    ? `<rect x="${f(b.minX)}" y="${f(b.minY)}" width="${f(w)}" height="${f(h)}" fill="${options.background}"/>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}pt" height="${f(h)}pt" ` +
    `viewBox="${f(b.minX)} ${f(b.minY)} ${f(w)} ${f(h)}">` +
    bg +
    sceneMarkup(scene) +
    `</svg>`
  );
}
