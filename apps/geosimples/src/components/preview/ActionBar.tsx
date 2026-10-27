import { useState } from "react";
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
  AngleIcon,
  CircleRadiusIcon,
  CircleTangentIcon,
  CircleThroughIcon,
  CircumcircleIcon,
  CloseLoopIcon,
  ConnectIcon,
  PolygonIcon,
} from "@/components/icons";
import { ExportDialog } from "@/components/dialogs/ExportDialog";
import { actions } from "@/lib/actions";
import { useFigureStore } from "@/store/figureStore";

const Divider = () => <div className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden="true" />;

function MenuItem({
  icon,
  title,
  hint,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="items-start gap-3 py-2">
      <span className="mt-0.5 [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      <span className="flex flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </DropdownMenuItem>
  );
}

export function ActionBar() {
  const canUndo = useFigureStore((s) => s.past.length > 0);
  const canRedo = useFigureStore((s) => s.future.length > 0);
  const hasSelection = useFigureStore((s) => s.selection.length > 0);
  const isEmpty = useFigureStore((s) => s.doc.elements.length === 0);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const store = useFigureStore.getState;

  const onDelete = () => {
    if (hasSelection) actions.deleteSelected();
    else if (!isEmpty) setConfirmClear(true);
  };

  return (
    <div
      role="toolbar"
      aria-label="Ações da figura"
      className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-background px-2 py-1.5"
    >
      <Button size="sm" className="mr-1 shrink-0" onClick={() => setExportOpen(true)} disabled={isEmpty}>
        <Download />
        Exportar
      </Button>
      <Divider />
      <IconButton label="Desfazer" hint="Ctrl+Z" onClick={() => store().undo()} disabled={!canUndo}>
        <Undo2 />
      </IconButton>
      <IconButton label="Refazer" hint="Ctrl+Y" onClick={() => store().redo()} disabled={!canRedo}>
        <Redo2 />
      </IconButton>
      <IconButton
        label={hasSelection ? "Apagar selecionados" : "Limpar figura"}
        hint={hasSelection ? "Delete. Apaga também o que depende deles." : "Sem seleção, apaga a figura inteira."}
        onClick={onDelete}
        disabled={isEmpty}
      >
        <Trash2 />
      </IconButton>
      <Divider />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label="Ligar pontos" hint="Cria segmentos entre os pontos selecionados, na ordem da seleção.">
            <ConnectIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Ligar pontos selecionados</DropdownMenuLabel>
          <MenuItem
            icon={<ConnectIcon />}
            title="Em sequência"
            hint="A, B, C → segmentos AB e BC"
            onSelect={() => actions.connect(false)}
          />
          <MenuItem
            icon={<CloseLoopIcon />}
            title="Fechando o contorno"
            hint="A, B, C → segmentos AB, BC e CA"
            onSelect={() => actions.connect(true)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <IconButton
        label="Marcar ângulo"
        hint="Selecione A, B, C para marcar o ângulo em B, ou um polígono para marcar todos os seus ângulos."
        onClick={() => actions.angles()}
      >
        <AngleIcon />
      </IconButton>

      <IconButton
        label="Polígono"
        hint="Selecione os vértices em ordem (ou os segmentos de um contorno fechado) para preencher a região."
        onClick={() => actions.polygon()}
      >
        <PolygonIcon />
      </IconButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label="Circunferência" hint="Escolha como construir a partir da seleção.">
            <CircleThroughIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel>Circunferência</DropdownMenuLabel>
          <MenuItem
            icon={<CircleRadiusIcon />}
            title="Centro e raio 1"
            hint="Selecione o centro. Ajuste o raio depois, em Customização."
            onSelect={() => actions.circle("radius")}
          />
          <MenuItem
            icon={<CircleThroughIcon />}
            title="Centro e um ponto"
            hint="Selecione o centro e depois um ponto da circunferência."
            onSelect={() => actions.circle("through")}
          />
          <MenuItem
            icon={<CircleTangentIcon />}
            title="Centro e tangente"
            hint="Selecione o centro e um segmento a tangenciar."
            onSelect={() => actions.circle("tangent")}
          />
          <MenuItem
            icon={<CircumcircleIcon />}
            title="Por três pontos"
            hint="Selecione três pontos. O centro é criado como um novo ponto."
            onSelect={() => actions.circle("circumcircle")}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />
      <ModeSwitch />

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
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
