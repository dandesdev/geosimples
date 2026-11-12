import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { TooltipSide } from "@/components/tooltipSide";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { previewProps, useAvailability, useInsertAvailability } from "@/lib/availability";
import { canPick, startTool } from "@/lib/toolPick";
import { paperColor } from "@geosimples/core/figure";
import { usePreviewPaper } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useFigureStore } from "@/store/figureStore";
import { usePanelStore, type AreaId } from "@/store/panelStore";
import { AREAS, type AreaTool, type ToolContext } from "./areas";

/**
 * Ferramentas as a bar (the pro layout's "Mostrar como barra"): the areas as
 * a column of icon tabs, and beside them the open area's tools as one column
 * of icons, named by their tooltips. When they don't all fit, an arrow at the
 * end that has more scrolls to it.
 */
export function ToolsStrip() {
  const area = usePanelStore((s) => s.area);
  const paper = usePreviewPaper();
  const setArea = usePanelStore((s) => s.setArea);
  const hasSelection = useFigureStore((s) => s.selection.length > 0);
  const c: ToolContext = {
    av: useAvailability(),
    ins: useInsertAvailability(),
    doc: useFigureStore((s) => s.doc),
  };
  return (
    // The bar sits between the preview and the panels: tooltips open over the preview.
    <TooltipSide.Provider value="left">
      <Tabs value={area} onValueChange={(v) => setArea(v as AreaId)} orientation="vertical" data-tools-bar="" className="flex h-full min-h-0">
        {/*
          Folder tabs on the side of the column, over the preview's paper: under the last tab the preview
          goes on, instead of a second strip down the whole height. The open tab takes the column's
          color and covers its border, so it reads as one piece with its tools.
        */}
        <TabsList
          aria-label="Ferramentas por área"
          className="flex h-full w-[30px] shrink-0 flex-col items-stretch justify-start gap-[3px] rounded-none bg-transparent p-0 pt-2"
          // The preview's paper comes from core, as the preview's own background does.
          style={{ backgroundColor: paperColor(paper) }}
        >
          {AREAS.map((a) => (
            <TabsTrigger
              key={a.id}
              value={a.id}
              title={a.title}
              aria-label={a.title}
              className="relative z-10 -mr-px ml-1 h-[30px] rounded-none rounded-l-md border border-r-0 bg-muted p-0 text-muted-foreground hover:text-foreground data-[state=active]:ml-0 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-none [&_svg]:h-4 [&_svg]:w-4"
            >
              <a.Icon />
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollColumn>
          {AREAS.map((a) => (
            <TabsContent key={a.id} value={a.id} aria-label={a.title} className="mt-0 flex flex-col items-center py-1">
              {a.groups.map((g, i) => (
                <Fragment key={g.title}>
                  {i > 0 && <div aria-hidden="true" className="my-1.5 h-px w-6 shrink-0 bg-border" />}
                  <div role="group" aria-label={g.title} className="flex flex-col items-center gap-1">
                    {g.tools.map((t) => (
                      <StripTool key={t.id} tool={t} c={c} ready={hasSelection && g.title !== "Inserir"} />
                    ))}
                  </div>
                </Fragment>
              ))}
            </TabsContent>
          ))}
        </ScrollColumn>
      </Tabs>
    </TooltipSide.Provider>
  );
}

/**
 * One tool as an icon. As on the tiles, one that can't run now stays legible
 * but flat, with a dashed outline; the ones with a card are the ones that work,
 * now or by choosing the tool first and then clicking its objects.
 */
function StripTool({ tool, c, ready }: { tool: AreaTool; c: ToolContext; ready: boolean }) {
  const availability = tool.availability(c);
  const waiting = useFigureStore((s) => s.tool?.id === tool.id);
  const pickable = !!availability.reason && canPick(tool.id, c.doc);
  const blocked = !!availability.reason && !pickable;
  return (
    <IconButton
      label={tool.title}
      hint={pickable ? `${tool.hint} Ou escolha a ferramenta e depois clique nos objetos.` : tool.hint}
      unavailable={blocked ? availability.reason : null}
      ready={ready && !availability.reason}
      active={waiting || tool.active?.(c)}
      className={cn("border", blocked ? "border-dashed bg-transparent text-foreground/80 hover:text-foreground" : !waiting && "bg-card")}
      onClick={() => {
        useFigureStore.getState().setActionPreview(null);
        if (pickable || waiting) startTool(tool.id, tool.title);
        else tool.run(c);
      }}
      {...(pickable ? {} : previewProps(availability))}
    >
      <tool.Icon />
    </IconButton>
  );
}

/** A column that scrolls without a scrollbar: arrows show at the ends that have more, and scroll to it. */
function ScrollColumn({ children }: { children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ up: false, down: false });
  const measure = () => {
    const el = scroller.current;
    if (!el) return;
    const up = el.scrollTop > 1;
    const down = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setMore((was) => (was.up === up && was.down === down ? was : { up, down }));
  };
  useEffect(() => {
    const observer = new ResizeObserver(measure);
    if (scroller.current) observer.observe(scroller.current);
    // Another area, or tools that appear and go, change how much there is.
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, []);
  const scroll = (direction: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ top: direction * el.clientHeight * 0.75, behavior: "smooth" });
  };
  const arrow = "absolute inset-x-0 z-10 grid h-6 place-items-center bg-card/95 text-muted-foreground hover:text-foreground [&_svg]:h-4 [&_svg]:w-4";
  return (
    <div className="relative min-h-0 min-w-0 flex-1 border-l bg-card">
      <div
        ref={scroller}
        data-area-scroll=""
        onScroll={measure}
        className="h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div ref={content}>{children}</div>
      </div>
      {more.up && (
        <button type="button" aria-label="Rolar para cima" title="Rolar para cima" className={cn(arrow, "top-0 border-b")} onClick={() => scroll(-1)}>
          <ChevronUp />
        </button>
      )}
      {more.down && (
        <button type="button" aria-label="Rolar para baixo" title="Rolar para baixo" className={cn(arrow, "bottom-0 border-t")} onClick={() => scroll(1)}>
          <ChevronDown />
        </button>
      )}
    </div>
  );
}
