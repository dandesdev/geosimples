import { SelectTool } from "./SelectTool";
import { PointTool } from "./PointTool";
import { LineTool } from "./LineTool";
import { CircleTool } from "./CircleTool";
import { ArcTool } from "./ArcTool";
import { PolygonTool } from "./PolygonTool";

export { SelectTool, PointTool, LineTool, CircleTool, ArcTool, PolygonTool };

/**
 * Selection/utility tools - appear at top of toolbar
 */
export const SelectionTools = [SelectTool];

/**
 * Creation tools - appear below separator
 */
export const CreationTools = [
  PointTool,
  LineTool,
  CircleTool,
  ArcTool,
  PolygonTool,
];

/**
 * All geometry tools combined (for backwards compatibility)
 */
export const GeometryTools = [...SelectionTools, ...CreationTools];
