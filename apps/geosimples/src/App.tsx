import { lazy, Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { PointInput } from "@/components/PointInput";
import { EditSheet } from "@/components/panel/EditSheet";
import { SidePanel } from "@/components/panel/SidePanel";
import { AppDialogs } from "@/components/dialogs/AppDialogs";
import { useApplyTheme, useDarkTheme } from "@/lib/theme";
import { useSidePanelBeside } from "@/lib/useMediaQuery";
import { useShortcuts } from "@/lib/useShortcuts";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { FileDrop } from "@/components/figures/FileDrop";
import { SharedLinkImport } from "@/components/figures/SharedLinkImport";

// The dock is only for the pro layout: the classic page doesn't download it.
const ProWorkspace = lazy(() => import("@/components/workspace/ProWorkspace").then((m) => ({ default: m.ProWorkspace })));

function ClassicLayout() {
  const beside = useSidePanelBeside();
  return (
    <div className="flex min-h-dvh flex-col gap-3 bg-muted/40 p-3 lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden">
      <main className="flex min-h-0 flex-col gap-3">
        <PreviewPanel />
        <PointInput />
      </main>
      <SidePanel />
      {!beside && <EditSheet />}
    </div>
  );
}

function App() {
  useShortcuts();
  useApplyTheme();
  const dark = useDarkTheme();
  const beside = useSidePanelBeside();
  const layout = useWorkspaceStore((s) => s.layout);
  // The pro layout needs a desktop-sized window; smaller ones keep the classic page.
  const pro = beside && layout === "pro";
  return (
    <TooltipProvider delayDuration={300}>
      {pro ? (
        <Suspense fallback={<div className="h-dvh bg-background" />}>
          <ProWorkspace />
        </Suspense>
      ) : (
        <ClassicLayout />
      )}
      <AppDialogs />
      <FileDrop />
      <SharedLinkImport />
      <Toaster theme={dark ? "dark" : "light"} position="bottom-center" richColors closeButton />
    </TooltipProvider>
  );
}

export default App;
