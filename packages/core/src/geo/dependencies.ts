/**
 * Dependency Resolution Utilities
 *
 * This module provides utilities for resolving element dependencies
 * in the geometry graph. Elements can be "locked" to other elements,
 * meaning they depend on those elements for their construction.
 */

import type { GeometryElement, ElementID } from "./types";

/** Default maximum depth for dependency tree traversal */
export const DEFAULT_DEPENDENCY_DEPTH = 2;

/**
 * Get the IDs of elements that directly depend on the given element.
 * An element A depends on element B if B is in A's lockedBy array.
 *
 * @param elements - All elements in the canvas
 * @param elementId - The element to find dependents for
 * @returns Array of element IDs that depend on the given element
 */
export function getDependents(
  elements: GeometryElement[],
  elementId: ElementID,
): ElementID[] {
  return elements
    .filter((el) => {
      // Labels don't have lockedBy
      if (el.type === "label") return false;
      return el.lockedBy.includes(elementId);
    })
    .map((el) => el.id);
}

/**
 * Get the full dependency tree for an element, up to a maximum depth.
 * This returns all elements that would be affected if the given element moves.
 *
 * @param elements - All elements in the canvas
 * @param elementId - The root element
 * @param maxDepth - Maximum depth to traverse (default: 2)
 * @returns Array of element IDs in the dependency tree (excluding the root)
 */
export function getDependencyTree(
  elements: GeometryElement[],
  elementId: ElementID,
  maxDepth: number = DEFAULT_DEPENDENCY_DEPTH,
): ElementID[] {
  const visited = new Set<ElementID>();
  const result: ElementID[] = [];

  function traverse(id: ElementID, depth: number) {
    if (depth > maxDepth) return;

    const dependents = getDependents(elements, id);
    for (const depId of dependents) {
      if (!visited.has(depId)) {
        visited.add(depId);
        result.push(depId);
        traverse(depId, depth + 1);
      }
    }
  }

  traverse(elementId, 1);
  return result;
}

/**
 * Get element by ID from the elements array.
 *
 * @param elements - All elements in the canvas
 * @param elementId - The element ID to find
 * @returns The element if found, undefined otherwise
 */
export function getElementById(
  elements: GeometryElement[],
  elementId: ElementID,
): GeometryElement | undefined {
  return elements.find((el) => el.id === elementId);
}

/**
 * Get multiple elements by their IDs.
 *
 * @param elements - All elements in the canvas
 * @param elementIds - Array of element IDs to find
 * @returns Array of found elements (in same order, missing elements omitted)
 */
export function getElementsByIds(
  elements: GeometryElement[],
  elementIds: ElementID[],
): GeometryElement[] {
  const elementMap = new Map(elements.map((el) => [el.id, el]));
  return elementIds
    .map((id) => elementMap.get(id))
    .filter((el): el is GeometryElement => el !== undefined);
}

/**
 * Get all elements in the dependency tree as full element objects.
 *
 * @param elements - All elements in the canvas
 * @param elementId - The root element
 * @param maxDepth - Maximum depth to traverse (default: 2)
 * @returns Array of elements in the dependency tree
 */
export function getDependencyTreeElements(
  elements: GeometryElement[],
  elementId: ElementID,
  maxDepth: number = DEFAULT_DEPENDENCY_DEPTH,
): GeometryElement[] {
  const treeIds = getDependencyTree(elements, elementId, maxDepth);
  return getElementsByIds(elements, treeIds);
}

/**
 * Build a reverse dependency map for quick lookups.
 * Maps each element ID to the list of elements that depend on it.
 *
 * @param elements - All elements in the canvas
 * @returns Map from element ID to array of dependent element IDs
 */
export function buildDependencyMap(
  elements: GeometryElement[],
): Map<ElementID, ElementID[]> {
  const map = new Map<ElementID, ElementID[]>();

  // Initialize map with empty arrays for all elements
  for (const el of elements) {
    map.set(el.id, []);
  }

  // Build reverse lookup
  for (const el of elements) {
    if (el.type === "label") continue;
    // Some elements may not have lockedBy array
    if (!el.lockedBy || !Array.isArray(el.lockedBy)) continue;
    for (const lockerId of el.lockedBy) {
      const dependents = map.get(lockerId);
      if (dependents) {
        dependents.push(el.id);
      }
    }
  }

  return map;
}
