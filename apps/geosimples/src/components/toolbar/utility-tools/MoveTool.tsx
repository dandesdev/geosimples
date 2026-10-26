import { Move } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { ToolButton } from "../ToolButton";

export function MoveTool() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <ToolButton
      icon={<Move className="h-4 w-4" />}
      label="Move"
      shortcut="D"
      isActive={tool === "move"}
      onClick={() => setTool("move")}
      size="small"
    />
  );
}
