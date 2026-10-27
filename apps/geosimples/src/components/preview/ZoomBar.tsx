import { Grid3x3, Scan, ZoomIn, ZoomOut } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { useFigureStore } from "@/store/figureStore";

export function ZoomBar({
  onZoomIn,
  onZoomOut,
  onFit,
  fitted,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  fitted: boolean;
}) {
  const showGrid = useFigureStore((s) => s.settings.showGrid);
  const setSetting = useFigureStore((s) => s.setSetting);
  return (
    <div
      role="toolbar"
      aria-label="Visualização"
      aria-orientation="vertical"
      className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-0.5 rounded-lg border bg-background/95 p-1 shadow-sm"
    >
      <IconButton label="Aproximar" hint="Ou use a roda do mouse." onClick={onZoomIn}>
        <ZoomIn />
      </IconButton>
      <IconButton label="Afastar" onClick={onZoomOut}>
        <ZoomOut />
      </IconButton>
      <IconButton label="Enquadrar a figura" hint="Volta a mostrar a figura inteira." onClick={onFit} disabled={fitted}>
        <Scan />
      </IconButton>
      <IconButton
        label={showGrid ? "Esconder grade" : "Mostrar grade"}
        hint="Grade de 1 em 1 unidade. Não aparece na exportação."
        active={showGrid}
        onClick={() => setSetting("showGrid", !showGrid)}
      >
        <Grid3x3 />
      </IconButton>
    </div>
  );
}
