import { useDeferredValue } from "react";
import { FigureSnapshot } from "@/components/preview/FigureSnapshot";
import { useFigureStore } from "@/store/figureStore";

/** The open figure, small and still, under its name in Figura: what the preview shows, fitted. */
export function OpenFigureSnapshot() {
  // Behind the preview: while a point is dragged, the preview's frames come first.
  const doc = useDeferredValue(useFigureStore((s) => s.doc));
  const scale = useFigureStore((s) => s.settings.scale);
  const grid = useFigureStore((s) => s.settings.showGrid);
  const name = useFigureStore((s) => s.figures.find((f) => f.id === s.figureId)?.name ?? "");
  return (
    <div className="px-2 pb-2">
      <FigureSnapshot
        doc={doc}
        scale={scale}
        grid={grid}
        label={`Miniatura de ${name}`}
        empty="Figura vazia"
        className="h-28 w-full rounded-md border"
      />
    </div>
  );
}
