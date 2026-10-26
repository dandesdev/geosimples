import { Minus } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { ToolButton } from "../ToolButton";

/**
 * LineTool manages its own hover state for showing selection badges.
 * When clicked with 2+ points selected, it batch creates lines.
 * Otherwise, it activates the line tool for manual point-by-point creation.
 */
export function LineTool() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const setIsHoveringLineTool = useEditorStore((s) => s.setIsHoveringLineTool);

  const handleClick = () => {
    setTool("line");
  };

  return (
    <ToolButton
      icon={<Minus className="h-4 w-4" />}
      label="Line"
      shortcut="L"
      isActive={tool === "line"}
      onClick={handleClick}
      onMouseEnter={() => setIsHoveringLineTool(true)}
      onMouseLeave={() => setIsHoveringLineTool(false)}
    />
  );
}
