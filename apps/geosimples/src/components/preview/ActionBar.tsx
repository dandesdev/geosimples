import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomBar, type ZoomControls } from "./ZoomBar";
import { emitCommand } from "@/lib/commands";
import { ChartSpline, Download, Redo2, Trash2, Undo2 } from "lucide-react";
import { ModeSwitch } from "./ModeSwitch";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AngleIcon,
  CircleThroughIcon,
  CloseLoopIcon,
  ConnectIcon,
  ConstructionsIcon,
  PolygonIcon,
} from "@/components/icons";
import { CIRCLE_OPTIONS, CONSTRUCTIONS } from "./tools";
import { actions } from "@/lib/actions";
import { CONSTRUCTION_KINDS, previewProps, useAvailability, type Availability } from "@/lib/availability";
import { useFigureStore } from "@/store/figureStore";
import { cn } from "@/lib/utils";

const Divider = ({ className, vertical = false }: { className?: string; vertical?: boolean }) => (
  <div
    className={cn("shrink-0 bg-border", vertical ? "my-1 h-px w-6" : "mx-1 h-6 w-px", className)}
    aria-hidden="true"
  />
);

function MenuItem({
  icon,
  title,
  hint,
  availability,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  availability: Availability;
  onSelect: () => void;
}) {
  const reason = availability.reason;
  return (
    <DropdownMenuItem
      onSelect={() => {
        clearPreview();
        onSelect();
      }}
      // Unavailable items stay in the menu, grayed, with what is missing.
      disabled={reason !== null}
      className="items-start gap-3 py-2"
      {...previewProps(availability)}
    >
      <span className="mt-0.5 [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      <span className="flex flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
        {reason && <span className="mt-0.5 text-xs text-destructive">{reason}</span>}
      </span>
    </DropdownMenuItem>
  );
}


/**
 * A row of tools that scrolls sideways, with a fade on the side that has more,
 * so it reads as a strip to swipe rather than a toolbar that ends.
 */
function ToolStrip({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setMore({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);
  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={ref}
        onScroll={measure}
        className="flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none] *:shrink-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {more.left && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background" />
      )}
      {more.right && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background" />
      )}
    </div>
  );
}

const clearPreview = () => useFigureStore.getState().setActionPreview(null);

/** Runs an action after clearing its hover preview, which would be stale afterwards. */
const act = (fn: () => void) => () => {
  clearPreview();
  fn();
};


/** Where the toolbar's menus open: below a row, to the right of the pro layout's column. */
type MenuSide = "bottom" | "right";

function Tools({ menuSide }: { menuSide: MenuSide }) {
  const hasSelection = useFigureStore((s) => s.selection.length > 0);
  const av = useAvailability();
  const anyCircle = CIRCLE_OPTIONS.some((o) => !av[`circle-${o.mode}`].reason);
  const anyConnect = !av.connect.reason || !av.closeContour.reason;
  const anyConstruction = CONSTRUCTION_KINDS.some((kind) => !av[`construct-${kind}`].reason);
  const menu = { side: menuSide, align: "start" } as const;
  return (
    <>
      <DropdownMenu onOpenChange={(open) => !open && clearPreview()}>
        <DropdownMenuTrigger asChild>
          <IconButton
            label="Ligar pontos"
            shortcut="connect"
            hint="Cria segmentos entre os pontos selecionados, na ordem da seleção."
            dimmed={!anyConnect}
            ready={hasSelection && anyConnect}
          >
            <ConnectIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent {...menu} className="w-72">
          <DropdownMenuLabel>Ligar pontos selecionados</DropdownMenuLabel>
          <MenuItem
            icon={<ConnectIcon />}
            title="Em sequência"
            hint="A, B, C → segmentos AB e BC"
            availability={av.connect}
            onSelect={() => actions.connect(false)}
          />
          <MenuItem
            icon={<CloseLoopIcon />}
            title="Fechando o contorno"
            hint="A, B, C → segmentos AB, BC e CA"
            availability={av.closeContour}
            onSelect={() => actions.connect(true)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <IconButton
        label="Marcar ângulo"
        shortcut="angle"
        hint="Selecione A, B, C para marcar o ângulo em B, ou um polígono para marcar todos os seus ângulos."
        unavailable={av.angle.reason}
        ready={hasSelection}
        onClick={act(actions.angles)}
        {...previewProps(av.angle)}
      >
        <AngleIcon />
      </IconButton>

      <IconButton
        label="Polígono e preenchimento"
        shortcut="polygon"
        hint="Selecione os vértices em ordem, ou os segmentos de um contorno fechado. Circunferências e polígonos selecionados também são preenchidos."
        unavailable={av.polygon.reason}
        ready={hasSelection}
        onClick={act(actions.polygon)}
        {...previewProps(av.polygon)}
      >
        <PolygonIcon />
      </IconButton>

      <DropdownMenu onOpenChange={(open) => !open && clearPreview()}>
        <DropdownMenuTrigger asChild>
          <IconButton
            label="Circunferência"
            hint="Escolha como construir a partir da seleção."
            dimmed={!anyCircle}
            ready={hasSelection && anyCircle}
          >
            <CircleThroughIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent {...menu} className="w-80">
          <DropdownMenuLabel>Circunferência</DropdownMenuLabel>
          {CIRCLE_OPTIONS.map((o) => (
            <MenuItem
              key={o.mode}
              icon={<o.Icon />}
              title={o.title}
              hint={o.hint}
              availability={av[`circle-${o.mode}`]}
              onSelect={() => actions.circle(o.mode)}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu onOpenChange={(open) => !open && clearPreview()}>
        <DropdownMenuTrigger asChild>
          <IconButton
            label="Construções"
            hint="Ponto médio, altura, projeção ortogonal, mediana, bissetriz, mediatriz e interseção. O que é construído acompanha os pontos quando eles se movem."
            dimmed={!anyConstruction}
            ready={hasSelection && anyConstruction}
          >
            <ConstructionsIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent {...menu} className="w-80">
          <DropdownMenuLabel>Construções</DropdownMenuLabel>
          {CONSTRUCTION_KINDS.map((kind) => {
            const { Icon, title, hint } = CONSTRUCTIONS[kind];
            return (
              <MenuItem
                key={kind}
                icon={<Icon />}
                title={title}
                hint={hint}
                availability={av[`construct-${kind}`]}
                onSelect={() => actions.construct(kind)}
              />
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <IconButton
        label="Gráfico de função"
        hint="Escreve y = na barra de pontos: complete com a expressão, como x^2 - 1 ou 2sen(x), e tecle Enter. Os eixos vêm junto."
        onClick={actions.startGraph}
      >
        <ChartSpline />
      </IconButton>
    </>
  );
}

function DeleteButton() {
  const hasSelection = useFigureStore((s) => s.selection.length > 0);
  const isEmpty = useFigureStore((s) => s.doc.elements.length === 0);
  return (
    <IconButton
      label={hasSelection ? "Apagar selecionados" : "Limpar figura"}
      hint={hasSelection ? "Apaga também o que depende deles." : "Sem seleção, apaga a figura inteira."}
      shortcut={hasSelection ? "delete" : undefined}
      onClick={() => (hasSelection ? actions.deleteSelected() : emitCommand("confirmClear"))}
      disabled={isEmpty}
    >
      <Trash2 />
    </IconButton>
  );
}

function History() {
  const canUndo = useFigureStore((s) => s.past.length > 0);
  const canRedo = useFigureStore((s) => s.future.length > 0);
  const store = useFigureStore.getState;
  return (
    <>
      <IconButton label="Desfazer" shortcut="undo" onClick={() => store().undo()} disabled={!canUndo}>
        <Undo2 />
      </IconButton>
      <IconButton label="Refazer" shortcut="redo" onClick={() => store().redo()} disabled={!canRedo}>
        <Redo2 />
      </IconButton>
    </>
  );
}

/**
 * The figure's tools. `layout` is "row" over the preview, "strip" on phones
 * (one row that scrolls sideways, with the zoom controls, `zoom`, that don't
 * fit over the preview) or "column" in the pro layout's tool column.
 */
export function ActionBar({ layout, zoom = null }: { layout: "row" | "strip" | "column"; zoom?: ZoomControls | null }) {
  const isEmpty = useFigureStore((s) => s.doc.elements.length === 0);

  if (layout === "column") {
    return (
      <div role="toolbar" aria-label="Ações da figura" aria-orientation="vertical" className="flex flex-col items-center gap-0.5">
        <IconButton
          label="Exportar"
          hint="TikZ, SVG ou PNG."
          shortcut="export"
          onClick={() => emitCommand("export")}
          disabled={isEmpty}
          className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
        >
          <Download />
        </IconButton>
        <Divider vertical />
        <History />
        <DeleteButton />
        <Divider vertical />
        <Tools menuSide="right" />
        <Divider vertical />
        <ModeSwitch vertical />
      </div>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label="Ações da figura"
      className={cn(
        "flex shrink-0 items-center gap-0.5 border-b bg-background px-2 py-1.5",
        layout === "strip" ? "flex-nowrap" : "flex-wrap",
      )}
    >
      <Button
        size="sm"
        className="mr-1 shrink-0"
        onClick={() => emitCommand("export")}
        disabled={isEmpty}
        title="Exportar"
        aria-label="Exportar"
      >
        <Download />
        <span className="hidden sm:inline">Exportar</span>
      </Button>
      <Divider />
      <History />
      {layout === "strip" ? (
        // Phones: one row that scrolls sideways, instead of two rows over the small preview.
        <ToolStrip>
          {/* Modes first: on a phone, tapping points in is how a figure usually starts. */}
          <ModeSwitch />
          <Divider />
          <Tools menuSide="bottom" />
          {zoom && <Divider />}
          {zoom && <ZoomBar {...zoom} placement="toolbar" />}
          <Divider />
          <DeleteButton />
        </ToolStrip>
      ) : (
        <>
          <DeleteButton />
          <Divider />
          <Tools menuSide="bottom" />
          <Divider className="hidden sm:block" />
          <ModeSwitch />
        </>
      )}
    </div>
  );
}
