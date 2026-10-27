import { ZoomOut } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { ToolButton } from "../ToolButton";

/**
 * ZoomOutTool - triggers zoom action directly instead of being a mode.
 * Uses the zoom function from the store.
 */
export function ZoomOutTool() {
  const zoom = useEditorStore((s) => s.zoom);

  const handleClick = () => {
    // Zoom out by 20% centered on canvas
    zoom(0.8, window.innerWidth / 2, window.innerHeight / 2);
  };

  return (
    <ToolButton
      icon={<ZoomOut className="h-4 w-4" />}
      label="Zoom Out"
      shortcut="-"
      isActive={false} // Zoom is an action, not a mode
      onClick={handleClick}
      size="small"
    />
  );
}
