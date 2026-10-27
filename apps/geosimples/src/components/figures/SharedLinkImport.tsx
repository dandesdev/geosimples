import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { decodeShareToken, type ParsedFigure } from "@geosimples/core/figure";
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
import { openParsedFigure, takeSharedToken } from "@/lib/figureFiles";
import { thumbnailUrl } from "./thumbnails";

type Received = Extract<ParsedFigure, { ok: true }>;

/**
 * Opens share links (`#figura=…`). The figure is only added after the user
 * agrees, always as a new entry, so nothing in the library is overwritten.
 */
export function SharedLinkImport() {
  const [received, setReceived] = useState<Received | null>(null);

  useEffect(() => {
    const check = () => {
      const token = takeSharedToken();
      if (!token) return;
      void decodeShareToken(token, "Figura compartilhada").then((parsed) => {
        if (parsed.ok) setReceived(parsed);
        else toast.error("Não foi possível abrir o link da figura.", { description: parsed.error });
      });
    };
    check();
    // A link pasted into the address bar of an open editor only changes the hash.
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  const preview = useMemo(() => received && thumbnailUrl(received.file.doc), [received]);

  return (
    <AlertDialog open={received !== null} onOpenChange={(open) => !open && setReceived(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Abrir figura compartilhada?</AlertDialogTitle>
          <AlertDialogDescription>
            “{received?.file.name}” vai entrar nas suas figuras como uma figura nova. A figura aberta agora continua
            salva.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid h-40 place-items-center rounded-md border bg-white p-2">
          {preview ? (
            <img src={preview} alt="Prévia da figura compartilhada" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-sm text-muted-foreground">Figura vazia</span>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Agora não</AlertDialogCancel>
          <AlertDialogAction onClick={() => received && openParsedFigure(received, "o link")}>
            Adicionar e abrir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
