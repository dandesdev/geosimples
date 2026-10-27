import { LIMITS } from "./defaults";
import { add, polar, type Vec } from "./vec";

export interface ParsedPoint {
  x: number;
  y: number;
  label?: string;
}

export interface ParseResult {
  points: ParsedPoint[];
  errors: string[];
}

export interface ParseContext {
  /** Last selected point, used by R:θ. */
  selected?: Vec;
  /** Last point in the figure, the fallback for +R:θ at the start of the input. */
  last?: Vec;
}

/** Accepts 1.5 and 1,5 (Brazilian decimal comma). */
function parseNumber(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && Math.abs(n) <= LIMITS.coordinate ? n : null;
}

const NAME = /^([A-Za-zα-ωΑ-Ω][A-Za-z0-9′'₀-₉]*)=(.+)$/u;

/**
 * Parses the point input bar. Points are separated by spaces:
 *
 * - `X;Y` absolute coordinates, e.g. `0;0` or `(2,5;-1)`
 * - `+R:θ` R units at θ degrees from the previous point
 * - `R:θ` R units at θ degrees from the last selected point
 * - an optional name in front: `A=0;0`
 */
export function parsePointInput(input: string, ctx: ParseContext = {}): ParseResult {
  const points: ParsedPoint[] = [];
  const errors: string[] = [];
  const normalized = input.replace(/\s*([=;:])\s*/g, "$1").trim();
  if (normalized === "") return { points, errors };

  for (const raw of normalized.split(/\s+/)) {
    let token = raw;
    let label: string | undefined;
    const named = NAME.exec(token);
    if (named) {
      label = named[1];
      token = named[2];
    }
    const relative = token.startsWith("+");
    if (relative) token = token.slice(1);
    token = token.replace(/^\((.*)\)$/, "$1");

    if (token.includes(";")) {
      if (relative) {
        errors.push(`"${raw}": use + apenas com R:θ, como +3:60.`);
        continue;
      }
      const parts = token.split(";");
      const x = parts.length === 2 ? parseNumber(parts[0]) : null;
      const y = parts.length === 2 ? parseNumber(parts[1]) : null;
      if (x === null || y === null) {
        errors.push(`"${raw}" não é um ponto X;Y válido. Exemplo: 2;3 ou 1,5;-2.`);
        continue;
      }
      points.push({ x, y, label });
    } else if (token.includes(":")) {
      const parts = token.split(":");
      const r = parts.length === 2 ? parseNumber(parts[0]) : null;
      const theta = parts.length === 2 ? parseNumber(parts[1]) : null;
      if (r === null || theta === null) {
        errors.push(`"${raw}" não é um ponto R:θ válido. Exemplo: +3:60.`);
        continue;
      }
      const prev = points[points.length - 1];
      const origin = relative ? (prev ?? ctx.selected ?? ctx.last) : ctx.selected;
      if (!origin) {
        errors.push(
          relative
            ? `"${raw}": não há ponto anterior para partir.`
            : `"${raw}": selecione um ponto para usar R:θ, ou use +R:θ a partir do ponto anterior.`,
        );
        continue;
      }
      const p = add(origin, polar(r, theta));
      points.push({ x: roundTiny(p.x), y: roundTiny(p.y), label });
    } else {
      errors.push(`"${raw}" não foi entendido. Use X;Y, +R:θ ou R:θ.`);
    }
  }
  return { points, errors };
}

/** Removes floating point noise like 2.9999999999999996. */
function roundTiny(n: number): number {
  return Math.round(n * 1e9) / 1e9;
}
