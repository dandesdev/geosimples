/**
 * Coordinate System Utilities
 *
 * Transforms between two coordinate systems:
 * - World/User coordinates: Mathematical coordinate system for educators
 *   - Y-axis points UP
 *   - Origin at (0,0) positioned at 1/4 from left, 1/4 from bottom
 *   - 1 unit = pixelsPerUnit (default 50px)
 *
 * - Screen/Pixel coordinates: SVG rendering coordinates
 *   - Y-axis points DOWN (standard screen coords)
 *   - Origin at top-left
 */

import type { Point2D } from "./math";

export interface CoordinateSystemConfig {
  /** Pixels per world unit (default: 50) */
  pixelsPerUnit: number;
  /** World origin position in screen/pixel coordinates */
  worldOrigin: Point2D;
}

/**
 * Default coordinate system configuration.
 * worldOrigin will be calculated based on canvas size.
 */
export const DEFAULT_COORDINATE_CONFIG: CoordinateSystemConfig = {
  pixelsPerUnit: 50,
  worldOrigin: { x: 0, y: 0 },
};

/**
 * Calculate the world origin position in screen coordinates.
 * Places origin at 1/4 from left and 1/4 from bottom.
 *
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @returns World origin in screen coordinates
 */
export function calculateWorldOrigin(
  canvasWidth: number,
  canvasHeight: number,
): Point2D {
  return {
    x: canvasWidth * 0.25, // 1/4 from left
    y: canvasHeight * 0.75, // 1/4 from bottom = 3/4 from top
  };
}

/**
 * Transform world coordinates to screen/pixel coordinates.
 *
 * @param worldPoint - Point in world coordinates
 * @param config - Coordinate system configuration
 * @returns Point in screen/pixel coordinates
 */
export function worldToScreen(
  worldPoint: Point2D,
  config: CoordinateSystemConfig,
): Point2D {
  return {
    x: config.worldOrigin.x + worldPoint.x * config.pixelsPerUnit,
    y: config.worldOrigin.y - worldPoint.y * config.pixelsPerUnit, // Y-flip
  };
}

/**
 * Transform screen/pixel coordinates to world coordinates.
 *
 * @param screenPoint - Point in screen/pixel coordinates
 * @param config - Coordinate system configuration
 * @returns Point in world coordinates
 */
export function screenToWorld(
  screenPoint: Point2D,
  config: CoordinateSystemConfig,
): Point2D {
  return {
    x: (screenPoint.x - config.worldOrigin.x) / config.pixelsPerUnit,
    y: (config.worldOrigin.y - screenPoint.y) / config.pixelsPerUnit, // Y-flip
  };
}

/**
 * Transform a radius/distance from world units to screen pixels.
 *
 * @param worldRadius - Radius in world units
 * @param config - Coordinate system configuration
 * @returns Radius in screen pixels
 */
export function worldRadiusToScreen(
  worldRadius: number,
  config: CoordinateSystemConfig,
): number {
  return worldRadius * config.pixelsPerUnit;
}

/**
 * Transform a radius/distance from screen pixels to world units.
 *
 * @param screenRadius - Radius in screen pixels
 * @param config - Coordinate system configuration
 * @returns Radius in world units
 */
export function screenRadiusToWorld(
  screenRadius: number,
  config: CoordinateSystemConfig,
): number {
  return screenRadius / config.pixelsPerUnit;
}

/**
 * Snap a world coordinate to the world grid.
 *
 * @param worldPoint - Point in world coordinates
 * @param gridSpacing - Grid spacing in world units (default: 1)
 * @returns Snapped point in world coordinates
 */
export function snapToWorldGrid(
  worldPoint: Point2D,
  gridSpacing: number = 1,
): Point2D {
  return {
    x: Math.round(worldPoint.x / gridSpacing) * gridSpacing,
    y: Math.round(worldPoint.y / gridSpacing) * gridSpacing,
  };
}

/**
 * Get the visible world coordinate bounds for the current canvas.
 *
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @param config - Coordinate system configuration
 * @returns Object with min/max x/y in world coordinates
 */
export function getVisibleWorldBounds(
  canvasWidth: number,
  canvasHeight: number,
  config: CoordinateSystemConfig,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const topLeft = screenToWorld({ x: 0, y: 0 }, config);
  const bottomRight = screenToWorld(
    { x: canvasWidth, y: canvasHeight },
    config,
  );

  return {
    minX: topLeft.x,
    maxX: bottomRight.x,
    minY: bottomRight.y,
    maxY: topLeft.y,
  };
}
