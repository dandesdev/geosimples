import { useState, useEffect, useRef, useMemo } from "react";
import { getCssVarAsHex, clearCssVarCache } from "@/utils/colors";

/**
 * Hook to get a CSS variable as a hex color for use in SVG attributes.
 *
 * SVG fill/stroke attributes cannot use CSS variables directly.
 * This hook resolves the variable to a hex value on mount and when theme changes.
 *
 * @param cssVar - CSS variable name (e.g., "--color-primary")
 * @param fallback - Fallback hex color if variable not found
 * @returns Hex color string
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const primaryColor = useCssVar("--color-primary", "#10b981");
 *   return <circle fill={primaryColor} />;
 * }
 * ```
 */
export function useCssVar(cssVar: string, fallback = "#888888"): string {
  const [color, setColor] = useState(fallback);

  useEffect(() => {
    // Resolve the CSS variable to hex
    const resolved = getCssVarAsHex(cssVar);
    setColor(resolved || fallback);

    // Listen for theme changes (class toggle on documentElement)
    const observer = new MutationObserver(() => {
      clearCssVarCache();
      const newColor = getCssVarAsHex(cssVar);
      setColor(newColor || fallback);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [cssVar, fallback]);

  return color;
}

/**
 * Hook to get multiple CSS variables as hex colors.
 * More efficient than multiple useCssVar calls.
 *
 * @param vars - Object mapping keys to CSS variable names
 * @returns Object with same keys but hex color values
 *
 * @example
 * ```tsx
 * const colors = useCssVars({
 *   primary: "--color-primary",
 *   muted: "--color-muted",
 * });
 * // colors.primary = "#10b981"
 * // colors.muted = "#e5e5e5"
 * ```
 */
export function useCssVars<T extends Record<string, string>>(
  vars: T,
): Record<keyof T, string> {
  // Memoize the vars object to prevent infinite loops
  // We serialize the object to compare values, not references
  const varsRef = useRef(vars);
  const varsKey = useMemo(() => JSON.stringify(vars), [vars]);

  // Update ref when vars actually change (by value)
  useEffect(() => {
    varsRef.current = vars;
  }, [varsKey]);

  const [colors, setColors] = useState<Record<keyof T, string>>(() => {
    const initial = {} as Record<keyof T, string>;
    for (const key of Object.keys(vars) as Array<keyof T>) {
      initial[key] = "#888888";
    }
    return initial;
  });

  useEffect(() => {
    const currentVars = varsRef.current;

    const resolve = () => {
      const resolved = {} as Record<keyof T, string>;
      for (const key of Object.keys(currentVars) as Array<keyof T>) {
        resolved[key] = getCssVarAsHex(currentVars[key]);
      }
      setColors(resolved);
    };

    resolve();

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      clearCssVarCache();
      resolve();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [varsKey]); // Use serialized key instead of object reference

  return colors;
}
