import { Circle } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { ToolButton } from "../ToolButton";

export function PointTool() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <ToolButton
      icon={<Circle className="h-4 w-4" />}
      label="Point"
      shortcut="P"
      isActive={tool === "point"}
      onClick={() => setTool("point")}
    />
  );
}
