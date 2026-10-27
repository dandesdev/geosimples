import type { GeometryElement } from "@geosimples/core/geo";

/**
 * Get a human-readable name for an element.
 * Uses label if set, otherwise generates a name like "Círculo 1".
 */
export function getElementDisplayName(
  element: GeometryElement,
  elements: GeometryElement[],
): string {
  // If element has a label, use it
  if ("label" in element && element.label) {
    return element.label;
  }

  // Generate a name based on type and index
  const sameTypeElements = elements.filter((el) => el.type === element.type);
  const index = sameTypeElements.findIndex((el) => el.id === element.id) + 1;

  const typeNames: Record<string, string> = {
    point: "Ponto",
    line: "Segmento",
    circle: "Círculo",
    arc: "Arco",
    polygon: "Polígono",
    label: "Rótulo",
  };

  const typeName = typeNames[element.type] || element.type;
  return `${typeName} ${index}`;
}
