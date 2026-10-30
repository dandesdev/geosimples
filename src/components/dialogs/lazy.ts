import { lazy } from "react";

// The dialogs are not needed for the first paint, so they live in their own chunks.
const loadExport = () => import("./ExportDialog");
const loadSettings = () => import("./SettingsDialog");
const loadHelp = () => import("./HelpDialog");

export const LazyExportDialog = lazy(() => loadExport().then((m) => ({ default: m.ExportDialog })));
export const LazySettingsDialog = lazy(() => loadSettings().then((m) => ({ default: m.SettingsDialog })));
export const LazyHelpDialog = lazy(() => loadHelp().then((m) => ({ default: m.HelpDialog })));

/** Fetches the dialog chunks once the browser is idle, so the first open does not wait for the network. */
export function preloadDialogs() {
  const load = () => {
    // A failed preload is retried by React.lazy on first open.
    Promise.all([loadExport(), loadSettings(), loadHelp()]).catch(() => {});
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 3000 });
  else setTimeout(load, 1500);
}
