import { useEffect, useState } from "react";
import { Copy, Download, FolderOpen, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { FIGURE_FILE_EXTENSION, SHARE_LINK_WARN_LENGTH } from "@geosimples/core/figure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Section } from "@/components/panel/controls";
import { copyText } from "@/lib/exporting";
import { canShareLinks, downloadFigureFile, figureShareUrl, pickFigureFiles } from "@/lib/figureFiles";
import { useFigureStore } from "@/store/figureStore";

function useCurrentName() {
  return useFigureStore((s) => s.figures.find((f) => f.id === s.figureId)?.name ?? "Figura");
}

/** Saving the figure as a file and sharing it as a link. */
export function ShareContent() {
  const doc = useFigureStore((s) => s.doc);
  const name = useCurrentName();
  const [link, setLink] = useState<{ url: string } | { error: true } | null>(null);

  useEffect(() => {
    if (!canShareLinks()) return;
    let alive = true;
    figureShareUrl({ name, doc }).then(
      (url) => alive && setLink({ url }),
      () => alive && setLink({ error: true }),
    );
    return () => {
      alive = false;
    };
  }, [doc, name]);

  const url = link && "url" in link ? link.url : null;

  return (
    <div className="space-y-4">
      <Section fixed title="Arquivo">
        <p className="mb-2 text-sm text-muted-foreground">
          Guarde a figura num arquivo {FIGURE_FILE_EXTENSION} para enviar ou abrir em outro computador. Para abri-lo,
          use Abrir arquivo ou arraste-o para a figura.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={pickFigureFiles}>
            <FolderOpen />
            Abrir arquivo…
          </Button>
          <Button variant="outline" onClick={() => downloadFigureFile({ name, doc })}>
            <Download />
            Salvar arquivo
          </Button>
        </div>
      </Section>

      <Section fixed title="Link">
        <p className="mb-2 text-sm text-muted-foreground">
          Quem abrir o link recebe uma cópia da figura. A figura vai dentro do próprio link: nada é enviado a um
          servidor.
        </p>
        {!canShareLinks() || (link && "error" in link) ? (
          <p className="text-sm text-destructive">Este navegador não consegue criar o link. Envie o arquivo.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                readOnly
                value={url ?? "Criando o link…"}
                aria-label="Link da figura"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-muted/40 px-2 font-mono text-xs md:text-xs"
              />
              <Button
                disabled={!url}
                onClick={() =>
                  url &&
                  copyText(url).then(
                    () => toast.success("Link copiado"),
                    () => toast.error("Não foi possível copiar. Selecione o link e copie."),
                  )
                }
              >
                <Copy />
                Copiar link
              </Button>
            </div>
            {url && url.length > SHARE_LINK_WARN_LENGTH && (
              <p role="status" className="mt-2 flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Este link tem {url.length.toLocaleString("pt-BR")} caracteres. Links tão longos podem ser cortados
                  por e-mail ou mensageiros; se não abrir, envie o arquivo.
                </span>
              </p>
            )}
          </>
        )}
      </Section>
    </div>
  );
}

export function ShareDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const name = useCurrentName();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Salvar e compartilhar</DialogTitle>
          <DialogDescription>“{name}”</DialogDescription>
        </DialogHeader>
        {open && <ShareContent />}
      </DialogContent>
    </Dialog>
  );
}
