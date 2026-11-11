import { lazy, Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { PointInput } from "@/components/PointInput";
import { InsertCatalog } from "@/components/preview/InsertCatalog";
import { PhoneTools } from "@/components/preview/PhoneTools";
import { EditSheet, SelectionCard } from "@/components/panel/EditSheet";
import { SidePanel } from "@/components/panel/SidePanel";
import { AppDialogs } from "@/components/dialogs/AppDialogs";
import { useApplyTheme, useDarkTheme } from "@/lib/theme";
import { useRoomyPreview, useSidePanelBeside } from "@/lib/useMediaQuery";
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

/**
 * Phones: the preview flush with the top and the sides of the screen and pinned
 * there, and under it, in the page that scrolls: Inserir with the input bar,
 * the tools as tiles, what edits the selection, and the panel.
 */
function PhoneLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      {/* No box of its own, so the preview stays pinned for as long as the whole page scrolls. */}
      <main className="contents">
        <PreviewPanel />
        <div className="flex flex-col gap-2 px-2 pt-2">
          <div className="flex items-start gap-2">
            <InsertCatalog variant="screen" />
            <div className="min-w-0 flex-1">
              <PointInput phone />
            </div>
          </div>
          <PhoneTools />
          <SelectionCard />
        </div>
      </main>
      <div className="p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <SidePanel />
      </div>
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
  const phone = !useRoomyPreview();
  return (
    <TooltipProvider delayDuration={300}>
      {pro ? (
        <Suspense fallback={<div className="h-dvh bg-background" />}>
          <ProWorkspace />
        </Suspense>
      ) : phone ? (
        <PhoneLayout />
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
