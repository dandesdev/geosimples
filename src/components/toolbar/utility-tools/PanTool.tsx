import { Hand } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { ToolButton } from "../ToolButton";

/**
 * Pan tool - not yet implemented, will enable canvas panning.
 * Currently just sets a tool state (pan not in ToolType yet).
 */
export function PanTool() {
  const setTool = useEditorStore((s) => s.setTool);

  // TODO: pan is not in ToolType, need to either:
  // 1. Add 'pan' to ToolType
  // 2. Use a separate pan mode state
  // For now, just set to select as fallback
  const handleClick = () => {
    // Pan mode would be handled separately (e.g., via modifier keys)
    setTool("select"); // Fallback until pan is implemented
  };

  return (
    <ToolButton
      icon={<Hand className="h-4 w-4" />}
      label="Pan"
      shortcut="H"
      isActive={false} // Pan not implemented yet
      onClick={handleClick}
      size="small"
    />
  );
}
