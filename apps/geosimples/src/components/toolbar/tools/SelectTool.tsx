import { MousePointer2 } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { ToolButton } from "../ToolButton";

export function SelectTool() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <ToolButton
      icon={<MousePointer2 className="h-4 w-4" />}
      label="Select"
      shortcut="V"
      isActive={tool === "select"}
      onClick={() => setTool("select")}
    />
  );
}
