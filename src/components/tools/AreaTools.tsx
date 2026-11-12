import type { ReactNode } from "react";
import { IconButton } from "@/components/IconButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { previewProps, useAvailability, useInsertAvailability } from "@/lib/availability";
import { cn } from "@/lib/utils";
import { useFigureStore } from "@/store/figureStore";
import { usePanelStore, type AreaId } from "@/store/panelStore";
import { AREAS, type AreaTool, type ToolContext } from "./areas";

/**
 * The tools by kind of figure, one tab each: what inserts something new and
 * what builds on the selection, as named tiles. The same on a desktop panel
 * and on a phone, where `phone` makes the tiles a little bigger and the tabs
 * stay put while the tiles scroll under them.
 */
export function AreaTools({ phone = false, className, footer }: { phone?: boolean; className?: string; footer?: ReactNode }) {
  const area = usePanelStore((s) => s.area);
  const setArea = usePanelStore((s) => s.setArea);
  const hasSelection = useFigureStore((s) => s.selection.length > 0);
  const c: ToolContext = {
    av: useAvailability(),
    ins: useInsertAvailability(),
    doc: useFigureStore((s) => s.doc),
  };
  return (
    <Tabs value={area} onValueChange={(v) => setArea(v as AreaId)} className={cn("@container flex min-h-0 flex-col", className)}>
      {/*
        Tabs on a line, not in a tinted box: the open one is underlined in the accent, the others in a quieter tone,
        so the contrast goes to what is chosen rather than to the box around the choices.
      */}
      <TabsList aria-label="Ferramentas por área" className="grid h-auto w-full shrink-0 grid-cols-6 gap-0.5 rounded-none border-b bg-transparent p-0">
        {AREAS.map((a) => (
          <TabsTrigger
            key={a.id}
            value={a.id}
            title={a.title}
            className="-mb-px flex h-auto min-w-0 flex-col gap-0.5 rounded-none border-b-2 border-transparent px-0.5 pb-1 pt-1.5 text-[10px] leading-tight hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none [&_svg]:h-4 [&_svg]:w-4"
          >
            <a.Icon />
            <span className="max-w-full truncate">{a.title}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {/* The tabs stay put; the tiles (and what comes after them) scroll. */}
      <div data-area-scroll="" className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", phone ? "pb-3" : "pb-1")}>
        {AREAS.map((a) => (
          <TabsContent key={a.id} value={a.id} aria-label={a.title} className="space-y-3">
            {a.groups.map((g) => (
              <section key={g.title} aria-label={g.title}>
                <h3 className="px-0.5 pb-1 text-xs font-semibold text-muted-foreground">{g.title}</h3>
                <div className="grid grid-cols-4 gap-1.5 @md:grid-cols-6 @2xl:grid-cols-8">
                  {g.tools.map((t) => (
                    <Tile key={t.id} tool={t} c={c} ready={hasSelection && g.title !== "Inserir"} hoverTip={!phone} />
                  ))}
                </div>
              </section>
            ))}
          </TabsContent>
        ))}
        {footer}
      </div>
    </Tabs>
  );
}

function Tile({ tool, c, ready, hoverTip }: { tool: AreaTool; c: ToolContext; ready: boolean; hoverTip: boolean }) {
  const availability = tool.availability(c);
  return (
    <IconButton
      label={tool.title}
      text={tool.short}
      hint={tool.hint}
      hoverTip={hoverTip}
      unavailable={availability.reason}
      ready={ready && !availability.reason}
      active={tool.active?.(c)}
      onClick={() => {
        useFigureStore.getState().setActionPreview(null);
        tool.run(c);
      }}
      {...previewProps(availability)}
    >
      <tool.Icon />
    </IconButton>
  );
}
