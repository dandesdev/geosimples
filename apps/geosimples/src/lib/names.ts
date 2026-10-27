import type { ElementType } from "@geosimples/core/figure";

export const TYPE_NAMES: Record<ElementType, { one: string; many: string; title: string }> = {
  point: { one: "ponto", many: "pontos", title: "Ponto" },
  segment: { one: "segmento", many: "segmentos", title: "Segmento" },
  angle: { one: "ângulo", many: "ângulos", title: "Ângulo" },
  circle: { one: "circunferência", many: "circunferências", title: "Circunferência" },
  polygon: { one: "polígono", many: "polígonos", title: "Polígono" },
};
