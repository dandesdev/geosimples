import { useEditorStore } from "@/store/useEditorStore";
import { Moon, Sun, Undo2, Redo2, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ExportDropdown } from "./ExportDropdown";
import { toast } from "sonner";

export function Header() {
  const preferences = useEditorStore((state) => state.preferences);
  const toggleTheme = useEditorStore((state) => state.toggleTheme);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const reset = useEditorStore((state) => state.reset);
  const elements = useEditorStore((state) => state.elements);

  const handleExport = useMemo(
    () => (format: "svg" | "png" | "tikz") => {
      console.log("Export to", format, elements);
      toast.success(`Exported as ${format.toUpperCase()}`);
    },
    [elements],
  );

  const handleReset = () => {
    reset();
    toast.success("Canvas reset");
  };

  return (
    <header className="h-14 border-b border-border bg-background-secondary flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
          >
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="18" r="3" />
            <line x1="6" y1="9" x2="18" y2="9" />
            <line x1="6" y1="15" x2="18" y2="15" />
            <line x1="9" y1="6" x2="9" y2="18" />
            <line x1="15" y1="6" x2="15" y2="18" />
          </svg>
        </div>
        <h1 className="font-semibold text-foreground">GeoSimples</h1>
      </div>

      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={undo}>
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Undo (Ctrl+Z)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={redo}>
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Redo (Ctrl+Shift+Z)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {elements.length > 0 ? (
          <AlertDialog>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset Canvas</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Canvas?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete all points, lines, circles, and other
                  elements. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toast.info("Canvas is already empty")}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reset Canvas</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="w-px h-6 bg-border mx-2" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleTheme}>
                {preferences.theme === "light" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Theme</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <ExportDropdown onExport={handleExport} />
      </div>
    </header>
  );
}
