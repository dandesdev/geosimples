import {
  formatNumber,
  type Element,
  type ElementType,
  type FigureDoc,
  type Id,
  type PointConstruction,
  type SpotRole,
} from "@geosimples/core/figure";

export const TYPE_NAMES: Record<ElementType, { one: string; many: string; title: string }> = {
  point: { one: "ponto", many: "pontos", title: "Ponto" },
  segment: { one: "segmento", many: "segmentos", title: "Segmento" },
  extension: { one: "prolongamento", many: "prolongamentos", title: "Prolongamento" },
  angle: { one: "ângulo", many: "ângulos", title: "Ângulo" },
  circle: { one: "circunferência", many: "circunferências", title: "Circunferência" },
  polygon: { one: "polígono", many: "polígonos", title: "Polígono" },
  text: { one: "texto", many: "textos", title: "Texto" },
  function: { one: "gráfico", many: "gráficos", title: "Gráfico" },
  vline: { one: "reta vertical", many: "retas verticais", title: "Reta vertical" },
  numberline: { one: "reta numérica", many: "retas numéricas", title: "Reta numérica" },
  axes: { one: "par de eixos", many: "pares de eixos", title: "Eixos" },
  grid: { one: "malha", many: "malhas", title: "Malha quadriculada" },
  vector: { one: "vetor", many: "vetores", title: "Vetor" },
  region: { one: "região", many: "regiões", title: "Região" },
  vennitems: { one: "conteúdo do diagrama", many: "conteúdos do diagrama", title: "Conteúdo do diagrama" },
  board: { one: "conta ou quadro", many: "contas e quadros", title: "Conta ou quadro" },
  study: { one: "estudo na reta", many: "estudos na reta", title: "Estudo na reta" },
  component: { one: "componente", many: "componentes", title: "Componente" },
  circuit: { one: "valor do circuito", many: "valores do circuito", title: "Valores do circuito" },
};

/** What the preview calls a point it could add under the pointer, and the menu item that adds it. */
export const SPOT_NAMES: Record<SpotRole, { name: string; add: string }> = {
  intersection: { name: "Interseção", add: "Inserir ponto de interseção" },
  max: { name: "Máximo", add: "Inserir ponto de máximo" },
  min: { name: "Mínimo", add: "Inserir ponto de mínimo" },
  root: { name: "Raiz", add: "Inserir raiz" },
  yAxis: { name: "Corte no eixo y", add: "Inserir corte no eixo y" },
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

/** Name of an element as the teacher sees it: its label, or what it joins. */
function elementName(byId: Map<Id, Element>, id: Id): string {
  const el = byId.get(id);
  if (!el) return "?";
  if (el.type === "component" && el.name) return el.name;
  if (el.label?.text) return el.label.text;
  if (el.type === "segment") return `${elementName(byId, el.a)}${elementName(byId, el.b)}`;
  if (el.type === "circle") return `a circunferência de centro ${elementName(byId, el.center)}`;
  if (el.type === "vline") return `x = ${formatNumber(el.x)}`;
  return el.id;
}

const NOTABLE_NAMES = { root: "Raiz", extremum: "Máximo ou mínimo", yAxis: "Corte no eixo y" } as const;

/** "Ponto médio de A e B", for the point editor. */
export function describeConstruction(doc: FigureDoc, c: PointConstruction): string {
  const byId = new Map(doc.elements.map((e) => [e.id, e]));
  const name = (id: Id) => elementName(byId, id);
  const line = ([a, b]: [Id, Id]) => `${name(a)}${name(b)}`;
  switch (c.kind) {
    case "midpoint":
      return `Ponto médio de ${name(c.points[0])} e ${name(c.points[1])}`;
    case "foot":
      return `Projeção ortogonal de ${name(c.point)} sobre a reta ${line(c.line)}`;
    case "bisector":
      return `Na bissetriz do ângulo ${c.angle.map(name).join("")}${c.line ? `, sobre a reta ${line(c.line)}` : ""}`;
    case "perpendicular":
      return `Na mediatriz de ${line(c.points)}`;
    case "intersection":
      return `Interseção de ${name(c.of[0])} e ${name(c.of[1])}`;
    case "arcEnd":
      return `${c.end === 0 ? "Início" : "Fim"} do arco de ${name(c.circle)}`;
    case "onGraph":
      return `No gráfico de ${name(c.graph)}`;
    case "notable":
      return `${NOTABLE_NAMES[c.feature]} de ${name(c.graph)}`;
    case "tangent":
      return `Na reta tangente a ${name(c.graph)} em ${name(c.point)}`;
    case "translate":
      return c.factor === 1 ? `${name(c.point)} deslocado por ${line(c.by)}` : `${name(c.point)} mais ${formatNumber(c.factor)} vezes ${line(c.by)}`;
    case "unit":
      return `Versor de ${line(c.of)}`;
    case "corner":
      return `Com o x de ${name(c.x)} e o y de ${name(c.y)}`;
  }
}
