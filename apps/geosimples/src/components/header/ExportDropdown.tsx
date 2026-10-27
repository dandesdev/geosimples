import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportDropdownProps {
  onExport: (format: "svg" | "png" | "tikz") => void;
}

export function ExportDropdown({ onExport }: ExportDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => onExport("svg")}>
          Export as SVG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("png")}>
          Export as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("tikz")}>
          Export as TikZ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
