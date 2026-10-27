import { comboKeys } from "@/lib/keys";
import type { ActionId } from "@/store/prefsStore";
import { useActivePrefs } from "@/store/useActivePrefs";

/** The first key combination bound to an action, drawn as small keycaps. */
export function ShortcutKeys({ action }: { action: ActionId }) {
  const combo = useActivePrefs().shortcuts[action][0];
  if (!combo) return null;
  return (
    <span className="inline-flex gap-0.5">
      {comboKeys(combo).map((k, i) => (
        <kbd key={i} className="rounded border border-current/30 px-1 font-mono text-[10px] leading-4 opacity-90">
          {k}
        </kbd>
      ))}
    </span>
  );
}
