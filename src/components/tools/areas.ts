import type { ComponentType } from "react";
import { Blend, Calculator, ChartSpline, Power, Shapes, SquareFunction, Type, Zap } from "lucide-react";
import { SHAPE_OPERATIONS, circuitOf, type ShapeOperation } from "@geosimples/core/figure";
import {
  BasisIcon,
  CurrentConventionalIcon,
  CurrentNoneIcon,
  CurrentRealIcon,
  SetElementsIcon,
  ShapeDifferenceIcon,
  ShapeExclusionIcon,
  ShapeIntersectionIcon,
  ShapeUnionIcon,
  TypeRegionIcon,
  TypeVectorIcon,
  Venn1Icon,
  Venn2Icon,
  Venn3Icon,
  VectorBetweenIcon,
  VectorIcon,
  WireIcon,
  AddPointIcon,
  AngleIcon,
  AxesIcon,
  CloseLoopIcon,
  ConnectIcon,
  ExtremumIcon,
  GraphPointIcon,
  GridIcon,
  GuidesIcon,
  NumberLineIcon,
  PolygonIcon,
  RootsIcon,
  TangentIcon,
  ToFunctionsIcon,
  VerticalLineIcon,
  YInterceptIcon,
} from "@/components/icons";
import { BOARD_ITEMS, CIRCLE_OPTIONS, CONSTRUCTIONS, SET_ITEMS, VECTOR_ITEMS } from "@/components/preview/tools";
import { COMPONENT_ITEMS } from "@/components/preview/circuitItems";
import { actions } from "@/lib/actions";
import { CONSTRUCTION_KINDS, type Availability, type CheckId, type InsertCheckId } from "@/lib/availability";
import type { FigureDoc } from "@geosimples/core/figure";
import type { AreaId } from "@/store/panelStore";

/** What a tool can read to say whether it runs now: the selection's checks and Inserir's. */
export interface ToolContext {
  av: Record<CheckId, Availability>;
  ins: Record<InsertCheckId, Availability>;
  doc: FigureDoc;
}

/** Things that need no selection. */
export const ALWAYS: Availability = { reason: null, preview: null };

export interface AreaTool {
  id: string;
  Icon: ComponentType;
  /** The name under the icon. */
  short: string;
  /** The full name, for the tooltip and screen readers. */
  title: string;
  hint: string;
  availability: (c: ToolContext) => Availability;
  run: (c: ToolContext) => void;
  /** Shown as pressed, like the current direction of the current. */
  active?: (c: ToolContext) => boolean;
}

export interface AreaGroup {
  title: string;
  tools: AreaTool[];
}

export interface Area {
  id: AreaId;
  title: string;
  Icon: ComponentType;
  groups: AreaGroup[];
}

/** Starts something typed in the input bar, with a balloon there saying what to type. */
const typing = (prefill: string, hint: string) => () => actions.startTyping(prefill, hint);

const SHAPE_ITEMS: { op: ShapeOperation; Icon: ComponentType; short: string; title: string; hint: string }[] = [
  { op: "union", Icon: ShapeUnionIcon, short: "União", title: "Preencher a união", hint: "Tudo o que as formas selecionadas cobrem." },
  { op: "inter", Icon: ShapeIntersectionIcon, short: "Interseção", title: "Preencher a interseção", hint: "Só onde todas as formas selecionadas se cruzam." },
  { op: "diff", Icon: ShapeDifferenceIcon, short: "Diferença", title: "Preencher a diferença", hint: "A primeira forma selecionada menos as outras." },
  { op: "xor", Icon: ShapeExclusionIcon, short: "Exclusão", title: "Preencher a exclusão", hint: "Onde só uma das duas formas cobre: tudo menos a interseção." },
];

/** The fills between shapes, for the Conjuntos tab and Propriedades. */
export const SHAPE_TOOLS = SHAPE_ITEMS.filter((s) => SHAPE_OPERATIONS.includes(s.op));

const BOARD_SHORT: Record<string, string> = {
  "Conta armada…": "Conta",
  "Fatoração em primos…": "Fatorar",
  "MMC…": "MMC",
  "MDC…": "MDC",
  "MDC por divisões sucessivas…": "Euclides",
  "Varal de intervalos…": "Varal",
  "Esboço de sinal…": "Sinal",
  "Quadro de sinais…": "Quadro",
  "Equação modular…": "Modular",
};

const CIRCLE_SHORT: Record<string, string> = { radius: "Raio 1", through: "Por ponto", tangent: "Tangente", circumcircle: "3 pontos" };

const CONSTRUCTION_SHORT: Record<string, string> = {
  midpoint: "Médio",
  altitude: "Altura",
  projection: "Projeção",
  median: "Mediana",
  bisector: "Bissetriz",
  perpendicularBisector: "Mediatriz",
  intersection: "Interseção",
};

const VECTOR_SHORT: Record<string, string> = {
  sum: "Soma",
  parallelogram: "Paralelog.",
  difference: "Diferença",
  projection: "Projeção",
  unit: "Versor",
  components: "Compon.",
  scale: "Múltiplo",
};

/**
 * Every tool, by the kind of figure it is for: what inserts something new
 * (most of it typed in the input bar) and what builds on the selection.
 * The tools panel and the phone's tabs both show these.
 */
export const AREAS: Area[] = [
  {
    id: "geometry",
    title: "Geometria",
    Icon: Shapes,
    groups: [
      {
        title: "Inserir",
        tools: [
          {
            id: "points",
            Icon: AddPointIcon,
            short: "Pontos",
            title: "Pontos",
            hint: "Digitados na barra, ou com um clique na prévia no modo Ponto.",
            availability: () => ALWAYS,
            run: typing("", "Digite pontos como A=(0;0) B=(4;0), e -- para ligar: A=(0;0)--B=(4;0)--C=(0;3)--"),
          },
          {
            id: "text",
            Icon: Type,
            short: "Texto",
            title: "Texto livre",
            hint: "Um texto solto, como “Figura 1”. Entra embaixo da figura; arraste no modo Mover.",
            availability: () => ALWAYS,
            run: typing("texto: ", "Digite o texto depois de texto:, como texto: Figura 1"),
          },
        ],
      },
      {
        title: "Com a seleção",
        tools: [
          {
            id: "connect",
            Icon: ConnectIcon,
            short: "Ligar",
            title: "Ligar em sequência",
            hint: "A, B, C → segmentos AB e BC.",
            availability: (c) => c.av.connect,
            run: () => actions.connect(false),
          },
          {
            id: "close",
            Icon: CloseLoopIcon,
            short: "Fechar",
            title: "Ligar fechando o contorno",
            hint: "A, B, C → segmentos AB, BC e CA.",
            availability: (c) => c.av.closeContour,
            run: () => actions.connect(true),
          },
          {
            id: "angle",
            Icon: AngleIcon,
            short: "Ângulo",
            title: "Marcar ângulo",
            hint: "A, B, C marca o ângulo em B; um polígono, todos os seus.",
            availability: (c) => c.av.angle,
            run: actions.angles,
          },
          {
            id: "polygon",
            Icon: PolygonIcon,
            short: "Polígono",
            title: "Polígono e preenchimento",
            hint: "Os vértices em ordem, ou um contorno fechado. Circunferências e polígonos selecionados são preenchidos.",
            availability: (c) => c.av.polygon,
            run: actions.polygon,
          },
          ...CIRCLE_OPTIONS.map(
            (o): AreaTool => ({
              id: `circle-${o.mode}`,
              Icon: o.Icon,
              short: CIRCLE_SHORT[o.mode],
              title: `Circunferência: ${o.title.toLowerCase()}`,
              hint: o.hint,
              availability: (c) => c.av[`circle-${o.mode}`],
              run: () => actions.circle(o.mode),
            }),
          ),
          ...CONSTRUCTION_KINDS.filter((k) => k !== "tangent").map(
            (kind): AreaTool => ({
              id: `construct-${kind}`,
              Icon: CONSTRUCTIONS[kind].Icon,
              short: CONSTRUCTION_SHORT[kind],
              title: CONSTRUCTIONS[kind].title,
              hint: CONSTRUCTIONS[kind].hint,
              availability: (c) => c.av[`construct-${kind}`],
              run: () => actions.construct(kind),
            }),
          ),
        ],
      },
    ],
  },
  {
    id: "graphs",
    title: "Gráficos",
    Icon: ChartSpline,
    groups: [
      {
        title: "Inserir",
        tools: [
          {
            id: "function",
            Icon: SquareFunction,
            short: "Função",
            title: "Gráfico de função",
            hint: "y = na barra de entrada. Os eixos vêm junto.",
            availability: () => ALWAYS,
            run: actions.startGraph,
          },
          {
            id: "vline",
            Icon: VerticalLineIcon,
            short: "Reta x =",
            title: "Reta vertical",
            hint: "x = na barra, como x = 2. Tracejada, como uma assíntota.",
            availability: () => ALWAYS,
            run: actions.startVerticalLine,
          },
          {
            id: "numberline",
            Icon: NumberLineIcon,
            short: "Reta num.",
            title: "Reta numérica",
            hint: "Intervalos na barra: [-2; 3[ ou ]-∞; 1].",
            availability: () => ALWAYS,
            run: actions.addNumberLine,
          },
          { id: "axes", Icon: AxesIcon, short: "Eixos", title: "Eixos", hint: "Sem gráfico também. Eles se ajustam à figura.", availability: (c) => c.ins.axes, run: actions.addAxes },
          {
            id: "grid",
            Icon: GridIcon,
            short: "Malha",
            title: "Malha quadriculada",
            hint: "Impressa, atrás da figura.",
            availability: (c) => c.ins.grid,
            run: actions.addGrid,
          },
        ],
      },
      {
        title: "Com a seleção",
        tools: [
          {
            id: "graphPoint",
            Icon: GraphPointIcon,
            short: "Ponto",
            title: "Ponto sobre o gráfico",
            hint: "Também P=f(2) na barra, ou um clique na curva.",
            availability: (c) => c.av.graphPoint,
            run: () => actions.pointOnGraph(),
          },
          {
            id: "tangent",
            Icon: TangentIcon,
            short: "Tangente",
            title: "Reta tangente",
            hint: "No ponto selecionado sobre o gráfico.",
            availability: (c) => c.av["construct-tangent"],
            run: () => actions.construct("tangent"),
          },
          { id: "roots", Icon: RootsIcon, short: "Raízes", title: "Raízes", hint: "x₁, x₂… Seguem a função.", availability: (c) => c.av["notable-root"], run: () => actions.markNotable("root") },
          {
            id: "extremum",
            Icon: ExtremumIcon,
            short: "Máx./mín.",
            title: "Máximos e mínimos",
            hint: "O vértice V, ou cada pico e vale.",
            availability: (c) => c.av["notable-extremum"],
            run: () => actions.markNotable("extremum"),
          },
          {
            id: "yAxis",
            Icon: YInterceptIcon,
            short: "Corte em y",
            title: "Corte no eixo y",
            hint: "O ponto (0; f(0)).",
            availability: (c) => c.av["notable-yAxis"],
            run: () => actions.markNotable("yAxis"),
          },
          { id: "guides", Icon: GuidesIcon, short: "Até os eixos", title: "Linhas até os eixos", hint: "Tracejadas, do ponto aos eixos.", availability: (c) => c.av.guides, run: actions.toggleGuides },
          {
            id: "toFunctions",
            Icon: ToFunctionsIcon,
            short: "Em funções",
            title: "Transformar em funções",
            hint: "Segmentos viram retas; circunferências, duas metades.",
            availability: (c) => c.av.toFunctions,
            run: actions.toFunctions,
          },
        ],
      },
    ],
  },
  {
    id: "vectors",
    title: "Vetores",
    Icon: VectorIcon,
    groups: [
      {
        title: "Inserir",
        tools: [
          {
            id: "typeVector",
            Icon: TypeVectorIcon,
            short: "Digitar",
            title: "Digitar vetor",
            hint: "vetor u=(3;2), ou vetor F=(5:30)@(1;1) em módulo e ângulo.",
            availability: () => ALWAYS,
            run: typing("vetor ", "Digite o vetor, como vetor u=(3;2), ou vetor F=(5:30)@(1;1) com módulo, ângulo e origem."),
          },
          { id: "basis", Icon: BasisIcon, short: "Versores", title: "Versores i e j", hint: "Saindo da origem.", availability: (c) => c.ins.basis, run: actions.basis },
        ],
      },
      {
        title: "Com a seleção",
        tools: [
          { id: "vector", Icon: VectorBetweenIcon, short: "Entre pontos", title: "Vetor entre pontos", hint: "A origem primeiro, depois a extremidade.", availability: (c) => c.av.vector, run: actions.vector },
          ...VECTOR_ITEMS.map(
            (item): AreaTool => ({
              id: `vector-${item.op}`,
              Icon: item.Icon,
              short: VECTOR_SHORT[item.op],
              title: item.title,
              hint: item.hint,
              availability: (c) => c.av[`vector-${item.op}`],
              run: () => actions.vectorOp(item.op),
            }),
          ),
        ],
      },
    ],
  },
  {
    id: "sets",
    title: "Conjuntos",
    Icon: Blend,
    groups: [
      {
        title: "Inserir",
        tools: [
          ...([1, 2, 3] as const).map(
            (n): AreaTool => ({
              id: `venn-${n}`,
              Icon: [Venn1Icon, Venn2Icon, Venn3Icon][n - 1],
              short: n === 1 ? "1 conjunto" : `${n} conjuntos`,
              title: n === 1 ? "Diagrama com 1 conjunto" : `Diagrama com ${n} conjuntos`,
              hint: "Dentro de um retângulo U. Arraste os círculos no modo Mover.",
              availability: (c) => c.ins[`venn-${n}`],
              run: () => actions.venn(n),
            }),
          ),
          {
            id: "members",
            Icon: SetElementsIcon,
            short: "Elementos",
            title: "Elementos de um conjunto",
            hint: "A={1,2,3}: cada um vai para a região certa. Ou n(A n B)=3.",
            availability: () => ALWAYS,
            run: typing("A={", "Digite os elementos, como A={1,2,3}, ou quantos há numa região, como n(A n B)=3."),
          },
          {
            id: "region",
            Icon: TypeRegionIcon,
            short: "Região",
            title: "Digitar região",
            hint: "região (A U B)' n C, com U para união e n para interseção.",
            availability: () => ALWAYS,
            run: typing("região ", "Digite a região, como região A n B, com U para união, n para interseção, - e '."),
          },
        ],
      },
      {
        title: "No diagrama",
        tools: SET_ITEMS.map(
          (item): AreaTool => ({
            id: `set-${item.op}`,
            Icon: item.Icon,
            short: item.title,
            title: item.title,
            hint: item.hint,
            availability: (c) => c.av[`set-${item.op}`],
            run: () => actions.setOperation(item.op),
          }),
        ),
      },
      {
        title: "Entre formas selecionadas",
        tools: SHAPE_TOOLS.map(
          (item): AreaTool => ({
            id: `shape-${item.op}`,
            Icon: item.Icon,
            short: item.short,
            title: item.title,
            hint: item.hint,
            availability: (c) => c.av[`shape-${item.op}`],
            run: () => actions.shapeOperation(item.op),
          }),
        ),
      },
    ],
  },
  {
    id: "circuits",
    title: "Circuitos",
    Icon: Zap,
    groups: [
      {
        title: "Inserir",
        tools: [
          ...COMPONENT_ITEMS.map(
            (item): AreaTool => ({
              id: `piece-${item.kind}`,
              Icon: item.Icon,
              short: item.title,
              title: item.title,
              hint: `Entra embaixo da figura. Arraste inteiro, ou pela ponta; uma ponta solta sobre outra se liga a ela. ${item.hint}`,
              availability: () => ALWAYS,
              run: () => actions.placeComponent(item.kind),
            }),
          ),
          {
            id: "wire",
            Icon: WireIcon,
            short: "Fio",
            title: "Fio",
            hint: "Para ligar pontas distantes: arraste cada ponta do fio até uma ponta de componente.",
            availability: () => ALWAYS,
            run: actions.placeWire,
          },
        ],
      },
      {
        title: "Circuito",
        tools: [
          {
            id: "power",
            Icon: Power,
            short: "Ligar",
            title: "Ligar circuito",
            hint: "Escreve a corrente e a tensão de cada componente, e o que os medidores marcam. De novo, desliga.",
            availability: (c) => c.av.circuitPower,
            run: (c) => actions.circuit({ on: !circuitOf(c.doc)?.on }),
            active: (c) => !!circuitOf(c.doc)?.on,
          },
          {
            id: "current-conventional",
            Icon: CurrentConventionalIcon,
            short: "Convencional",
            title: "Sentido convencional da corrente",
            hint: "Do polo positivo ao negativo, por fora do gerador.",
            availability: (c) => c.av["current-conventional"],
            run: () => actions.circuit({ current: "conventional" }),
            active: (c) => circuitOf(c.doc)?.current === "conventional",
          },
          {
            id: "current-real",
            Icon: CurrentRealIcon,
            short: "Real",
            title: "Sentido real da corrente (elétrons)",
            hint: "Do polo negativo ao positivo, por fora do gerador.",
            availability: (c) => c.av["current-real"],
            run: () => actions.circuit({ current: "real" }),
            active: (c) => circuitOf(c.doc)?.current === "real",
          },
          {
            id: "current-none",
            Icon: CurrentNoneIcon,
            short: "Sem setas",
            title: "Não indicar a corrente",
            hint: "Sem setas.",
            availability: (c) => c.av["current-none"],
            run: () => actions.circuit({ current: "none" }),
            active: (c) => circuitOf(c.doc)?.current === "none",
          },
        ],
      },
    ],
  },
  {
    id: "boards",
    title: "Contas",
    Icon: Calculator,
    groups: [
      {
        title: "Inserir",
        tools: BOARD_ITEMS.flatMap((item): AreaTool[] =>
          item === null
            ? []
            : [
                {
                  id: `board-${item.prefill}`,
                  Icon: item.Icon,
                  short: BOARD_SHORT[item.title] ?? item.title,
                  title: item.title.replace("…", ""),
                  hint: item.hint,
                  availability: () => ALWAYS,
                  run: typing(item.prefill, `Digite como em ${item.hint.split(/[,.]/)[0]}. Enter para pôr na figura.`),
                },
              ],
        ),
      },
    ],
  },
];
