import { emitCommand } from "@/lib/commands";
import { useFigureStore } from "@/store/figureStore";
import { DeleteButton, Divider, ExportButton, History, Tools } from "./ActionBar";
import { ModeSwitch } from "./ModeSwitch";
import { SelectionSummary } from "./SelectionSummary";
import { ZoomBar } from "./ZoomBar";

/**
 * The figure's tools on a phone, below the preview: every one a named tile in
 * view at once. Nothing here scrolls sideways, because a swipe over a row of
 * buttons starts on one of them. Inserir is beside the input bar, above this.
 */
export function PhoneTools() {
  const autoFit = useFigureStore((s) => s.settings.autoFit);
  return (
    <div role="toolbar" aria-label="Ações da figura" className="@container flex flex-col gap-2">
      <div className="flex gap-1.5">
        <ModeSwitch tiles />
      </div>
      {/* Under the modes: with nothing selected it says what the mode in use does. */}
      <SelectionSummary placement="tools" />
      <div className="grid grid-cols-4 gap-1.5 @2xl:grid-cols-8">
        <Tools menuSide="bottom" tiles />
      </div>
      <div className="flex items-center gap-0.5">
        {/* A little bigger than on a desktop toolbar, for fingers. */}
        <div className="flex gap-0.5 *:h-10 *:w-10">
          <History />
          <DeleteButton />
        </div>
        <Divider />
        {/* The preview owns the camera, so its buttons reach it through commands. */}
        <ZoomBar
          placement="row"
          autoFit={autoFit}
          onToggleAutoFit={() => emitCommand("toggleAutoFit")}
          onZoomIn={() => emitCommand("zoomIn")}
          onZoomOut={() => emitCommand("zoomOut")}
        />
        <ExportButton className="ml-auto h-10" label="hidden @[23rem]:inline" />
      </div>
    </div>
  );
}
