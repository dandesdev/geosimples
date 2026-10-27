import { GitCommit } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { ToolButton } from "../ToolButton";

export function ArcTool() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <ToolButton
      icon={<GitCommit className="h-4 w-4" />}
      label="Arc"
      shortcut="A"
      isActive={tool === "arc"}
      onClick={() => setTool("arc")}
    />
  );
}
