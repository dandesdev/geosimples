import { useEffect } from "react";
import type { Paper } from "@geosimples/core/figure";
import { useWorkspaceStore, type ExportColors, type Theme } from "@/store/workspaceStore";
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

/** The paper the preview draws on: gray in the dark theme. */
export function usePreviewPaper(): Paper {
  return useDarkTheme() ? "dark" : "print";
}

/** The paper PNG and SVG exports use: white, unless the settings ask for the theme's colors. */
export function useExportPaper(): Paper {
  const themed = useWorkspaceStore((s) => s.exportColors === "theme");
  return usePreviewPaper() === "dark" && themed ? "dark" : "print";
}

export const EXPORT_COLORS: { value: ExportColors; label: string }[] = [
  { value: "print", label: "Padrão" },
  { value: "theme", label: "Como no tema" },
];

export const EXPORT_COLORS_HELP =
  "Padrão: preto sobre papel branco, como na impressão. Como no tema: as cores que a prévia mostra no tema escuro, com o papel cinza. Vale para PNG e SVG; o TikZ sai sempre nas cores de impressão.";

export const THEME_NAMES: Record<Theme, string> = { light: "Claro", dark: "Escuro", system: "Do sistema" };

/** Light to dark and back; "system" goes to the opposite of what shows now. */
export function nextTheme(dark: boolean): Theme {
  return dark ? "light" : "dark";
}
