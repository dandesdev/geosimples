import { useEffect, useState } from "react";
import { FileUp } from "lucide-react";
import { FIGURE_FILE_EXTENSION } from "@geosimples/core/figure";
import { openFigureFiles } from "@/lib/figureFiles";

const carriesFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;

/** Opens figure files dropped anywhere on the page, the preview included. */
export function FileDrop() {
  const [over, setOver] = useState(false);

  useEffect(() => {
    // dragenter and dragleave fire for every child crossed; count them to know when the drag left the page.
    let depth = 0;
    const onEnter = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth++;
      setOver(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const onOver = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      // Without this the browser would navigate to the file.
      e.preventDefault();
      depth = 0;
      setOver(false);
      void openFigureFiles([...(e.dataTransfer?.files ?? [])]);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  if (!over) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-primary/10 p-6">
      <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-primary bg-card px-8 py-6 text-center shadow-lg">
        <FileUp className="h-8 w-8 text-primary" />
        <p className="font-medium">Solte para abrir a figura</p>
        <p className="text-sm text-muted-foreground">Arquivos {FIGURE_FILE_EXTENSION} entram nas suas figuras.</p>
      </div>
    </div>
  );
}
