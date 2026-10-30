import { useState } from "react";
import { Copy, Download, Ellipsis, FilePlus2, FolderOpen, Images, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/IconButton";
import { currentFigureFile, downloadFigureFile, pickFigureFiles } from "@/lib/figureFiles";
import { useFigureStore } from "@/store/figureStore";
import { FiguresDialog } from "./FiguresDialog";
import { NameInput } from "./NameInput";
import { ShareDialog } from "./ShareFigure";

/** The open figure's name, the library and the file and link options. */
export function FigureBar() {
  const figureId = useFigureStore((s) => s.figureId);
  const name = useFigureStore((s) => s.figures.find((f) => f.id === s.figureId)?.name ?? "");
  const count = useFigureStore((s) => s.figures.length);
  const store = useFigureStore.getState;
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5">
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 px-2"
        onClick={() => setLibraryOpen(true)}
        title="Minhas figuras: abrir, criar, duplicar e excluir"
      >
        <Images />
        Figuras
        <span className="rounded bg-muted px-1 tabular-nums text-muted-foreground">{count}</span>
      </Button>
      <span className="text-muted-foreground" aria-hidden="true">
        /
      </span>
      {/* Remounts when the figure or its name changes elsewhere. */}
      <NameInput
        key={`${figureId}:${name}`}
        name={name}
        onDone={(next) => next !== null && store().renameFigure(figureId, next)}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label="Opções da figura" hint="Nova, duplicar, arquivo e link.">
            <Ellipsis />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => store().newFigure()}>
            <FilePlus2 />
            Nova figura
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => store().duplicateFigure(figureId)}>
            <Copy />
            Duplicar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => downloadFigureFile(currentFigureFile())}>
            <Download />
            Salvar arquivo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={pickFigureFiles}>
            <FolderOpen />
            Abrir arquivo…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShareOpen(true)}>
            <Link2 />
            Compartilhar link…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FiguresDialog open={libraryOpen} onOpenChange={setLibraryOpen} />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}
