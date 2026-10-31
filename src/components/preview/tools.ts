import { Hand, Move, SquareDashedMousePointer } from "lucide-react";
import type { ComponentType } from "react";
import type { ConstructionKind } from "@geosimples/core/figure";
import {
  AddPointIcon,
  AltitudeIcon,
  BisectorIcon,
  CircleRadiusIcon,
  CircleTangentIcon,
  CircleThroughIcon,
  CircumcircleIcon,
  IntersectionIcon,
  MedianIcon,
  MidpointIcon,
  PerpendicularBisectorIcon,
  ProjectionIcon,
  QuickFigureIcon,
} from "@/components/icons";
import type { CanvasMode } from "@/store/figureStore";
import type { ActionId } from "@/store/prefsStore";

/* Names, hints and icons of the figure tools, shared by the toolbars and the preview's right-click menu. */

export const CONSTRUCTIONS: Record<ConstructionKind, { Icon: ComponentType; title: string; hint: string }> = {
  midpoint: {
    Icon: MidpointIcon,
    title: "Ponto médio",
    hint: "Divide um segmento, ou o caminho entre dois pontos, ao meio.",
  },
  altitude: {
    Icon: AltitudeIcon,
    title: "Altura",
    hint: "Do vértice até a reta do lado oposto, com ângulo reto. Com um triângulo, traça as três.",
  },
  projection: {
    Icon: ProjectionIcon,
    title: "Projeção ortogonal",
    hint: "Leva um ponto até a reta de um segmento (ou de dois pontos), com perpendicular tracejada e ângulo reto.",
  },
  median: {
    Icon: MedianIcon,
    title: "Mediana",
    hint: "Do vértice até o ponto médio do lado oposto. Com um triângulo, traça as três.",
  },
  bisector: {
    Icon: BisectorIcon,
    title: "Bissetriz",
    hint: "Divide o ângulo ao meio. Em um triângulo, vai até o lado oposto.",
  },
  perpendicularBisector: {
    Icon: PerpendicularBisectorIcon,
    title: "Mediatriz",
    hint: "Perpendicular ao segmento pelo seu ponto médio, com marca de ângulo reto (dá para apagar).",
  },
  intersection: {
    Icon: IntersectionIcon,
    title: "Interseção",
    hint: "Marca onde segmentos, circunferências, gráficos e retas verticais selecionados se cruzam.",
  },
};

/** The ways to build a circle, for the toolbar and the preview's menu. */
export const CIRCLE_OPTIONS = [
  {
    mode: "radius",
    Icon: CircleRadiusIcon,
    title: "Centro e raio 1",
    hint: "Selecione o centro. Ajuste o raio depois, em Propriedades.",
  },
  {
    mode: "through",
    Icon: CircleThroughIcon,
    title: "Centro e um ponto",
    hint: "Selecione o centro e depois um ponto da circunferência.",
  },
  {
    mode: "tangent",
    Icon: CircleTangentIcon,
    title: "Centro e tangente",
    hint: "Selecione o centro e um segmento a tangenciar.",
  },
  {
    mode: "circumcircle",
    Icon: CircumcircleIcon,
    title: "Por três pontos",
    hint: "Selecione três pontos. O centro é criado como um novo ponto.",
  },
] as const;

/** What a press or drag in the preview does. */
export const MODES: { mode: CanvasMode; action: ActionId; label: string; hint: string; Icon: ComponentType }[] = [
  {
    mode: "select",
    action: "modeSelect",
    label: "Selecionar",
    hint: "Arraste para selecionar o que estiver dentro da caixa. Shift soma à seleção.",
    Icon: SquareDashedMousePointer,
  },
  {
    mode: "pan",
    action: "modePan",
    label: "Mover a vista",
    hint: "Arraste para deslocar a prévia.",
    Icon: Hand,
  },
  {
    mode: "move",
    action: "modeMove",
    label: "Mover",
    hint: "Arraste pontos, segmentos, polígonos e circunferências. Os quadradinhos nas pontas dos eixos, da malha e das retas mudam o tamanho delas.",
    Icon: Move,
  },
  {
    mode: "add",
    action: "modeAdd",
    label: "Adicionar pontos",
    hint: "Clique na prévia para criar um ponto ali. Segure o botão para Figura rápida.",
    Icon: AddPointIcon,
  },
  {
    mode: "figure",
    action: "modeFigure",
    label: "Figura rápida",
    hint: "Cada clique põe um vértice ligado ao anterior; o terceiro fecha o polígono, com preenchimento e ângulos.",
    Icon: QuickFigureIcon,
  },
];
