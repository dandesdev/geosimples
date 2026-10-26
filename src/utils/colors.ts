/**
 * Utilities for working with colors in SVG elements.
 *
 * SVG fill/stroke attributes cannot use CSS variables directly.
 * These utilities help convert CSS variables to usable hex values.
 */

/**
 * Cache for resolved CSS variable values to avoid repeated DOM access.
 */
const cssVarCache = new Map<string, string>();

/**
 * Resolves a CSS variable to its computed hex value.
 *
 * CSS variables like `--color-primary` cannot be used directly in SVG
 * fill/stroke attributes. This function reads the computed value from
 * the DOM and converts it to a hex color that SVG can use.
 *
 * @param cssVar - CSS variable name (with or without `var()` wrapper)
 * @returns Hex color string (e.g., "#10b981") or fallback
 *
 * @example
 * ```ts
 * const color = getCssVarAsHex("--color-primary"); // "#10b981"
 * const color2 = getCssVarAsHex("var(--color-muted)"); // "#e5e5e5"
 * ```
 */
export function getCssVarAsHex(cssVar: string): string {
  // Clean up the variable name - remove var() wrapper if present
  const varName = cssVar
    .replace(/^var\(/, "")
    .replace(/\)$/, "")
    .trim();

  // Check cache first
  if (cssVarCache.has(varName)) {
    return cssVarCache.get(varName)!;
  }

  // Get computed value from document root
  if (typeof window === "undefined") {
    // SSR fallback
    return "#888888";
  }

  const computedValue = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();

  if (!computedValue) {
    console.warn(`CSS variable ${varName} not found, using fallback`);
    return "#888888";
  }

  // Convert to hex
  const hex = colorToHex(computedValue);
  cssVarCache.set(varName, hex);

  return hex;
}

/**
 * Converts any CSS color value to hex format.
 * Supports: hex, rgb(), rgba(), hsl(), hsla(), named colors
 */
function colorToHex(color: string): string {
  // Already hex
  if (color.startsWith("#")) {
    return color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
  }

  // RGB/RGBA format: rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, "0");
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, "0");
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  // Use canvas to convert any other format (hsl, named colors, etc.)
  if (typeof document !== "undefined") {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.fillStyle = color;
      return ctx.fillStyle; // Returns hex
    }
  }

  return color;
}

/**
 * Clears the CSS variable cache.
 * Call this if theme changes dynamically.
 */
export function clearCssVarCache(): void {
  cssVarCache.clear();
}
