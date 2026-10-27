import { Button } from "@/components/ui/button";
import { addPoints, autoLabel, makeAngles, makePolygon, parsePointInput } from "@geosimples/core/figure";
import { useFigureStore } from "@/store/figureStore";

const EXAMPLE = "A=0;0 B=4;0 C=0;3";

function insertExample() {
  useFigureStore.getState().run((doc) => {
    const added = addPoints(doc, parsePointInput(EXAMPLE).points);
    const [a, b, c] = added.created;
    const poly = makePolygon(added.doc, [a, b, c]);
    const right = makeAngles(poly.doc, [b, a, c]);
    const named = autoLabel(right.doc, "point", "latin", [a, b, c]);
    return { doc: named.doc, created: [] };
  }, "none");
}

export function EmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
      <div className="pointer-events-auto max-w-sm rounded-lg border bg-background/95 p-5 text-sm shadow-sm">
        <h2 className="mb-2 text-base font-semibold">Comece pelos pontos</h2>
        <p className="text-muted-foreground">
          Digite as coordenadas na barra abaixo da prévia, separadas por espaço. Um nome antes do = vira o rótulo do
          ponto:
        </p>
        <code className="my-3 block rounded bg-muted px-3 py-2 font-mono text-foreground">{EXAMPLE}</code>
        <p className="mb-4 text-muted-foreground">
          Depois clique nos pontos para selecioná-los e use os botões acima para ligar, marcar ângulos ou criar o
          polígono.
        </p>
        <Button size="sm" variant="outline" onClick={insertExample}>
          Inserir este exemplo
        </Button>
      </div>
    </div>
  );
}
