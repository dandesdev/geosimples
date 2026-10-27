import { useCallback, useState } from "react";
import { useCommand } from "@/lib/commands";
import { Download, Redo2, Trash2, Undo2 } from "lucide-react";
import { ModeSwitch } from "./ModeSwitch";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AltitudeIcon,
  AngleIcon,
  BisectorIcon,
  CircleRadiusIcon,
  CircleTangentIcon,
  CircleThroughIcon,
  CircumcircleIcon,
  CloseLoopIcon,
  ConnectIcon,
  ConstructionsIcon,
  IntersectionIcon,
  MedianIcon,
  MidpointIcon,
  PerpendicularBisectorIcon,
  PolygonIcon,
} from "@/components/icons";
import { LazyExportDialog } from "@/components/dialogs/lazy";
import { MountOnFirstOpen } from "@/components/dialogs/MountOnFirstOpen";
import { actions } from "@/lib/actions";
import { CONSTRUCTION_KINDS, previewProps, useAvailability, type Availability } from "@/lib/availability";
import type { ConstructionKind } from "@geosimples/core/figure";
import { useFigureStore } from "@/store/figureStore";
import { cn } from "@/lib/utils";

const Divider = ({ className }: { className?: string }) => (
  <div className={cn("mx-1 h-6 w-px shrink-0 bg-border", className)} aria-hidden="true" />
);

function MenuItem({
  icon,
  title,
  hint,
  availability,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  availability: Availability;
  onSelect: () => void;
}) {
  const reason = availability.reason;
  return (
    <DropdownMenuItem
      onSelect={() => {
        clearPreview();
        onSelect();
      }}
      // Unavailable items stay in the menu, grayed, with what is missing.
      disabled={reason !== null}
      className="items-start gap-3 py-2"
      {...previewProps(availability)}
    >
      <span className="mt-0.5 [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      <span className="flex flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
        {reason && <span className="mt-0.5 text-xs text-destructive">{reason}</span>}
      </span>
    </DropdownMenuItem>
  );
}

const CONSTRUCTIONS: Record<ConstructionKind, { icon: React.ReactNode; title: string; hint: string }> = {
  midpoint: {
    icon: <MidpointIcon />,
    title: "Ponto médio",
    hint: "Divide um segmento, ou o caminho entre dois pontos, ao meio.",
  },
  altitude: {
    icon: <AltitudeIcon />,
    title: "Altura",
    hint: "Do vértice até a reta do lado oposto, com ângulo reto. Com um triângulo, traça as três.",
  },
  median: {
    icon: <MedianIcon />,
    title: "Mediana",
    hint: "Do vértice até o ponto médio do lado oposto. Com um triângulo, traça as três.",
  },
  bisector: {
    icon: <BisectorIcon />,
    title: "Bissetriz",
    hint: "Divide o ângulo ao meio. Em um triângulo, vai até o lado oposto.",
  },
  perpendicularBisector: {
    icon: <PerpendicularBisectorIcon />,
    title: "Mediatriz",
    hint: "Perpendicular ao segmento pelo seu ponto médio, com marca de ângulo reto (dá para apagar).",
  },
  intersection: {
    icon: <IntersectionIcon />,
    title: "Interseção",
    hint: "Marca onde segmentos e circunferências selecionados se cruzam.",
  },
};

const clearPreview = () => useFigureStore.getState().setActionPreview(null);

/** Runs an action after clearing its hover preview, which would be stale afterwards. */
const act = (fn: () => void) => () => {
  clearPreview();
  fn();
};

export function ActionBar() {
  const canUndo = useFigureStore((s) => s.past.length > 0);
  const canRedo = useFigureStore((s) => s.future.length > 0);
  const hasSelection = useFigureStore((s) => s.selection.length > 0);
  const isEmpty = useFigureStore((s) => s.doc.elements.length === 0);
  const av = useAvailability();
  const anyCircle = (["radius", "through", "tangent", "circumcircle"] as const).some((m) => !av[`circle-${m}`].reason);
  const anyConnect = !av.connect.reason || !av.closeContour.reason;
  const anyConstruction = CONSTRUCTION_KINDS.some((kind) => !av[`construct-${kind}`].reason);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const openExport = useCallback(() => {
    if (useFigureStore.getState().doc.elements.length > 0) setExportOpen(true);
  }, []);
  useCommand("export", openExport);

  const store = useFigureStore.getState;

  const onDelete = () => {
    if (hasSelection) actions.deleteSelected();
    else if (!isEmpty) setConfirmClear(true);
  };

  return (
    <div
      role="toolbar"
      aria-label="Ações da figura"
      // Wraps instead of scrolling, so on phones the modes sit on a second row instead of off screen.
      className="flex shrink-0 flex-wrap items-center gap-0.5 border-b bg-background px-2 py-1.5"
    >
      <Button
        size="sm"
        className="mr-1 shrink-0"
        onClick={() => setExportOpen(true)}
        disabled={isEmpty}
        title="Exportar"
        aria-label="Exportar"
      >
        <Download />
        <span className="hidden sm:inline">Exportar</span>
      </Button>
      <Divider />
      <IconButton label="Desfazer" shortcut="undo" onClick={() => store().undo()} disabled={!canUndo}>
        <Undo2 />
      </IconButton>
      <IconButton label="Refazer" shortcut="redo" onClick={() => store().redo()} disabled={!canRedo}>
        <Redo2 />
      </IconButton>
      <IconButton
        label={hasSelection ? "Apagar selecionados" : "Limpar figura"}
        hint={hasSelection ? "Apaga também o que depende deles." : "Sem seleção, apaga a figura inteira."}
        shortcut={hasSelection ? "delete" : undefined}
        onClick={onDelete}
        disabled={isEmpty}
      >
        <Trash2 />
      </IconButton>
      <Divider />

      <DropdownMenu onOpenChange={(open) => !open && clearPreview()}>
        <DropdownMenuTrigger asChild>
          <IconButton
            label="Ligar pontos"
            shortcut="connect"
            hint="Cria segmentos entre os pontos selecionados, na ordem da seleção."
            dimmed={!anyConnect}
            ready={hasSelection && anyConnect}
          >
            <ConnectIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Ligar pontos selecionados</DropdownMenuLabel>
          <MenuItem
            icon={<ConnectIcon />}
            title="Em sequência"
            hint="A, B, C → segmentos AB e BC"
            availability={av.connect}
            onSelect={() => actions.connect(false)}
          />
          <MenuItem
            icon={<CloseLoopIcon />}
            title="Fechando o contorno"
            hint="A, B, C → segmentos AB, BC e CA"
            availability={av.closeContour}
            onSelect={() => actions.connect(true)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <IconButton
        label="Marcar ângulo"
        shortcut="angle"
        hint="Selecione A, B, C para marcar o ângulo em B, ou um polígono para marcar todos os seus ângulos."
        unavailable={av.angle.reason}
        ready={hasSelection}
        onClick={act(actions.angles)}
        {...previewProps(av.angle)}
      >
        <AngleIcon />
      </IconButton>

      <IconButton
        label="Polígono e preenchimento"
        shortcut="polygon"
        hint="Selecione os vértices em ordem, ou os segmentos de um contorno fechado. Circunferências e polígonos selecionados também são preenchidos."
        unavailable={av.polygon.reason}
        ready={hasSelection}
        onClick={act(actions.polygon)}
        {...previewProps(av.polygon)}
      >
        <PolygonIcon />
      </IconButton>

      <DropdownMenu onOpenChange={(open) => !open && clearPreview()}>
        <DropdownMenuTrigger asChild>
          <IconButton
            label="Circunferência"
            hint="Escolha como construir a partir da seleção."
            dimmed={!anyCircle}
            ready={hasSelection && anyCircle}
          >
            <CircleThroughIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel>Circunferência</DropdownMenuLabel>
          <MenuItem
            icon={<CircleRadiusIcon />}
            title="Centro e raio 1"
            hint="Selecione o centro. Ajuste o raio depois, em Customização."
            availability={av["circle-radius"]}
            onSelect={() => actions.circle("radius")}
          />
          <MenuItem
            icon={<CircleThroughIcon />}
            title="Centro e um ponto"
            hint="Selecione o centro e depois um ponto da circunferência."
            availability={av["circle-through"]}
            onSelect={() => actions.circle("through")}
          />
          <MenuItem
            icon={<CircleTangentIcon />}
            title="Centro e tangente"
            hint="Selecione o centro e um segmento a tangenciar."
            availability={av["circle-tangent"]}
            onSelect={() => actions.circle("tangent")}
          />
          <MenuItem
            icon={<CircumcircleIcon />}
            title="Por três pontos"
            hint="Selecione três pontos. O centro é criado como um novo ponto."
            availability={av["circle-circumcircle"]}
            onSelect={() => actions.circle("circumcircle")}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu onOpenChange={(open) => !open && clearPreview()}>
        <DropdownMenuTrigger asChild>
          <IconButton
            label="Construções"
            hint="Ponto médio, altura, mediana, bissetriz, mediatriz e interseção. O que é construído acompanha os pontos quando eles se movem."
            dimmed={!anyConstruction}
            ready={hasSelection && anyConstruction}
          >
            <ConstructionsIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel>Construções</DropdownMenuLabel>
          {CONSTRUCTION_KINDS.map((kind) => (
            <MenuItem
              key={kind}
              {...CONSTRUCTIONS[kind]}
              availability={av[`construct-${kind}`]}
              onSelect={() => actions.construct(kind)}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider className="hidden sm:block" />
      <ModeSwitch />

      <MountOnFirstOpen open={exportOpen}>
        <LazyExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      </MountOnFirstOpen>
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar a figura inteira?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os pontos, segmentos e formas serão apagados. Dá para recuperar com Desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => store().clear()}>Apagar tudo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
