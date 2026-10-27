/** Parses 1,5 or 1.5. */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "" || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return Number(t);
}

/** Rounds and writes with a decimal comma. */
export function show(n: number, decimals: number): string {
  const r = Math.round(n * 10 ** decimals) / 10 ** decimals;
  return String(r).replace(".", ",");
}

export const pt = (n: number) => `${show(n, 1)} pt`;
export const pct = (n: number) => `${Math.round(n * 100)}%`;
