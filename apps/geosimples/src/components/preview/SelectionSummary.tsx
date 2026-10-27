import type { ElementType } from "@geosimples/core/figure";
import { useFigureStore } from "@/store/figureStore";
import { TYPE_NAMES } from "@/lib/names";
import { useCoarsePointer } from "@/lib/useMediaQuery";

const HINTS = {
  select: "Clique nos objetos para selecioná-los, ou arraste uma caixa em volta deles.",
  pan: "Arraste para deslocar a vista. Clique nos objetos para selecioná-los.",
  move: "Arraste um ponto ou texto, ou selecione vários e arraste um deles.",
} as const;

const TOUCH_HINTS = {
  select: "Toque nos objetos para selecioná-los, ou arraste uma caixa em volta deles. Use dois dedos para mover e aproximar a vista.",
  pan: "Arraste para deslocar a vista, ou pince para aproximar. Toque nos objetos para selecioná-los.",
  move: "Arraste um ponto, ou selecione vários e arraste um deles. Use dois dedos para mover a vista.",
} as const;

export function SelectionSummary() {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const mode = useFigureStore((s) => s.mode);
  const coarse = useCoarsePointer();
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
      ? `Selecionados: ${parts.join(", ")}. ${coarse ? "Toque" : "Clique"} fora para limpar.`
      : (coarse ? TOUCH_HINTS : HINTS)[mode];

  return (
    <p
      aria-live="polite"
      // Phones have the zoom bar at the top, so the text can use the whole width and wrap.
      className="pointer-events-none absolute bottom-2 left-2 right-2 rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground sm:right-14 sm:truncate"
    >
      {text}
    </p>
  );
}
