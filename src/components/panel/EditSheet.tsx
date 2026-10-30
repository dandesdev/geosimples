import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { IconButton } from "@/components/IconButton";
import { useFigureStore } from "@/store/figureStore";
import { usePanelStore } from "@/store/panelStore";
import { Formatting } from "./Formatting";
import { Properties } from "./Properties";
import { SelectionHeader } from "./SelectionHeader";

/**
 * Propriedades and Formatação in a sheet over the bottom of the screen, for
 * layouts where the side panel sits below the page fold. It opens while
 * something is selected, so the figure stays in view while it is edited.
 */
export function EditSheet() {
  const hasSelection = useFigureStore((s) => s.selection.length > 0);
  // Remounts for each new selection, so a sheet left minimized opens again.
  return hasSelection ? <Sheet /> : null;
}

function Sheet() {
  const [minimized, setMinimized] = useState(false);
  const open = usePanelStore((s) => s.open);
  const setOpen = usePanelStore((s) => s.setOpen);
  const clear = useFigureStore((s) => s.clearSelection);
  const ref = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      {/* Room at the end of the page, so nothing stays hidden under the sheet. Its height comes from the sheet. */}
      <div aria-hidden="true" className="shrink-0" style={{ height }} />
      <section
        ref={ref}
        aria-label="Editar seleção"
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-[45dvh] flex-col rounded-t-xl border-t bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.08)]"
      >
        <div className="flex items-start gap-1 px-4">
          <div className="min-w-0 flex-1">
            <SelectionHeader bordered={false} />
          </div>
          <div className="flex shrink-0 gap-0.5 pt-2">
            <IconButton
              label={minimized ? "Mostrar ajustes" : "Recolher ajustes"}
              onClick={() => setMinimized(!minimized)}
            >
              {minimized ? <ChevronUp /> : <ChevronDown />}
            </IconButton>
            <IconButton label="Limpar seleção" shortcut="clearSelection" onClick={clear}>
              <X />
            </IconButton>
          </div>
        </div>
        {!minimized && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
            <Accordion type="multiple" value={open} onValueChange={setOpen}>
              <AccordionItem value="properties">
                <AccordionTrigger>Propriedades</AccordionTrigger>
                <AccordionContent>
                  <Properties />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="formatting" className="border-b-0">
                <AccordionTrigger>Formatação</AccordionTrigger>
                <AccordionContent>
                  <Formatting />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </section>
    </>
  );
}
