import { useEffect } from "react";
import { actions } from "@/lib/actions";
import { useFigureStore } from "@/store/figureStore";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Undo, redo, delete, select all and clear selection. Ignored while typing. */
export function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.altKey) return;
      // Leave keys alone while a dialog or menu is open.
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      const store = useFigureStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      } else if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
        e.preventDefault();
        store.redo();
      } else if (mod && key === "a" && !e.shiftKey) {
        e.preventDefault();
        store.selectAll();
      } else if (!mod && !e.shiftKey && (e.key === "Delete" || e.key === "Backspace")) {
        if (store.selection.length === 0) return;
        e.preventDefault();
        actions.deleteSelected();
      } else if (!mod && e.key === "Escape") {
        store.clearSelection();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
