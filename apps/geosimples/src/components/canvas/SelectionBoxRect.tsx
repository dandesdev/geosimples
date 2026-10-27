import { useEffect, useState } from "react";

/**
 * Convert CSS variable to hex color by reading computed style from DOM
 */
function getCssVariableAsHex(variableName: string): string {
  if (typeof window === "undefined") return "#10b981"; // fallback emerald

  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(variableName).trim();

  // If it's already a hex color
  if (value.startsWith("#")) return value;

  // If it's rgb format like "0 188 212" (Tailwind style) or "rgb(0, 188, 212)"
  const rgbMatch = value.match(/(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `#${parseInt(r).toString(16).padStart(2, "0")}${parseInt(g).toString(16).padStart(2, "0")}${parseInt(b).toString(16).padStart(2, "0")}`;
  }

  // Fallback
  return "#10b981";
}

interface SelectionBoxRectProps {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Current transform scale for consistent stroke width */
  scale: number;
}

/**
 * Selection box rectangle with proper CSS variable color conversion.
 * Uses primary color from CSS variables, converted to hex for SVG compatibility.
 */
export function SelectionBoxRect({
  x,
  y,
  width,
  height,
  scale,
}: SelectionBoxRectProps) {
  const [strokeColor, setStrokeColor] = useState("#10b981");

  useEffect(() => {
    // Read the primary color from CSS variable
    const color = getCssVariableAsHex("--color-primary");
    setStrokeColor(color);

    // Re-read on theme change (observe html class changes)
    const observer = new MutationObserver(() => {
      const newColor = getCssVariableAsHex("--color-primary");
      setStrokeColor(newColor);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="none"
      stroke={strokeColor}
      strokeWidth={1.5 / scale}
      strokeDasharray={`${4 / scale},${4 / scale}`}
      pointerEvents="none"
    />
  );
}
