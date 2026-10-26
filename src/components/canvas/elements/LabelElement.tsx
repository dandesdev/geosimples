import type { Label } from "@/geometry/types";

interface LabelElementProps {
  label: Label;
}

export function LabelElement({ label }: LabelElementProps) {
  return (
    <text
      x={label.x}
      y={label.y}
      fill={label.style.color}
      fontSize={label.style.fontSize}
      fontFamily={label.style.fontFamily}
      style={{ opacity: label.style.opacity }}
    >
      {label.text}
    </text>
  );
}
