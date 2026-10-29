import { useEffect } from "react";
import { useWorkspaceStore, type Theme } from "@/store/workspaceStore";
import { useMediaQuery } from "./useMediaQuery";

/** Whether the interface is dark now, following the system when the theme says so. */
export function useDarkTheme(): boolean {
  const theme = useWorkspaceStore((s) => s.theme);
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  return theme === "dark" || (theme === "system" && systemDark);
}

/** Keeps the `dark` class on the page in step with the chosen theme. */
export function useApplyTheme() {
  const dark = useDarkTheme();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
}

export const THEME_NAMES: Record<Theme, string> = { light: "Claro", dark: "Escuro", system: "Do sistema" };

/** Light to dark and back; "system" goes to the opposite of what shows now. */
export function nextTheme(dark: boolean): Theme {
  return dark ? "light" : "dark";
}
