import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const Dot = ({ cx, cy }: { cx: number; cy: number }) => (
  <circle cx={cx} cy={cy} r={1.8} fill="currentColor" stroke="none" />
);

const LENS = "M12 6.8 A6 6 0 0 1 12 17.2 A6 6 0 0 1 12 6.8 Z";

/* The Venn operations: what the operation keeps is solid, the rest a faint outline, so they read at 18 px. */
const FAINT = 0.45;

export const SetUnionIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 6.8a6 6 0 1 1 0 10.4 6 6 0 1 1 0-10.4z" fill="currentColor" />
  </Icon>
);

export const SetIntersectionIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx={9} cy={12} r={6} strokeOpacity={FAINT} />
    <circle cx={15} cy={12} r={6} strokeOpacity={FAINT} />
    <path d={LENS} fill="currentColor" stroke="none" />
  </Icon>
);

export const SetDifferenceIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx={15} cy={12} r={6} strokeOpacity={FAINT} />
    <path d="M12 6.8a6 6 0 1 0 0 10.4 6 6 0 0 1 0-10.4z" fill="currentColor" />
  </Icon>
);

export const SetComplementIcon = (p: IconProps) => (
  <Icon {...p}>
    {/* Even-odd leaves the circle empty, showing whatever is behind the icon. */}
    <path d="M2 4 H22 V20 H2 Z M6.5 12 A5.5 5.5 0 1 0 17.5 12 A5.5 5.5 0 1 0 6.5 12 Z" fill="currentColor" fillOpacity={0.45} fillRule="evenodd" strokeWidth={1.2} />
  </Icon>
);

export const AddPointIcon = (p: IconProps) => (
  <Icon {...p}>
    <Dot cx={9} cy={15} />
    <path d="M17 4 L17 12 M13 8 L21 8" />
    <path d="M4 20 L20 20" strokeWidth={1.1} strokeDasharray="2 2" />
  </Icon>
);

export const QuickFigureIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19 L10 7 L16 19 Z" fill="currentColor" fillOpacity={0.2} />
    <Dot cx={4} cy={19} />
    <Dot cx={10} cy={7} />
    <Dot cx={16} cy={19} />
    <path d="M19 3 L19 9 M16 6 L22 6" />
  </Icon>
);

export const ConnectIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 17 L12 7 L19 15" />
    <Dot cx={5} cy={17} />
    <Dot cx={12} cy={7} />
    <Dot cx={19} cy={15} />
  </Icon>
);

export const CloseLoopIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 17 L12 5 L19 17 Z" />
    <Dot cx={5} cy={17} />
    <Dot cx={12} cy={5} />
    <Dot cx={19} cy={17} />
  </Icon>
);

export const AngleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 6 L5 18 L20 18" />
    <path d="M12 18 A7 7 0 0 0 10.5 13.6" />
    <path d="M5 18 L12 18 A7 7 0 0 0 10.5 13.6 Z" fill="currentColor" fillOpacity={0.2} stroke="none" />
  </Icon>
);

export const PolygonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4 L20 10 L17 19 L7 19 L4 10 Z" fill="currentColor" fillOpacity={0.25} />
  </Icon>
);

export const CircleRadiusIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx={12} cy={12} r={8} />
    <Dot cx={12} cy={12} />
  </Icon>
);

export const CircleThroughIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx={12} cy={12} r={8} />
    <path d="M12 12 L17.7 6.3" strokeDasharray="2 2" />
    <Dot cx={12} cy={12} />
    <Dot cx={17.7} cy={6.3} />
  </Icon>
);

export const CircleTangentIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx={12} cy={10} r={6.5} />
    <path d="M3 16.5 L21 16.5" />
    <Dot cx={12} cy={10} />
  </Icon>
);

export const CircumcircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx={12} cy={12} r={8.5} />
    <path d="M12 3.5 L19.4 16.2 L4.6 16.2 Z" strokeWidth={1.2} />
  </Icon>
);

/** Base triangle of the construction icons. */
const Tri = () => <path d="M3.5 19 L20.5 19 L9 5 Z" strokeWidth={1.2} />;

export const ConstructionsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 19 L20.5 19 L9 5 Z" strokeWidth={1.2} />
    <path d="M9 5 L9 19" />
    <path d="M9 16.5 L11.5 16.5 L11.5 19" strokeWidth={1.1} />
  </Icon>
);

export const MidpointIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 17 L21 7" />
    <path d="M7.4 12.4 L8.6 14.6 M15.4 7.9 L16.6 10.1" strokeWidth={1.2} />
    <Dot cx={3} cy={17} />
    <Dot cx={21} cy={7} />
    <circle cx={12} cy={12} r={2.2} fill="currentColor" stroke="none" />
  </Icon>
);

export const AltitudeIcon = (p: IconProps) => (
  <Icon {...p}>
    <Tri />
    <path d="M9 5 L9 19" />
    <path d="M9 16.5 L11.5 16.5 L11.5 19" strokeWidth={1.1} />
  </Icon>
);

export const ProjectionIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 18 L21 18" />
    <path d="M12 6 L12 18" strokeDasharray="2 2" />
    <path d="M12 15.5 L14.5 15.5 L14.5 18" strokeWidth={1.1} />
    <Dot cx={12} cy={6} />
    <Dot cx={12} cy={18} />
  </Icon>
);

export const MedianIcon = (p: IconProps) => (
  <Icon {...p}>
    <Tri />
    <path d="M9 5 L12 19" />
    <Dot cx={12} cy={19} />
  </Icon>
);

export const BisectorIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 5 L4 19 L21 19" />
    <path d="M4 19 L20 12" strokeDasharray="2.5 2" />
    <path d="M10 19 A6 6 0 0 0 8.5 15" strokeWidth={1.1} />
  </Icon>
);

export const PerpendicularBisectorIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 15 L21 15" />
    <path d="M12 4 L12 21" strokeDasharray="2.5 2" />
    <path d="M12 12.5 L14.5 12.5 L14.5 15" strokeWidth={1.1} />
    <Dot cx={3} cy={15} />
    <Dot cx={21} cy={15} />
  </Icon>
);

export const IntersectionIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 18 L20 6" />
    <path d="M4 6 L20 18" />
    <circle cx={12} cy={12} r={2.2} fill="currentColor" stroke="none" />
  </Icon>
);

/* Graph tools: thin axes in the corner, the curve or mark on top. */
const MiniAxes = () => <path d="M3 21 L21 21 M3 21 L3 3" strokeWidth={1.1} />;

export const GraphPointIcon = (p: IconProps) => (
  <Icon {...p}>
    <MiniAxes />
    <path d="M5 19 C9 18 13 13 20 5" />
    <Dot cx={14} cy={11.5} />
  </Icon>
);

export const TangentIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7 Q12 25 21 7" />
    <path d="M10.5 19.75 L21.5 8.75" strokeWidth={1.4} />
    <Dot cx={16.5} cy={13.75} />
  </Icon>
);

export const VerticalLineIcon = (p: IconProps) => (
  <Icon {...p}>
    <MiniAxes />
    <path d="M14 4 L14 19" strokeDasharray="2.5 2" />
  </Icon>
);

export const GuidesIcon = (p: IconProps) => (
  <Icon {...p}>
    <MiniAxes />
    <path d="M14 9 L14 20 M14 9 L4 9" strokeWidth={1.1} strokeDasharray="2 2" />
    <Dot cx={14} cy={9} />
  </Icon>
);

/* A parabola over a centered x axis, for the notable points. */
const MidAxis = () => <path d="M2 14 L22 14" strokeWidth={1.1} />;
const Parabola = () => <path d="M5 4 C8 22 16 22 19 4" />;

export const RootsIcon = (p: IconProps) => (
  <Icon {...p}>
    <MidAxis />
    <Parabola />
    <Dot cx={7.3} cy={14} />
    <Dot cx={16.7} cy={14} />
  </Icon>
);

/** A hill with its top marked, the other way up from Raízes' cup, so the two never look alike. */
export const ExtremumIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 20Q12-6 19 20" />
    <circle cx={12} cy={7} r={2.2} fill="currentColor" stroke="none" />
  </Icon>
);

export const YInterceptIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3 L9 21" strokeWidth={1.1} />
    <path d="M3 18 L21 6" />
    <Dot cx={9} cy={14} />
  </Icon>
);

export const NumberLineIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 14 L21 14 M18 11.5 L21 14 L18 16.5" strokeWidth={1.1} />
    <path d="M4 12.5 V15.5" strokeWidth={1.1} />
    <path d="M7 14 L15 14" strokeWidth={2.6} />
    <circle cx={7} cy={14} r={1.9} fill="currentColor" stroke="none" />
    <circle cx={15} cy={14} r={1.9} className="fill-background" strokeWidth={1.2} />
  </Icon>
);

export const ToFunctionsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 9 L3 3 L9 3" strokeWidth={1.1} strokeDasharray="2 2" />
    <path d="M10 14 L12.5 16.5 L10 19" strokeWidth={1.2} />
    <path d="M14 21 C15 12 18 10 21 9" />
    <path d="M3 13 C6 13 6 4 9 4" strokeWidth={1.1} />
  </Icon>
);

export const Logo = (p: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M4 19 L12 5 L20 19 Z" fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M7.2 19 A3.4 3.4 0 0 0 5.7 16" fill="none" stroke="currentColor" strokeWidth={1.4} />
    <circle cx={4} cy={19} r={1.7} fill="currentColor" />
    <circle cx={12} cy={5} r={1.7} fill="currentColor" />
    <circle cx={20} cy={19} r={1.7} fill="currentColor" />
  </svg>
);

export const AxesIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 15 L21 15 M18.5 12.5 L21 15 L18.5 17.5" strokeWidth={1.3} />
    <path d="M9 21 L9 3 M6.5 5.5 L9 3 L11.5 5.5" strokeWidth={1.3} />
    <path d="M13 13.5 V16.5 M17 13.5 V16.5 M7.5 11 H10.5 M7.5 7 H10.5" strokeWidth={1.1} />
  </Icon>
);

export const GridIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4 H20 V20 H4 Z M9.33 4 V20 M14.67 4 V20 M4 9.33 H20 M4 14.67 H20" strokeWidth={1.1} />
  </Icon>
);

export const FitIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8 V3 H8 M16 3 H21 V8 M21 16 V21 H16 M8 21 H3 V16" strokeWidth={1.3} />
    <path d="M8 15 C10 9 14 9 16 15" />
  </Icon>
);

/* Circuit pieces, as their symbols on a wire. */

export const ResistorIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12h4l1.5-4 3 8 3-8 3 8 1.5-4h4" />
  </Icon>
);

export const LampIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12h4.5M17.5 12H22" />
    <circle cx={12} cy={12} r={5.5} />
    <path d="M8.1 8.1l7.8 7.8M15.9 8.1l-7.8 7.8" />
  </Icon>
);

export const SourceIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12h8.5M13.5 12H22M13.5 5v14" />
    <path d="M10.5 8.5v7" strokeWidth={3} />
  </Icon>
);

export const SwitchIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12h4.5M17.5 12H22M7 12l9.5-5" />
    <circle cx={6.5} cy={12} r={1.2} />
    <circle cx={17.5} cy={12} r={1.2} />
  </Icon>
);

/** An ammeter or a voltmeter: a circle with its letter. */
export const MeterIcon = ({ letter, ...p }: IconProps & { letter: "A" | "V" }) => (
  <Icon {...p}>
    <path d="M2 12h4M18 12h4" />
    <circle cx={12} cy={12} r={6} />
    <text x={12} y={15.2} textAnchor="middle" fontSize={9} fill="currentColor" stroke="none" fontFamily="serif">
      {letter}
    </text>
  </Icon>
);

export const CapacitorIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12h8.5M13.5 12H22M10.5 6v12M13.5 6v12" />
  </Icon>
);

/** A loop with a source and a resistor: a whole circuit. */
export const CircuitIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9V5h4l1-2 2 4 2-4 2 4 1-2h4v14H4v-6" />
    <path d="M2 9h4M3 11h2" />
  </Icon>
);

/* Vectors: a filled head, as vectors are drawn in figures. Axes and number lines have open heads. */

const DOTTED = "1.4 2.2";
const r2 = (v: number) => Math.round(v * 100) / 100;

/** A vector from (x1, y1) to (x2, y2): the shaft up to a filled head. `dotted` dots the shaft. */
function Arrow({ x1, y1, x2, y2, head = 5.5, dotted = false }: { x1: number; y1: number; x2: number; y2: number; head?: number; dotted?: boolean }) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const bx = x2 - ux * head;
  const by = y2 - uy * head;
  const half = head * 0.5;
  return (
    <>
      <path d={`M${x1} ${y1}L${r2(bx + ux)} ${r2(by + uy)}`} strokeDasharray={dotted ? DOTTED : undefined} />
      <path
        d={`M${x2} ${y2}L${r2(bx - uy * half)} ${r2(by + ux * half)}L${r2(bx + uy * half)} ${r2(by - ux * half)}Z`}
        fill="currentColor"
        strokeWidth={1}
      />
    </>
  );
}

/** The Vetores tab: one vector. */
export const VectorIcon = (p: IconProps) => (
  <Icon {...p}>
    <Arrow x1={5} y1={19} x2={19} y2={5} />
  </Icon>
);

/** Digitar vetor: a vector with its coordinates dotted at the tip. */
export const TypeVectorIcon = (p: IconProps) => (
  <Icon {...p}>
    <Arrow x1={4} y1={20} x2={17} y2={7} />
    <path d="M8 4h12v11" strokeDasharray={DOTTED} />
  </Icon>
);

/** Versores i e j: two short vectors from the origin, the axes going on dotted. */
export const BasisIcon = (p: IconProps) => (
  <Icon {...p}>
    <Arrow x1={5} y1={19} x2={5} y2={7.5} head={4.5} />
    <Arrow x1={5} y1={19} x2={16.5} y2={19} head={4.5} />
    <path d="M5 5V2.5M19 19h2.5" strokeDasharray={DOTTED} />
  </Icon>
);

/** Vetor entre pontos: a vector between two points. */
export const VectorBetweenIcon = (p: IconProps) => (
  <Icon {...p}>
    <Dot cx={4.5} cy={19.5} />
    <Dot cx={19.5} cy={4.5} />
    <Arrow x1={6.5} y1={17.5} x2={17.2} y2={6.8} />
  </Icon>
);

/** Soma pela regra do polígono: two vectors tip to tail, the dashed resultant closing them. */
export const VectorSumIcon = (p: IconProps) => (
  <Icon {...p}>
    <Arrow x1={3} y1={18} x2={10} y2={5} head={5} />
    <Arrow x1={10} y1={5} x2={21} y2={12} head={5} />
    <path d="M3 18.5 19.5 13" strokeDasharray="2 2.5" />
  </Icon>
);

/** Soma pelo paralelogramo: the dashed parallelogram and its diagonal. */
export const VectorParallelogramIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19h11l5-11H9z" strokeDasharray="2 2.5" />
    <Arrow x1={4} y1={19} x2={20} y2={8} />
  </Icon>
);

/** Diferença: two vectors from one point, the difference from the tip of the second to the tip of the first. */
export const VectorDifferenceIcon = (p: IconProps) => (
  <Icon {...p}>
    <Arrow x1={3} y1={13} x2={14} y2={3.5} head={5} />
    <Arrow x1={3} y1={13} x2={20} y2={20} head={5} />
    <Arrow x1={20} y1={20} x2={16} y2={5.5} head={5} />
  </Icon>
);

/** Projeção: a vector, and the projection along the other direction up to the dotted perpendicular. */
export const VectorProjectionIcon = (p: IconProps) => (
  <Icon {...p}>
    <Arrow x1={3} y1={18} x2={18.5} y2={6} />
    <Arrow x1={3} y1={18} x2={18.5} y2={18} />
    <path d="M20.5 3v18" strokeDasharray={DOTTED} />
  </Icon>
);

/** Versor: a short vector, its direction going on dotted. */
export const UnitVectorIcon = (p: IconProps) => (
  <Icon {...p}>
    <Arrow x1={4} y1={20} x2={11.5} y2={12.5} />
    <path d="M14 10 20 4" strokeDasharray={DOTTED} />
  </Icon>
);

/** Componentes: a vector and its dashed horizontal and vertical legs. */
export const VectorComponentsIcon = (p: IconProps) => (
  <Icon {...p}>
    <Arrow x1={5} y1={19} x2={19} y2={5} />
    <path d="M5 19h14V9" strokeDasharray="2 2.5" />
  </Icon>
);

/** Múltiplo: three short vectors in a row beside one three times as long. */
export const VectorMultipleIcon = (p: IconProps) => (
  <Icon {...p}>
    <Arrow x1={2.5} y1={16.5} x2={6.8} y2={12.2} head={3.8} />
    <Arrow x1={6.8} y1={12.2} x2={11.1} y2={7.9} head={3.8} />
    <Arrow x1={11.1} y1={7.9} x2={15.4} y2={3.6} head={3.8} />
    <Arrow x1={8} y1={21} x2={21} y2={8} />
  </Icon>
);

/* Circuits: the current's arrows are filled in the figure, as here. */

export const CurrentConventionalIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12h5M4.5 9.5v5" />
    <Arrow x1={9} y1={12} x2={22} y2={12} />
  </Icon>
);

export const CurrentRealIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx={18} cy={12} r={4} />
    <path d="M16 12h4" />
    <Arrow x1={12} y1={12} x2={2} y2={12} />
  </Icon>
);

export const CurrentNoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <Arrow x1={3} y1={12} x2={19} y2={12} />
    <path d="M5 20 19 4" />
  </Icon>
);

/** Fio: a bent wire between two terminals. */
export const WireIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx={4.5} cy={16} r={2} />
    <circle cx={19.5} cy={8} r={2} />
    <path d="M6.5 16H12V8h5.5" />
  </Icon>
);

/* Conjuntos: the diagrams by how many sets, inside the universe U. */

export const Venn1Icon = (p: IconProps) => (
  <Icon {...p}>
    <rect x={3} y={5} width={18} height={14} rx={1.5} />
    <circle cx={12} cy={12} r={4} />
  </Icon>
);

export const Venn2Icon = (p: IconProps) => (
  <Icon {...p}>
    <rect x={2} y={5} width={20} height={14} rx={1.5} />
    <circle cx={9.5} cy={12} r={4} />
    <circle cx={14.5} cy={12} r={4} />
  </Icon>
);

export const Venn3Icon = (p: IconProps) => (
  <Icon {...p}>
    <rect x={2} y={3} width={20} height={18} rx={1.5} />
    <circle cx={9.5} cy={9.5} r={3.6} />
    <circle cx={14.5} cy={9.5} r={3.6} />
    <circle cx={12} cy={14} r={3.6} />
  </Icon>
);

/** Elementos de um conjunto: braces with elements, as in A={1,2}. */
export const SetElementsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 4c-2 0-3 1-3 3v2.5C5 11 4 12 3 12c1 0 2 1 2 2.5V17c0 2 1 3 3 3" />
    <path d="M16 4c2 0 3 1 3 3v2.5c0 1.5 1 2.5 2 2.5-1 0-2 1-2 2.5V17c0 2-1 3-3 3" />
    <circle cx={10} cy={12} r={1.6} fill="currentColor" stroke="none" />
    <circle cx={14} cy={12} r={1.6} fill="currentColor" stroke="none" />
  </Icon>
);

/** Digitar região: a text cursor and the region shaded. */
export const TypeRegionIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 5h4M4 5v14M2 19h4" />
    <circle cx={13} cy={12} r={4.5} />
    <circle cx={18} cy={12} r={4.5} />
    <path d="M15.5 8.26a4.5 4.5 0 0 1 0 7.48 4.5 4.5 0 0 1 0-7.48z" fill="currentColor" fillOpacity={0.45} stroke="none" />
  </Icon>
);

/* Fills between any selected shapes: a square and a circle, so they don't read as the Venn operations. */

const ShapesOutline = () => (
  <>
    <rect x={3} y={3} width={12} height={12} strokeOpacity={FAINT} />
    <circle cx={15} cy={15} r={6} strokeOpacity={FAINT} />
  </>
);

export const ShapeUnionIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 3h12v6a6 6 0 1 1-6 6H3z" fill="currentColor" />
  </Icon>
);

export const ShapeIntersectionIcon = (p: IconProps) => (
  <Icon {...p}>
    <ShapesOutline />
    <path d="M15 9v6H9a6 6 0 0 1 6-6z" fill="currentColor" stroke="none" />
  </Icon>
);

export const ShapeDifferenceIcon = (p: IconProps) => (
  <Icon {...p}>
    <ShapesOutline />
    <path d="M3 3h12v6a6 6 0 0 0-6 6H3z" fill="currentColor" stroke="none" />
  </Icon>
);

export const ShapeExclusionIcon = (p: IconProps) => (
  <Icon {...p}>
    <ShapesOutline />
    <path d="M3 3h12v6a6 6 0 0 0-6 6H3zM15 9a6 6 0 1 1-6 6h6z" fill="currentColor" stroke="none" />
  </Icon>
);

/* Contas: one picture per kind of board. */

/** Conta armada: an addition in columns. */
export const ColumnSumIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8.5h4M5 6.5v4" />
    <path d="M11 6h9M11 11h9" />
    <path d="M3 15h18" />
    <path d="M11 19.5h9" />
  </Icon>
);

/** Fatoração em primos: the bar, the numbers getting smaller, the primes beside it. */
export const FactorIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 3v18" />
    <path d="M3 6h7M5 12h5M7 18h3" />
    <circle cx={18} cy={6} r={1.6} fill="currentColor" stroke="none" />
    <circle cx={18} cy={12} r={1.6} fill="currentColor" stroke="none" />
    <circle cx={18} cy={18} r={1.6} fill="currentColor" stroke="none" />
  </Icon>
);

/** MMC: two small numbers lead to a bigger one, their common multiple. */
export const LcmIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx={4.5} cy={6} r={2} fill="currentColor" stroke="none" />
    <circle cx={4.5} cy={18} r={2} fill="currentColor" stroke="none" />
    <path d="M7.5 7.5l4.5 2.5M7.5 16.5l4.5-2.5" />
    <circle cx={17} cy={12} r={5} fill="currentColor" fillOpacity={0.45} />
  </Icon>
);

/** MDC: two big numbers lead to a smaller one, their common divisor. */
export const GcdIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx={6.5} cy={6.5} r={4} />
    <circle cx={6.5} cy={17.5} r={4} />
    <path d="M11.5 8.5l4 2M11.5 15.5l4-2" />
    <circle cx={19} cy={12} r={2.2} fill="currentColor" stroke="none" />
  </Icon>
);

/** MDC por divisões sucessivas: the tic-tac-toe table of Euclid's algorithm. */
export const EuclidIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4v16M15 4v16M4 9h16M4 15h16" />
  </Icon>
);

/** Varal: an interval on each of two lines, and the result on the third. */
export const IntervalsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" strokeOpacity={0.3} />
    <path d="M4 6h10M10 12h10M10 18h4" strokeWidth={3.2} />
  </Icon>
);

/** Esboço de sinal: the curve over the line, positive outside its roots and negative between. */
export const SignSketchIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 14h20" />
    <path d="M8 4Q12 28 16 4" />
    <path d="M2 8h4M4 6v4M18 8h4M20 6v4" />
    <path d="M10.5 20h3" />
  </Icon>
);

/** Quadro de sinais: a table of signs. */
export const SignTableIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x={3} y={4} width={18} height={16} rx={1.5} />
    <path d="M3 12h18M12 4v16" />
    <path d="M6 8h3M7.5 6.5v3M15 8h3M6 16h3M15 16h3M16.5 14.5v3" />
  </Icon>
);

/** Equação modular: |x|. */
export const AbsoluteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4v16M19 4v16" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </Icon>
);
