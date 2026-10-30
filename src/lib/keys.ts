const MODIFIERS = new Set(["Control", "Shift", "Alt", "Meta", "AltGraph", "CapsLock", "Dead", "Unidentified", "Process"]);
const NAMED: Record<string, string> = { " ": "Space", Esc: "Escape", Del: "Delete" };

/**
 * A key combination as stored in shortcuts: "Ctrl+Shift+Z", "Shift+L", "?".
 * Cmd counts as Ctrl. Shift is part of the combination only for letters and
 * named keys: "?" already implies it.
 */
export function comboFromEvent(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): string | null {
  if (MODIFIERS.has(e.key)) return null;
  let key = NAMED[e.key] ?? e.key;
  const single = Array.from(key).length === 1;
  const letter = single && /\p{L}/u.test(key);
  if (letter) key = key.toUpperCase();
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey && (!single || letter)) parts.push("Shift");
  parts.push(key);
  return parts.join("+");
}

const KEY_NAMES: Record<string, string> = {
  Delete: "Delete",
  Backspace: "Backspace",
  Escape: "Esc",
  Space: "Espaço",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

/** Keys of a combination for display, e.g. ["Ctrl", "Z"]. */
export function comboKeys(combo: string): string[] {
  // A lone "+" is a key, not a separator.
  const parts = combo === "+" ? ["+"] : combo.endsWith("++") ? [...combo.slice(0, -2).split("+"), "+"] : combo.split("+");
  return parts.map((p) => KEY_NAMES[p] ?? p);
}
