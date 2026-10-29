import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, EllipsisVertical, Maximize2, Minimize2, X } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useWorkspaceStore, WINDOW_TITLES, type Rect, type WindowId } from "@/store/workspaceStore";
import { windowMenuItems } from "./windowMenu";

/** Small square buttons for the title bar. */
function TitleButton({ label, onClick, children }: { label: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:h-3.5 [&_svg]:w-3.5"
    >
      {children}
    </button>
  );
}

/** Which edges of a floating window resize it. */
export type ResizeEdge = "e" | "s" | "se" | "w" | "sw";

const RESIZE_HANDLES: { edge: ResizeEdge; className: string }[] = [
  { edge: "e", className: "inset-y-2 -right-1 w-2 cursor-ew-resize" },
  { edge: "w", className: "inset-y-2 -left-1 w-2 cursor-ew-resize" },
  { edge: "s", className: "inset-x-2 -bottom-1 h-2 cursor-ns-resize" },
  { edge: "se", className: "-bottom-1 -right-1 h-3 w-3 cursor-nwse-resize" },
  { edge: "sw", className: "-bottom-1 -left-1 h-3 w-3 cursor-nesw-resize" },
];

/**
 * One window of the pro layout: a title bar to drag, collapse, maximize and
 * close it, with all of that and docking in its right-click menu.
 *
 * `variant` is where it sits: stacked in a side dock ("column"), side by side
 * in a top or bottom dock ("row"), floating at `rect`, or filling the work area.
 * `fit` windows take their content's height in a column instead of sharing it.
 */
export function PanelWindow({
  id,
  variant,
  rect,
  fit = false,
  dragging = false,
  onTitlePointerDown,
  onResizePointerDown,
  onFloat,
  children,
}: {
  id: WindowId;
  variant: "column" | "row" | "float" | "max";
  rect?: Rect;
  fit?: boolean;
  dragging?: boolean;
  onTitlePointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onResizePointerDown?: (e: React.PointerEvent<HTMLElement>, edge: ResizeEdge) => void;
  /** Takes the window out of its dock, to float over the preview. */
  onFloat: () => void;
  children: ReactNode;
}) {
  const collapsed = useWorkspaceStore((s) => s.windows[id].collapsed) && variant !== "max";
  const maximized = variant === "max";
  const ws = useWorkspaceStore.getState;
  const title = WINDOW_TITLES[id];
  // Read when a menu opens, so it shows the state at that moment.
  const items = () => windowMenuItems(id, onFloat);

  return (
    <section
      aria-label={title}
      data-window={id}
      onPointerDownCapture={() => variant === "float" && ws().focus(id)}
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden bg-card",
        variant === "column" && (collapsed || fit ? "flex-none" : "min-h-28 flex-1 basis-0"),
        variant === "row" && (collapsed ? "w-48 flex-none" : "min-w-56 flex-1 basis-0"),
        variant === "float" && "absolute rounded-lg border shadow-xl",
        maximized && "absolute inset-0 z-40",
        dragging && "opacity-90 shadow-2xl ring-2 ring-primary/60",
      )}
      // Floating windows are placed by the pointer: data, not styling.
      style={variant === "float" && rect ? { left: rect.x, top: rect.y, width: rect.w, height: collapsed ? undefined : rect.h } : undefined}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <header
            onPointerDown={onTitlePointerDown}
            onDoubleClick={(e) => {
              if ((e.target as Element).closest("button")) return;
              ws().setCollapsed(id, !collapsed);
            }}
            className={cn(
              "flex h-8 shrink-0 cursor-grab touch-none select-none items-center gap-1 border-b bg-muted/40 pl-1 pr-1 active:cursor-grabbing",
              collapsed && "border-b-0",
            )}
          >
            <TitleButton label={collapsed ? "Expandir" : "Minimizar"} onClick={() => ws().setCollapsed(id, !collapsed)}>
              {collapsed ? <ChevronRight /> : <ChevronDown />}
            </TitleButton>
            <h2 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <TitleButton label="Opções da janela">
                  <EllipsisVertical />
                </TitleButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {items().map((item) => [
                  item.group && <DropdownMenuSeparator key={`${item.label}-sep`} />,
                  <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
                    {item.label}
                  </DropdownMenuItem>,
                ])}
              </DropdownMenuContent>
            </DropdownMenu>
            <TitleButton
              label={maximized ? "Restaurar tamanho" : "Maximizar"}
              onClick={() => ws().setMaximized(maximized ? null : id)}
            >
              {maximized ? <Minimize2 /> : <Maximize2 />}
            </TitleButton>
            <TitleButton label="Fechar" onClick={() => ws().setClosed(id, true)}>
              <X />
            </TitleButton>
          </header>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          {items().map((item) => [
            item.group && <ContextMenuSeparator key={`${item.label}-sep`} />,
            <ContextMenuItem key={item.label} onSelect={item.onSelect}>
              {item.label}
            </ContextMenuItem>,
          ])}
        </ContextMenuContent>
      </ContextMenu>
      {!collapsed && <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>}
      {variant === "float" &&
        !collapsed &&
        onResizePointerDown &&
        RESIZE_HANDLES.map((h) => (
          <div
            key={h.edge}
            aria-hidden="true"
            onPointerDown={(e) => onResizePointerDown(e, h.edge)}
            className={cn("absolute z-10 touch-none", h.className)}
          />
        ))}
    </section>
  );
}
