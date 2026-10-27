import { useEffect } from "react";

/** Commands that a component carries out, like opening a dialog or zooming. */
export type UiCommand = "export" | "help" | "settings" | "focusInput" | "zoomIn" | "zoomOut" | "toggleAutoFit";

const listeners = new Map<UiCommand, Set<() => void>>();

export function emitCommand(command: UiCommand) {
  listeners.get(command)?.forEach((fn) => fn());
}

/** Runs `handler` whenever `command` is emitted, for as long as the component is mounted. */
export function useCommand(command: UiCommand, handler: () => void) {
  useEffect(() => {
    const set = listeners.get(command) ?? new Set();
    listeners.set(command, set);
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }, [command, handler]);
}
