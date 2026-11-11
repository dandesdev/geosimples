import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Menu } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { PointInput } from "@/components/PointInput";
import { SelectionCard } from "@/components/panel/EditSheet";
import { SidePanel } from "@/components/panel/SidePanel";
import { InsertCatalog } from "@/components/preview/InsertCatalog";
import { ModeSwitch } from "@/components/preview/ModeSwitch";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { SelectionSummary } from "@/components/preview/SelectionSummary";
import { AreaTools } from "@/components/tools/AreaTools";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePanelStore } from "@/store/panelStore";
import { cn } from "@/lib/utils";

/** The preview's height on a phone, as a share of the screen: from a sliver of it to most of it. */
const MIN_SHARE = 0.1;
const MAX_SHARE = 0.8;

/**
 * Phones: one screen that doesn't scroll as a whole. On top the preview,
 * flush with the edges, as tall as it is dragged by its bottom edge. Under
 * it, pinned, Inserir and the input bar, the modes and the hint. Below them
 * the tools by kind of figure, the one part that scrolls, with the card that
 * edits the selection after them. The rest (the figure, Prontos, the theme,
 * Configurações, help) is in the menu over the preview's corner.
 */
export function PhoneLayout() {
  const share = usePanelStore((s) => s.phonePreview);
  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-muted/40"
      // The height the preview was dragged to: data, so it goes inline.
      style={share === null ? undefined : ({ "--phone-preview": `${share * 100}dvh` } as React.CSSProperties)}
    >
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="relative shrink-0">
          <PreviewPanel />
          <PhoneMenu />
          <PreviewResizer />
        </div>
        <div className="flex shrink-0 flex-col gap-2 px-2 pt-2.5">
          <div className="flex items-start gap-2">
            <InsertCatalog variant="screen" />
            <div className="min-w-0 flex-1">
              <PointInput phone />
            </div>
          </div>
          <PhoneNav />
        </div>
        <AreaTools
          phone
          className="min-h-0 flex-1 px-2 pt-2"
          footer={
            <div className="pt-3">
              <SelectionCard />
            </div>
          }
        />
      </main>
    </div>
  );
}

/** The modes, apart from Vários, and the hint under them, which folds away for room. */
function PhoneNav() {
  const hidden = usePanelStore((s) => s.hintsHidden);
  const setHidden = usePanelStore((s) => s.setHintsHidden);
  return (
    <div role="toolbar" aria-label="Ações da figura" className="flex flex-col gap-1">
      <div className="flex gap-1.5">
        <ModeSwitch tiles />
      </div>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">{!hidden && <SelectionSummary placement="tools" />}</div>
        <IconButton
          label={hidden ? "Mostrar dicas" : "Esconder dicas"}
          hint={hidden ? "A dica do modo e o que está selecionado voltam para cá." : "Esconde a dica e sobe o que está embaixo."}
          aria-expanded={!hidden}
          // Folded, only this is left: a slim row, so what is below moves up.
          className={cn("w-7 shrink-0 text-muted-foreground [&_svg]:h-4 [&_svg]:w-4", hidden ? "h-5" : "h-7")}
          onClick={() => setHidden(!hidden)}
        >
          {hidden ? <ChevronDown /> : <ChevronUp />}
        </IconButton>
      </div>
    </div>
  );
}

/** The menu over the preview's corner: the title, theme, Configurações, help, the figure and Prontos. */
function PhoneMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Menu"
          title="Figura, Prontos, tema, configurações e ajuda"
          className="absolute right-2 top-2 z-40 grid h-10 w-10 place-items-center rounded-full border bg-background/95 text-foreground shadow-md [&_svg]:h-5 [&_svg]:w-5"
        >
          <Menu />
        </button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        // The whole screen, so the panels have room; it closes with its X.
        className="left-0 top-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden border-0 bg-background p-2 pt-12 outline-none sm:rounded-none"
        // A focused button would open its tooltip over the menu.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <DialogTitle className="sr-only">Menu</DialogTitle>
        <SidePanel phone />
      </DialogContent>
    </Dialog>
  );
}

/** The preview's bottom edge: dragged, it makes the preview taller or shorter. */
function PreviewResizer() {
  const setShare = usePanelStore((s) => s.setPhonePreview);
  const drag = useRef<number | null>(null);
  const move = (clientY: number) => {
    const share = Math.min(MAX_SHARE, Math.max(MIN_SHARE, clientY / window.innerHeight));
    setShare(Math.round(share * 1000) / 1000);
  };
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Altura da prévia"
      tabIndex={0}
      title="Arraste para mudar a altura da prévia"
      className="absolute inset-x-0 -bottom-3 z-30 flex h-6 touch-none cursor-row-resize items-center justify-center"
      onPointerDown={(e) => {
        drag.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current === e.pointerId) move(e.clientY);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const now = usePanelStore.getState().phonePreview ?? 0.4;
        setShare(Math.min(MAX_SHARE, Math.max(MIN_SHARE, now + (e.key === "ArrowDown" ? 0.05 : -0.05))));
      }}
      onDoubleClick={() => setShare(null)}
    >
      <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
    </div>
  );
}
