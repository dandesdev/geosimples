import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { PointInput } from "@/components/PointInput";
import { EditSheet } from "@/components/panel/EditSheet";
import { SidePanel } from "@/components/panel/SidePanel";
import { useSidePanelBeside } from "@/lib/useMediaQuery";
import { useShortcuts } from "@/lib/useShortcuts";
import { FileDrop } from "@/components/figures/FileDrop";
import { SharedLinkImport } from "@/components/figures/SharedLinkImport";

function App() {
  useShortcuts();
  const beside = useSidePanelBeside();
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-dvh flex-col gap-3 bg-muted/40 p-3 lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden">
        <main className="flex min-h-0 flex-col gap-3">
          <PreviewPanel />
          <PointInput />
        </main>
        <SidePanel />
        {!beside && <EditSheet />}
      </div>
      <FileDrop />
      <SharedLinkImport />
      <Toaster position="bottom-center" richColors closeButton />
    </TooltipProvider>
  );
}

export default App;
