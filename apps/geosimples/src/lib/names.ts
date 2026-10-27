import type { ElementType, FigureDoc, Id } from "@geosimples/core/figure";

export const TYPE_NAMES: Record<ElementType, { one: string; many: string; title: string }> = {
  point: { one: "ponto", many: "pontos", title: "Ponto" },
  segment: { one: "segmento", many: "segmentos", title: "Segmento" },
  angle: { one: "ângulo", many: "ângulos", title: "Ângulo" },
  circle: { one: "circunferência", many: "circunferências", title: "Circunferência" },
  polygon: { one: "polígono", many: "polígonos", title: "Polígono" },
};

/** "2 pontos, 1 segmento", or null for an empty selection. */
export function describeSelection(doc: FigureDoc, selection: Id[]): string | null {
  const counts = new Map<ElementType, number>();
  const byId = new Map(doc.elements.map((e) => [e.id, e]));
  for (const id of selection) {
    const el = byId.get(id);
    if (el) counts.set(el.type, (counts.get(el.type) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts].map(([type, n]) => `${n} ${n === 1 ? TYPE_NAMES[type].one : TYPE_NAMES[type].many}`).join(", ");
}
