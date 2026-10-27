import { useState } from "react";
import { CircleHelp, Plus } from "lucide-react";
import { toast } from "sonner";
import { addPoints, parsePointInput, type Point } from "@geosimples/core/figure";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFigureStore } from "@/store/figureStore";
import { lastSelectedPoint } from "@/lib/actions";

export function PointInput() {
  const [text, setText] = useState("");

  const submit = () => {
    const { doc, selection, run } = useFigureStore.getState();
    const points = doc.elements.filter((e): e is Point => e.type === "point");
    const parsed = parsePointInput(text, {
      selected: lastSelectedPoint(doc, selection),
      last: points[points.length - 1],
    });
    for (const error of parsed.errors) toast.error(error);
    if (parsed.points.length === 0) return;
    const result = run((d) => addPoints(d, parsed.points), "keep");
    if (result.error) {
      toast.error(result.error);
      return;
    }
    // Keep only what failed in the box so it can be fixed.
    setText(parsed.errors.length > 0 ? text : "");
  };

  return (
    <form
      className="flex shrink-0 items-center gap-2 rounded-lg border bg-card p-1.5 focus-within:ring-2 focus-within:ring-primary/50"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor="point-input" className="sr-only">
        Adicionar pontos
      </label>
      <input
        id="point-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder="Pontos: X;Y  ou  +R:θ  ou  R:θ, separados por espaço. Ex.: A=0;0 B=4;0 +3:90"
        className="min-w-0 flex-1 bg-transparent px-2 py-1.5 font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted-foreground"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Como digitar pontos"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-primary"
          >
            <CircleHelp className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-80 space-y-1 p-3 text-left">
          <p>
            <b>X;Y</b>: coordenadas. Ex.: <code>2;3</code>, <code>1,5;-2</code>
          </p>
          <p>
            <b>+R:θ</b>: R unidades a θ graus do ponto anterior. Ex.: <code>0;0 +4:0 +3:90</code>
          </p>
          <p>
            <b>R:θ</b>: a partir do último ponto selecionado.
          </p>
          <p>
            <b>Nome=</b> antes do ponto cria o rótulo. Ex.: <code>A=0;0</code>
          </p>
        </TooltipContent>
      </Tooltip>
      <Button type="submit" size="sm" disabled={text.trim() === ""}>
        <Plus />
        Adicionar
      </Button>
    </form>
  );
}
