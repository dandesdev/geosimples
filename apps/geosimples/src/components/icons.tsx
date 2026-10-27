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

export const Logo = (p: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M4 19 L12 5 L20 19 Z" fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M7.2 19 A3.4 3.4 0 0 0 5.7 16" fill="none" stroke="currentColor" strokeWidth={1.4} />
    <circle cx={4} cy={19} r={1.7} fill="currentColor" />
    <circle cx={12} cy={5} r={1.7} fill="currentColor" />
    <circle cx={20} cy={19} r={1.7} fill="currentColor" />
  </svg>
);
