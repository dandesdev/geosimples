import { useEffect, useState } from "react";
import { useTotalScale } from "@/hooks/useTotalScale";

/**
 * Convert CSS variable to hex color by reading computed style from DOM
 */
function getCssVariableAsHex(variableName: string): string {
  if (typeof window === "undefined") return "#00bcd4"; // fallback cyan

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
  return "#00bcd4";
}

interface SelectionGlowFilterProps {
  id?: string;
}

export function SelectionGlowFilter({
  id = "selection-glow",
}: SelectionGlowFilterProps) {
  const [glowColor, setGlowColor] = useState("#00bcd4");
  const { totalScale } = useTotalScale();

  // Filter values in world units (scaled from pixel values)
  const morphRadius = 2 / totalScale; // 2px
  const blurStdDev = 1 / totalScale; // 1px

  useEffect(() => {
    // Read the primary color from CSS variable
    const color = getCssVariableAsHex("--color-primary");
    setGlowColor(color);

    // Re-read on theme change (observe html class changes)
    const observer = new MutationObserver(() => {
      const newColor = getCssVariableAsHex("--color-primary");
      setGlowColor(newColor);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <filter
      id={id}
      x="-100%"
      y="-100%"
      width="300%"
      height="300%"
      filterUnits="userSpaceOnUse"
    >
      <feFlood result="flood" floodColor={glowColor} floodOpacity="1" />
      <feComposite in="flood" result="mask" in2="SourceGraphic" operator="in" />
      <feMorphology
        in="mask"
        result="dilated"
        operator="dilate"
        radius={morphRadius}
      />
      <feGaussianBlur in="dilated" result="blurred" stdDeviation={blurStdDev} />
      <feComposite
        in="blurred"
        in2="SourceGraphic"
        operator="arithmetic"
        k2="1"
        k3="-1"
        result="nocombine"
      />
      <feMerge>
        <feMergeNode in="nocombine" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}
