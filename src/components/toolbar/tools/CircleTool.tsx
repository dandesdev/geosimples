import { CircleDashed } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { ToolButton } from "../ToolButton";

export function CircleTool() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const setIsHoveringCircleTool = useEditorStore(
    (s) => s.setIsHoveringCircleTool,
  );

  return (
    <ToolButton
      icon={<CircleDashed className="h-4 w-4" />}
      label="Circle"
      shortcut="C"
      isActive={tool === "circle"}
      onClick={() => setTool("circle")}
      onMouseEnter={() => setIsHoveringCircleTool(true)}
      onMouseLeave={() => setIsHoveringCircleTool(false)}
    />
  );
}
