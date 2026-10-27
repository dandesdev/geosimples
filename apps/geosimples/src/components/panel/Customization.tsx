import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { labelText, updateElements, type Element, type FigureDoc } from "@geosimples/core/figure";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { changeLabel, type LabelChange } from "@/lib/labels";
import { TYPE_NAMES } from "@/lib/names";
import { useFigureStore } from "@/store/figureStore";
import { useActivePrefs } from "@/store/useActivePrefs";
import {
  AngleEditor,
  CircleEditor,
  PointEditor,
  PolygonEditor,
  SegmentEditor,
  TextEditor,
  type Update,
} from "./elementEditors";

function describe(doc: FigureDoc, el: Element): string {
  const name = TYPE_NAMES[el.type].title;
  if (el.type === "text") return `${name} "${el.text}"`;
  const text = labelText(doc, el);
  return text ? `${name} ${text}` : `${name} ${el.id}`;
}

export function Customization() {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const [index, setIndex] = useState(0);
  const [applyAll, setApplyAll] = useState(true);
  const labelBase = useActivePrefs().styles.label;

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

  const updateLabel = (change: LabelChange, key: string) =>
    update((e) => changeLabel(useFigureStore.getState().doc, e, change, labelBase), key);

  const props = { update: update as never, updateLabel, multi, doc };

  return (
    <div className="space-y-3">
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
      {el.type === "point" && <PointEditor el={el} {...props} />}
      {el.type === "segment" && <SegmentEditor el={el} {...props} />}
      {el.type === "angle" && <AngleEditor el={el} {...props} />}
      {el.type === "circle" && <CircleEditor el={el} {...props} />}
      {el.type === "polygon" && <PolygonEditor el={el} {...props} />}
      {el.type === "text" && <TextEditor el={el} {...props} />}
    </div>
  );
}
