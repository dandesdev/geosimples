import { create } from "zustand";
import { studyPiece, studyPieces, studyPieceText, type FigureDoc, type Id, type Study } from "@geosimples/core/figure";
import { useFigureStore, type PieceFocus } from "@/store/figureStore";

/**
 * Going inside a study: a double click (or Ctrl+click, Enter, or a second tap
 * on a phone) picks one of its pieces instead of the whole study. The focus
 * lives in the figure store; here is what it means for the open figure.
 */

export interface FocusedStudy {
  study: Study;
  /** The piece picked, or null while inside with none picked. */
  path: string | null;
}

/** The study gone inside of, if it is still the selection, and its piece if that still exists. */
export function focusedStudy(doc: FigureDoc, selection: Id[], focus: PieceFocus | null): FocusedStudy | null {
  if (!focus || selection.length !== 1 || selection[0] !== focus.owner) return null;
  const study = doc.elements.find((e): e is Study => e.id === focus.owner && e.type === "study");
  if (!study) return null;
  return { study, path: focus.path && studyPiece(study, focus.path) ? focus.path : null };
}

export function useStudyFocus(): FocusedStudy | null {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const focus = useFigureStore((s) => s.focus);
  return focusedStudy(doc, selection, focus);
}

export function currentStudyFocus(): FocusedStudy | null {
  const { doc, selection, focus } = useFigureStore.getState();
  return focusedStudy(doc, selection, focus);
}

/** The single selected study, whether gone inside of or not. */
export function selectedStudy(): Study | null {
  const { doc, selection } = useFigureStore.getState();
  if (selection.length !== 1) return null;
  return doc.elements.find((e): e is Study => e.id === selection[0] && e.type === "study") ?? null;
}

/** The piece being typed over in the preview. */
export const useStudyEditing = create<{
  editing: { owner: Id; path: string } | null;
  start: (owner: Id, path: string) => void;
  stop: () => void;
}>()((set) => ({
  editing: null,
  start: (owner, path) => set({ editing: { owner, path } }),
  stop: () => set({ editing: null }),
}));

/** Starts typing over a piece, if it has a text. */
export function editPiece(study: Study, path: string): boolean {
  if (studyPieceText(study, path) === null) return false;
  useFigureStore.getState().setFocus({ owner: study.id, path });
  useStudyEditing.getState().start(study.id, path);
  return true;
}

/**
 * The keyboard inside a study: Enter goes in (to the first piece) and then
 * types over the piece, F2 too; Tab and Shift+Tab walk the pieces in reading
 * order. True when the key was used.
 */
export function studyKey(key: string, shift: boolean): boolean {
  const study = selectedStudy();
  if (!study) return false;
  const store = useFigureStore.getState();
  const inside = currentStudyFocus();
  const pieces = studyPieces(study);
  if (key === "Enter" || key === "F2") {
    if (inside?.path) return editPiece(study, inside.path);
    if (key === "F2" || pieces.length === 0) return false;
    store.setFocus({ owner: study.id, path: pieces[0] });
    return true;
  }
  if (key === "Tab" && inside) {
    const at = inside.path ? pieces.indexOf(inside.path) : -1;
    const next = at < 0 ? (shift ? pieces.length - 1 : 0) : (at + (shift ? -1 : 1) + pieces.length) % pieces.length;
    store.setFocus({ owner: study.id, path: pieces[next] ?? null });
    return true;
  }
  return false;
}

/** Esc inside a study: from a piece back to the whole study, then out of it. False when not inside one. */
export function leavePiece(): boolean {
  const inside = currentStudyFocus();
  const store = useFigureStore.getState();
  if (!inside) {
    if (store.focus) store.setFocus(null);
    return false;
  }
  store.setFocus(inside.path ? { owner: inside.study.id, path: null } : null);
  return true;
}
