import type { ElementType } from "@geosimples/core/figure";
import { useFigureStore } from "@/store/figureStore";
import { TYPE_NAMES } from "@/lib/names";
import { useCoarsePointer } from "@/lib/useMediaQuery";
import { useActivePrefs } from "@/store/useActivePrefs";

const SNAP_HINT = " Perto da grade, encaixa no cruzamento.";

const HINTS = {
  select: "Clique num objeto para selecioná-lo; com Shift, soma à seleção. Ou arraste uma caixa em volta deles.",
  pan: "Arraste para deslocar a vista. Clique num objeto para selecioná-lo; com Shift, soma à seleção.",
  move: "Arraste um ponto ou texto, ou selecione vários (Shift) e arraste um deles.",
  add: "Clique onde quer um ponto. Arraste para mover a vista.",
  figure: "Clique para pôr vértices; o 3º fecha o polígono. Clique no 1º vértice ou Esc para terminar.",
} as const;

const TOUCH_HINTS = {
  select: "Toque num objeto para selecioná-lo, ou arraste uma caixa em volta. Para somar, ligue Seleção múltipla.",
  pan: "Arraste para deslocar a vista, ou pince para aproximar. Toque num objeto para selecioná-lo.",
  move: "Arraste um ponto, ou selecione vários e arraste um deles. Use dois dedos para mover a vista.",
  add: "Toque onde quer um ponto. Arraste para mover a vista.",
  figure: "Toque para pôr vértices; o 3º fecha o polígono. Toque no 1º vértice para terminar.",
} as const;

/**
 * What is selected, or how to select. Over the bottom of the preview on wider
 * screens; below it on phones, where it would cover the figure.
 */
export function SelectionSummary({ placement }: { placement: "overlay" | "below" }) {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const mode = useFigureStore((s) => s.mode);
  const coarse = useCoarsePointer();
  const snap = useActivePrefs().behavior.snapToGrid;
  const placing = mode === "add" || mode === "figure";
  // An empty figure has the welcome card, except where a click adds points: there this hint says what to do.
  if (doc.elements.length === 0 && !placing) return null;

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
      : (coarse ? TOUCH_HINTS : HINTS)[mode] + (snap && placing ? SNAP_HINT : "");

  return (
    <p
      aria-live="polite"
      className={
        placement === "overlay"
          ? "pointer-events-none absolute bottom-2 left-2 right-14 truncate rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground"
          : "-mt-1.5 px-1 text-xs text-muted-foreground"
      }
    >
      {text}
    </p>
  );
}
