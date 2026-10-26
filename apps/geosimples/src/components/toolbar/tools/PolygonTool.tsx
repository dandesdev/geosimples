import { Hexagon } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { ToolButton } from "../ToolButton";

export function PolygonTool() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <ToolButton
      icon={<Hexagon className="h-4 w-4" />}
      label="Polygon"
      shortcut="G"
      isActive={tool === "polygon"}
      onClick={() => setTool("polygon")}
    />
  );
}
