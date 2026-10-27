import { useMemo, useRef, useState } from "react";
import { Copy, Download, Ellipsis, FilePlus2, FolderOpen, Pencil, Trash2 } from "lucide-react";
import type { FigureMeta } from "@geosimples/core/figure";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { downloadFigureFile, pickFigureFiles } from "@/lib/figureFiles";
import { cn } from "@/lib/utils";
import { loadFigureDoc, useFigureStore } from "@/store/figureStore";
import { NameInput } from "./NameInput";
import { editedAgo, storedThumbnail, thumbnailUrl } from "./thumbnails";

export function FiguresDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">{open && <Library onClose={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function Library({ onClose }: { onClose: () => void }) {
  const figures = useFigureStore((s) => s.figures);
  const figureId = useFigureStore((s) => s.figureId);
  const store = useFigureStore.getState;
  const [now] = useState(Date.now);
  const [toDelete, setToDelete] = useState<FigureMeta | null>(null);
  const sorted = useMemo(() => [...figures].sort((a, b) => b.updatedAt - a.updatedAt), [figures]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Minhas figuras</DialogTitle>
        <DialogDescription>
          Salvas neste navegador. Para levar uma figura a outro computador, salve o arquivo dela.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            store().newFigure();
            onClose();
          }}
        >
          <FilePlus2 />
          Nova figura
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            pickFigureFiles();
            onClose();
          }}
        >
          <FolderOpen />
          Abrir arquivo…
        </Button>
      </div>

      <ul
        aria-label="Figuras salvas"
        className="-mx-1 grid max-h-[60dvh] grid-cols-2 gap-3 overflow-y-auto px-1 py-1 sm:grid-cols-3"
      >
        {sorted.map((meta) => (
          <FigureCard
            key={meta.id}
            meta={meta}
            current={meta.id === figureId}
            edited={editedAgo(meta.updatedAt, now)}
            onOpen={() => {
              store().openFigure(meta.id);
              onClose();
            }}
            onDelete={() => setToDelete(meta)}
          />
        ))}
      </ul>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              A figura será apagada deste navegador. Não dá para desfazer. Se quiser guardá-la, salve o arquivo antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => toDelete && store().deleteFigure(toDelete.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Thumbnail({ meta, current }: { meta: FigureMeta; current: boolean }) {
  const liveDoc = useFigureStore((s) => (current ? s.doc : null));
  const live = useMemo(() => liveDoc && thumbnailUrl(liveDoc), [liveDoc]);
  const url = current ? live : storedThumbnail(meta.id, meta.updatedAt);
  if (!url) return <span className="text-xs text-muted-foreground">Figura vazia</span>;
  return <img src={url} alt="" className="h-full w-full object-contain" />;
}

function FigureCard({
  meta,
  current,
  edited,
  onOpen,
  onDelete,
}: {
  meta: FigureMeta;
  current: boolean;
  edited: string;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const store = useFigureStore.getState;
  const [renaming, setRenaming] = useState(false);
  /** Renaming starts from the menu, which takes focus back to its button as it closes. */
  const focusName = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  return (
    <li
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md",
        current && "border-primary ring-1 ring-primary",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Abrir ${meta.name}`}
        className="grid aspect-[4/3] place-items-center bg-white p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Thumbnail meta={meta} current={current} />
      </button>
      <div className="flex items-start gap-1 border-t p-2">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <NameInput
              ref={nameRef}
              name={meta.name}
              onDone={(name) => {
                if (name !== null) store().renameFigure(meta.id, name);
                setRenaming(false);
              }}
              className="h-7 border"
            />
          ) : (
            <p className="truncate text-sm font-medium" title={meta.name}>
              {meta.name}
            </p>
          )}
          <p className="truncate text-xs text-muted-foreground">
            {current ? <span className="font-medium text-primary">Aberta · </span> : null}
            {edited}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Opções de ${meta.name}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(e) => {
              if (!focusName.current) return;
              focusName.current = false;
              e.preventDefault();
              nameRef.current?.focus();
            }}
          >
            {!current && <DropdownMenuItem onSelect={onOpen}>Abrir</DropdownMenuItem>}
            <DropdownMenuItem
              onSelect={() => {
                focusName.current = true;
                setRenaming(true);
              }}
            >
              <Pencil />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => store().duplicateFigure(meta.id)}>
              <Copy />
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => downloadFigureFile({ name: meta.name, doc: loadFigureDoc(meta.id) })}>
              <Download />
              Salvar arquivo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
