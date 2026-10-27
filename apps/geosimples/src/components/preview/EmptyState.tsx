import { Button } from "@/components/ui/button";
import { applyInput, makeAngles, makePolygon, parseInput } from "@geosimples/core/figure";
import { useFigureStore } from "@/store/figureStore";
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

export function EmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
      <div className="pointer-events-auto max-w-sm rounded-lg border bg-background/95 p-5 text-sm shadow-sm">
        <h2 className="mb-2 text-base font-semibold">Comece pelos pontos</h2>
        <p className="text-muted-foreground">
          Digite na barra abaixo da prévia. Um nome antes do = vira o rótulo, e -- liga os pontos. No fim, -- fecha o
          contorno:
        </p>
        <code className="my-3 block rounded bg-muted px-3 py-2 font-mono text-foreground">{EXAMPLE}</code>
        <p className="mb-4 text-muted-foreground">
          Depois selecione os objetos na prévia e use os botões acima para marcar ângulos, preencher o polígono ou
          criar circunferências.
        </p>
        <Button size="sm" variant="outline" onClick={insertExample}>
          Inserir este exemplo
        </Button>
      </div>
    </div>
  );
}
