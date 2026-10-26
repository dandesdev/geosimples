import { UtilityTools } from "./utility-tools";

/**
 * Utility toolbar containing view manipulation tools (move, pan, zoom).
 * Each tool is a self-contained component.
 */
export function UtilityToolbar() {
  return (
    <div className="w-12 border-r border-border bg-background-secondary flex flex-col items-center py-2 gap-1">
      {UtilityTools.map((ToolComponent, index) => (
        <ToolComponent key={index} />
      ))}
    </div>
  );
}
