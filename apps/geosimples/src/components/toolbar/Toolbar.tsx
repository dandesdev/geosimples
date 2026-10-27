import { Separator } from "@/components/ui/separator";
import { SelectionTools, CreationTools } from "./tools";
import { BadgeToggle } from "./BadgeToggle";

/**
 * Main toolbar containing geometry creation tools.
 * Each tool is a self-contained component that manages its own state.
 */
export function Toolbar() {
  return (
    <div className="w-14 border-r border-border bg-background flex flex-col items-center py-2 px-0 gap-1">
      {/* Selection tools */}
      {SelectionTools.map((ToolComponent, index) => (
        <ToolComponent key={`selection-${index}`} />
      ))}

      <Separator className="w-[80%] my-1" />

      {/* Creation tools */}
      {CreationTools.map((ToolComponent, index) => (
        <ToolComponent key={`creation-${index}`} />
      ))}

      <Separator className="w-[80%] my-1" />
      <BadgeToggle />
    </div>
  );
}
