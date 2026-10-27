import type { ElementType } from "@geosimples/core/figure";
import { useFigureStore } from "@/store/figureStore";
import { TYPE_NAMES } from "@/lib/names";

export function SelectionSummary() {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const moveMode = useFigureStore((s) => s.moveMode);
  if (doc.elements.length === 0) return null;

  const counts = new Map<ElementType, number>();
  const byId = new Map(doc.elements.map((e) => [e.id, e]));
  for (const id of selection) {
    const el = byId.get(id);
    if (el) counts.set(el.type, (counts.get(el.type) ?? 0) + 1);
  }
  const parts = [...counts].map(([type, n]) => `${n} ${n === 1 ? TYPE_NAMES[type].one : TYPE_NAMES[type].many}`);
  const text =
    parts.length > 0
      ? `Selecionados: ${parts.join(", ")}. Clique fora para limpar.`
      : moveMode
        ? "Mover ligado: arraste um ponto, ou selecione vários e arraste um deles."
        : "Clique nos objetos para selecioná-los. Arraste o fundo para deslocar a vista.";

  return (
    <p
      aria-live="polite"
      className="pointer-events-none absolute bottom-2 left-2 right-14 truncate rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground"
    >
      {text}
    </p>
  );
}
