import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber, labelText, perpendicularBisectorOf, type Element, type FigureDoc } from "@geosimples/core/figure";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TYPE_NAMES } from "@/lib/names";
import { cn } from "@/lib/utils";
import { useInspected, useInspector } from "./inspected";

function describe(doc: FigureDoc, el: Element): string {
  const name = perpendicularBisectorOf(doc, el) ? "Mediatriz" : TYPE_NAMES[el.type].title;
  if (el.type === "text") return `${name} "${el.text}"`;
  if (el.type === "vline") return `${name} x = ${formatNumber(el.x)}`;
  const text = labelText(doc, el);
  return text ? `${name} ${text}` : `${name} ${el.id}`;
}

/** Names the object Propriedades and Formatação edit, and steps through a multiple selection. */
export function SelectionHeader({ bordered = true }: { bordered?: boolean }) {
  const inspected = useInspected();
  const applyAll = useInspector((s) => s.applyAll);
  const setIndex = useInspector((s) => s.setIndex);
  const setApplyAll = useInspector((s) => s.setApplyAll);
  if (!inspected) return null;
  const { doc, selected, i, el, sameType } = inspected;

  return (
    <div className={cn("space-y-2 py-3", bordered && "border-b")}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium" title={describe(doc, el)}>
          {describe(doc, el)}
        </span>
        {selected.length > 1 && (
          <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Objeto anterior"
              className="h-6 w-6 disabled:opacity-30"
              disabled={i === 0}
              onClick={() => setIndex(i - 1)}
            >
              <ChevronLeft />
            </Button>
            <span>
              {i + 1} de {selected.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Próximo objeto"
              className="h-6 w-6 disabled:opacity-30"
              disabled={i === selected.length - 1}
              onClick={() => setIndex(i + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
      {sameType.length > 1 && (
        <label className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs">
          <span>
            Aplicar a todos os {sameType.length} {TYPE_NAMES[el.type].many} selecionados
          </span>
          <Switch checked={applyAll} onCheckedChange={setApplyAll} />
        </label>
      )}
    </div>
  );
}
