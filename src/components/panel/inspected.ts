import { create } from "zustand";
import { updateElements, type Element, type FigureDoc, type Id } from "@geosimples/core/figure";
import { changeLabel, type LabelChange } from "@/lib/labels";
import { useFigureStore } from "@/store/figureStore";
import { useActivePrefs } from "@/store/useActivePrefs";

export type Update<T> = (change: (el: T) => T, key: string) => void;

export interface EditorProps<T> {
  el: T;
  update: Update<T>;
  /** Changes the label of every edited element. */
  updateLabel: (change: LabelChange, key: string) => void;
  /** True when the edit applies to several selected elements. */
  multi: boolean;
  /** Ids of the edited elements: `el` alone, or all selected of its type. */
  targets: Id[];
  doc: FigureDoc;
}

/** Which selected object Propriedades and Formatação show, shared so both follow the same one. */
export const useInspector = create<{
  index: number;
  applyAll: boolean;
  setIndex: (i: number) => void;
  setApplyAll: (on: boolean) => void;
}>()((set) => ({
  index: 0,
  applyAll: true,
  setIndex: (index) => set({ index }),
  setApplyAll: (applyAll) => set({ applyAll }),
}));

/**
 * The selected object the panel edits, with the elements a change applies
 * to: all selected objects of its type while "Aplicar a todos" is on.
 */
export function useInspected() {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const index = useInspector((s) => s.index);
  const applyAll = useInspector((s) => s.applyAll);
  const labelBase = useActivePrefs().styles.label;

  const byId = new Map(doc.elements.map((e) => [e.id, e]));
  const selected = selection.map((id) => byId.get(id)).filter((e): e is Element => !!e);
  if (selected.length === 0) return null;

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

  return {
    doc,
    selected,
    i,
    el,
    sameType,
    targets,
    /** Spread into an editor; cast because each editor takes its own element type. */
    props: { update: update as never, updateLabel, multi, targets, doc },
  };
}
