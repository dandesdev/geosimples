import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addFunction, applyInput, makeAngles, makePolygon, parseInput } from "@geosimples/core/figure";
import { useFigureStore } from "@/store/figureStore";
import { usePanelStore } from "@/store/panelStore";
import { opOptions } from "@/store/prefsStore";

const EXAMPLE = "A=(0;0)--B=(4;0)--C=(0;3)--";

function insertExample() {
  useFigureStore.getState().run((doc) => {
    const opts = opOptions();
    const added = applyInput(doc, parseInput(EXAMPLE), opts);
    const [a, b, c] = added.created;
    const poly = makePolygon(added.doc, [a, b, c], { ...opts, styles: { ...opts.styles!, polygonFilled: true } });
    const right = makeAngles(poly.doc, [b, a, c], opts);
    return { doc: right.doc, created: [] };
  }, "none");
}

/** `pro`: the pro layout, where the input hides at the bottom and the tools are in a column on the left. */
const GRAPH_EXAMPLE = "x^2 - 1";

function insertGraph() {
  useFigureStore.getState().run((doc) => addFunction(doc, GRAPH_EXAMPLE, "f", opOptions()), "none");
}

export function EmptyState({ pro = false }: { pro?: boolean }) {
  const away = usePanelStore((s) => s.welcomeClosed || s.welcomeHidden);
  const close = usePanelStore((s) => s.closeWelcome);
  const hide = usePanelStore((s) => s.setWelcomeHidden);
  if (away) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center p-2 sm:p-6">
      {/* A short phone preview can't fit the whole card, so it scrolls instead of being cut. */}
      <div className="pointer-events-auto relative max-h-full max-w-sm overflow-y-auto rounded-lg border bg-background/95 p-3.5 text-sm shadow-sm sm:p-5">
        <Button variant="ghost" size="icon" aria-label="Fechar" title="Fechar" className="absolute right-2 top-2 h-7 w-7" onClick={close}>
          <X />
        </Button>
        <h2 className="mb-2 pr-6 text-base font-semibold">Comece pelos pontos</h2>
        <p className="text-muted-foreground">
          {pro
            ? "Leve o mouse à borda de baixo da prévia (ou tecle /) e digite na barra de entrada."
            : "Digite na barra abaixo da prévia."}{" "}
          Um nome antes do = vira o rótulo, e -- liga os pontos. No fim, -- fecha o contorno:
        </p>
        <code className="my-3 block rounded bg-muted px-3 py-2 font-mono text-foreground">{EXAMPLE}</code>
        {/* Phones show the action bar right above, so this line mostly takes room there. */}
        <p className="mb-4 hidden text-muted-foreground sm:block">
          Depois selecione os objetos na prévia e use os botões {pro ? "à esquerda, ou o botão direito do mouse," : "acima"}{" "}
          para marcar ângulos, preencher o polígono ou criar circunferências.
        </p>
        <div className="mt-1 flex flex-wrap gap-2 sm:mt-0">
          <Button size="sm" variant="outline" onClick={insertExample}>
            Inserir este exemplo
          </Button>
          <Button size="sm" variant="ghost" onClick={insertGraph} title="Ou digite f(x)=x^2-1 na barra de entrada.">
            Ou um gráfico: f(x) = x² − 1
          </Button>
        </div>
        <button type="button" className="mt-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => hide(true)}>
          Não mostrar mais
        </button>
      </div>
    </div>
  );
}
