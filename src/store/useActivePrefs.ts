import { activePrefs, usePrefsStore, type Prefs } from "@/store/prefsStore";

/** The active profile's preferences. Re-renders when they change. */
export function useActivePrefs(): Prefs {
  return usePrefsStore((s) => activePrefs(s));
}
