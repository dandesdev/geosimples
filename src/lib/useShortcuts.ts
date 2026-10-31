import { useEffect } from "react";
import { NO_QUICK_FIGURE } from "@geosimples/core/figure";
import { actions } from "@/lib/actions";
import { emitCommand } from "@/lib/commands";
import { comboFromEvent } from "@/lib/keys";
import { useFigureStore } from "@/store/figureStore";
import { activePrefs, type ActionId } from "@/store/prefsStore";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Carries out a shortcut's action. Returns false when it doesn't apply right now. */
export function runAction(id: ActionId): boolean {
  const store = useFigureStore.getState();
  switch (id) {
    case "undo":
      store.undo();
      return true;
    case "redo":
      store.redo();
      return true;
    case "delete":
      // Without a selection Delete and Backspace keep their usual meaning.
      return actions.deleteSelected();
    case "selectAll":
      store.selectAll();
      return true;
    case "clearSelection":
      store.clearSelection();
      // Esc also finishes the figure Figura rápida is drawing.
      store.setQuickFigure(NO_QUICK_FIGURE);
      return true;
    case "modeSelect":
      store.setMode("select");
      return true;
    case "modePan":
      store.setMode("pan");
      return true;
    case "modeMove":
      store.setMode("move");
      return true;
    case "modeAdd":
      store.setMode("add");
      return true;
    case "modeFigure":
      store.setMode("figure");
      return true;
    case "toggleMultiSelect":
      store.setMultiSelect(!store.multiSelect);
      return true;
    case "connect":
      actions.connect(false);
      return true;
    case "closeContour":
      actions.connect(true);
      return true;
    case "angle":
      actions.angles();
      return true;
    case "polygon":
      actions.polygon();
      return true;
    case "toggleGrid":
      store.setSetting("showGrid", !store.settings.showGrid);
      return true;
    case "toggleSnap":
      store.setSetting("snapToGrid", !store.settings.snapToGrid);
      return true;
    default:
      emitCommand(id);
      return true;
  }
}

/** Keyboard shortcuts from the active profile. Ignored while typing or while a dialog is open. */
export function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      const combo = comboFromEvent(e);
      if (!combo) return;
      const shortcuts = activePrefs().shortcuts;
      const id = (Object.keys(shortcuts) as ActionId[]).find((a) => shortcuts[a].includes(combo));
      if (!id) return;
      if (id === "delete" && useFigureStore.getState().selection.length === 0) return;
      e.preventDefault();
      runAction(id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
