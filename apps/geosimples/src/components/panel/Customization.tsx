import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { updateElements, type Element } from "@geosimples/core/figure";
import { Switch } from "@/components/ui/switch";
import { TYPE_NAMES } from "@/lib/names";
import { useFigureStore } from "@/store/figureStore";
import { AngleEditor, CircleEditor, PointEditor, PolygonEditor, SegmentEditor, type Update } from "./elementEditors";

function describe(el: Element): string {
  const name = TYPE_NAMES[el.type].title;
  return el.label?.text ? `${name} ${el.label.text}` : `${name} ${el.id}`;
}

export function Customization() {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const [index, setIndex] = useState(0);
  const [applyAll, setApplyAll] = useState(true);

  const byId = new Map(doc.elements.map((e) => [e.id, e]));
  const selected = selection.map((id) => byId.get(id)).filter((e): e is Element => !!e);

  if (selected.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione um objeto na prévia para mudar cor, traço, preenchimento e rótulo.
      </p>
    );
  }

  const i = Math.min(index, selected.length - 1);
  const el = selected[i];
  const sameType = selected.filter((e) => e.type === el.type);
  const multi = applyAll && sameType.length > 1;
  const targets = multi ? sameType.map((e) => e.id) : [el.id];
  const keyBase = targets.join(",");

  const update: Update<Element> = (change, key) => {
    const store = useFigureStore.getState();
    store.commit(updateElements(store.doc, targets, change), `${keyBase}:${key}`);
  };

  const props = { update: update as never, multi, doc };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium" title={describe(el)}>
          {describe(el)}
        </span>
        {selected.length > 1 && (
          <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <button
              type="button"
              aria-label="Objeto anterior"
              className="rounded p-1 hover:bg-muted disabled:opacity-30"
              disabled={i === 0}
              onClick={() => setIndex(i - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              {i + 1} de {selected.length}
            </span>
            <button
              type="button"
              aria-label="Próximo objeto"
              className="rounded p-1 hover:bg-muted disabled:opacity-30"
              disabled={i === selected.length - 1}
              onClick={() => setIndex(i + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
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
      {el.type === "point" && <PointEditor el={el} {...props} />}
      {el.type === "segment" && <SegmentEditor el={el} {...props} />}
      {el.type === "angle" && <AngleEditor el={el} {...props} />}
      {el.type === "circle" && <CircleEditor el={el} {...props} />}
      {el.type === "polygon" && <PolygonEditor el={el} {...props} />}
    </div>
  );
}
