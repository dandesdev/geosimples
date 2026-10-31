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

export const ExtremumIcon = (p: IconProps) => (
  <Icon {...p}>
    <MidAxis />
    <Parabola />
    <Dot cx={12} cy={17.5} />
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
