import { useMemo, useState } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { PT_PER_CM } from "@geosimples/core/figure";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Choice, Field, NumberInput } from "@/components/panel/controls";
import {
  canCopyImage,
  copyPng,
  copyText,
  downloadBlob,
  pngBlob,
  svgText,
  tikzText,
  type ExportSettings,
} from "@/lib/exporting";
import { useFigureStore } from "@/store/figureStore";

const FILE = "figura";

function sizeOf(svg: string) {
  const w = Number(/width="([\d.]+)pt"/.exec(svg)?.[1] ?? 0) / PT_PER_CM;
  const h = Number(/height="([\d.]+)pt"/.exec(svg)?.[1] ?? 0) / PT_PER_CM;
  return `${w.toFixed(1).replace(".", ",")} × ${h.toFixed(1).replace(".", ",")} cm`;
}

export function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">{open && <ExportBody />}</DialogContent>
    </Dialog>
  );
}

function ExportBody() {
  const doc = useFigureStore((s) => s.doc);
  const settings = useFigureStore((s) => s.settings);
  const setSetting = useFigureStore((s) => s.setSetting);
  const [busy, setBusy] = useState(false);

  const exportSettings: ExportSettings = {
    scale: settings.scale,
    dpi: settings.pngDpi,
    background: settings.pngBackground,
  };
  const tikz = useMemo(() => tikzText(doc, settings.scale), [doc, settings.scale]);
  const svg = useMemo(
    () => svgText(doc, settings.scale, settings.pngBackground),
    [doc, settings.scale, settings.pngBackground],
  );
  const previewUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const run = async (task: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await task();
      toast.success(done);
    } catch {
      toast.error("Não foi possível concluir. Tente baixar o arquivo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Exportar figura</DialogTitle>
        <DialogDescription>Tamanho final: {sizeOf(svg)}. Traços e rótulos mantêm a espessura em qualquer escala.</DialogDescription>
      </DialogHeader>

      <Field label="1 unidade =">
        <div className="w-36">
          <NumberInput
            ariaLabel="Centímetros por unidade"
            value={settings.scale}
            min={0.1}
            max={10}
            suffix="cm"
            onChange={(n) => setSetting("scale", n)}
          />
        </div>
      </Field>

      <Tabs defaultValue="tikz">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tikz">LaTeX (TikZ)</TabsTrigger>
          <TabsTrigger value="png">Imagem PNG</TabsTrigger>
          <TabsTrigger value="svg">Vetor SVG</TabsTrigger>
        </TabsList>

        <TabsContent value="tikz" className="space-y-3">
          <textarea
            readOnly
            value={tikz}
            aria-label="Código TikZ"
            rows={12}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-y rounded-md border bg-muted/40 p-2 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Cole dentro do documento. O preâmbulo precisa das linhas indicadas no comentário do topo.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => downloadBlob(new Blob([tikz], { type: "text/x-tex" }), `${FILE}.tex`)}>
              <Download />
              Baixar .tex
            </Button>
            <Button disabled={busy} onClick={() => run(() => copyText(tikz), "Código TikZ copiado")}>
              <Copy />
              Copiar código
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="png" className="space-y-3">
          <Choice
            label="Resolução"
            value={String(settings.pngDpi)}
            options={[
              { value: "150", label: "Tela (150 dpi)" },
              { value: "300", label: "Impressão (300 dpi)" },
              { value: "600", label: "Alta (600 dpi)" },
            ]}
            onChange={(v) => setSetting("pngDpi", Number(v))}
          />
          <BackgroundChoice />
          <FigurePreview url={previewUrl} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => run(async () => downloadBlob(await pngBlob(doc, exportSettings), `${FILE}.png`), "PNG salvo")}
            >
              <Download />
              Baixar PNG
            </Button>
            {canCopyImage() && (
              <Button disabled={busy} onClick={() => run(() => copyPng(doc, exportSettings), "Imagem copiada. Cole no Word ou no Docs.")}>
                <Copy />
                Copiar imagem
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="svg" className="space-y-3">
          <BackgroundChoice />
          <FigurePreview url={previewUrl} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => run(() => copyText(svg), "Código SVG copiado")}>
              <Copy />
              Copiar código
            </Button>
            <Button onClick={() => downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${FILE}.svg`)}>
              <Download />
              Baixar SVG
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function BackgroundChoice() {
  const background = useFigureStore((s) => s.settings.pngBackground);
  const setSetting = useFigureStore((s) => s.setSetting);
  return (
    <Choice
      label="Fundo"
      value={background}
      options={[
        { value: "white", label: "Branco" },
        { value: "transparent", label: "Transparente" },
      ]}
      onChange={(v) => setSetting("pngBackground", v)}
    />
  );
}

function FigurePreview({ url }: { url: string }) {
  return (
    <div className="grid max-h-56 place-items-center overflow-hidden rounded-md border bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-3">
      <img src={url} alt="Prévia da exportação" className="max-h-48 max-w-full object-contain" />
    </div>
  );
}
