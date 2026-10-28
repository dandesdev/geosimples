import { Grid3x3, Scan, ZoomIn, ZoomOut } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { useFigureStore } from "@/store/figureStore";
import { useCoarsePointer } from "@/lib/useMediaQuery";

export interface ZoomControls {
  onZoomIn: () => void;
  onZoomOut: () => void;
  autoFit: boolean;
  onToggleAutoFit: () => void;
}

/**
 * Zoom, auto-fit and grid. On wider screens a column over the right edge of
 * the preview; on phones, where anything over the small preview covers the
 * figure, a row in the action bar instead.
 */
export function ZoomBar({
  onZoomIn,
  onZoomOut,
  autoFit,
  onToggleAutoFit,
  placement,
}: ZoomControls & { placement: "overlay" | "toolbar" }) {
  const showGrid = useFigureStore((s) => s.settings.showGrid);
  const setSetting = useFigureStore((s) => s.setSetting);
  const coarse = useCoarsePointer();
  return (
    <div
      role="toolbar"
      aria-label="Visualização"
      aria-orientation={placement === "overlay" ? "vertical" : "horizontal"}
      className={
        placement === "overlay"
          ? "absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-0.5 rounded-lg border bg-background/95 p-1 shadow-sm"
          : "ml-auto flex gap-0.5"
      }
    >
      <IconButton
        label="Aproximar"
        hint={coarse ? "Ou afaste dois dedos na prévia." : "Ou use a roda do mouse."}
        shortcut="zoomIn"
        onClick={onZoomIn}
      >
        <ZoomIn />
      </IconButton>
      <IconButton label="Afastar" shortcut="zoomOut" onClick={onZoomOut}>
        <ZoomOut />
      </IconButton>
      <IconButton
        label="Enquadrar automaticamente"
        shortcut="toggleAutoFit"
        hint={
          autoFit
            ? "Ligado: a vista acompanha a figura inteira, com rótulos e marcas. Aproximar ou arrastar a vista desliga."
            : "Desligado: a vista fica onde você deixou. Ligue para mostrar a figura inteira."
        }
        active={autoFit}
        onClick={onToggleAutoFit}
      >
        <Scan />
      </IconButton>
      <IconButton
        label={showGrid ? "Esconder grade" : "Mostrar grade"}
        hint="Grade de 1 em 1 unidade. Não aparece na exportação."
        shortcut="toggleGrid"
        active={showGrid}
        onClick={() => setSetting("showGrid", !showGrid)}
      >
        <Grid3x3 />
      </IconButton>
    </div>
  );
}
