import { ZoomIn } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { ToolButton } from "../ToolButton";

/**
 * ZoomInTool - triggers zoom action directly instead of being a mode.
 * Uses the zoom function from the store.
 */
export function ZoomInTool() {
  const zoom = useEditorStore((s) => s.zoom);

  const handleClick = () => {
    // Zoom in by 20% centered on canvas
    zoom(1.2, window.innerWidth / 2, window.innerHeight / 2);
  };

  return (
    <ToolButton
      icon={<ZoomIn className="h-4 w-4" />}
      label="Zoom In"
      shortcut="+"
      isActive={false} // Zoom is an action, not a mode
      onClick={handleClick}
      size="small"
    />
  );
}
