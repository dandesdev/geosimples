import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomBar, type ZoomControls } from "./ZoomBar";
import { emitCommand } from "@/lib/commands";
import { Blend, ChartSpline, Download, MoveUpRight, Power, Redo2, Trash2, Undo2 } from "lucide-react";
import { ModeSwitch } from "./ModeSwitch";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { circuitOf } from "@geosimples/core/figure";
import { COMPONENT_ITEMS } from "./circuitItems";
import {
  AngleIcon,
  CircleThroughIcon,
  CloseLoopIcon,
  ConnectIcon,
  ConstructionsIcon,
  CircuitIcon,
  ExtremumIcon,
  GraphPointIcon,
  TangentIcon,
  GuidesIcon,
  PolygonIcon,
  RootsIcon,
  ToFunctionsIcon,
  YInterceptIcon,
} from "@/components/icons";
import { CIRCLE_OPTIONS, CONSTRUCTIONS, SET_ITEMS, VECTOR_ITEMS } from "./tools";
import { InsertCatalog } from "./InsertCatalog";
import { actions } from "@/lib/actions";
import {
  CONSTRUCTION_KINDS,
  NOTABLE_FEATURES,
  SET_OPERATIONS,
  VECTOR_OPERATIONS,
  previewProps,
  useAvailability,
  type Availability,
  type CheckId,
} from "@/lib/availability";
import { useFigureStore } from "@/store/figureStore";
import { cn } from "@/lib/utils";

export const Divider = ({ className, vertical = false }: { className?: string; vertical?: boolean }) => (
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

/** The Gráficos menu's actions on the selection: the menu shows while one can run. */
const GRAPH_CHECKS: CheckId[] = ["graphPoint", "guides", "construct-tangent", ...NOTABLE_FEATURES.map((f) => `notable-${f}` as const)];

/** The menus that come and go with the selection fade in, so the change is seen. */
const APPEAR = "animate-in fade-in-0 zoom-in-90";

/** Runs an action after clearing its hover preview, which would be stale afterwards. */
const act = (fn: () => void) => () => {
  clearPreview();
  fn();
};


/** Where the toolbar's menus open: below the classic row; in the pro layout, away from the edge the toolbar sits on. */
export type MenuSide = "top" | "right" | "bottom" | "left";

/**
 * The geometry tools, and the menus for the selection's kind: Gráficos,
 * Vetores and Conjuntos show only while one of their actions can run, so the
 * toolbar holds what the selection allows instead of every domain at once.
 * What needs no selection is in Inserir.
 */
export function Tools({ menuSide }: { menuSide: MenuSide }) {
  const hasSelection = useFigureStore((s) => s.selection.length > 0);
  const av = useAvailability();
  const anyCircle = CIRCLE_OPTIONS.some((o) => !av[`circle-${o.mode}`].reason);
  const anyConnect = !av.connect.reason || !av.closeContour.reason;
  const anyConstruction = CONSTRUCTION_KINDS.some((kind) => !av[`construct-${kind}`].reason);
  const hasGraph = useFigureStore((s) => s.doc.elements.some((e) => e.type === "axes" || e.type === "function"));
  const hasVector = useFigureStore((s) => s.doc.elements.some((e) => e.type === "vector"));
  // Only for a figure of that kind: two points or a segment alone don't bring in Gráficos and Vetores.
  // Inserir has their first steps, Transformar em funções and Vetor entre pontos.
  const anyGraphTool = GRAPH_CHECKS.some((id) => !av[id].reason) || (hasGraph && !av.toFunctions.reason);
  const anyVectorOp = VECTOR_OPERATIONS.some((op) => !av[`vector-${op}`].reason) || (hasVector && !av.vector.reason);
  const anySetOp = SET_OPERATIONS.some((op) => !av[`set-${op}`].reason);
  // A figure with a circuit keeps its menu: switching it on needs no selection.
  const circuitOn = useFigureStore((s) => circuitOf(s.doc)?.on);
  const hasCircuit = circuitOn !== undefined;
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

      {anyGraphTool && (
        <DropdownMenu onOpenChange={(open) => !open && clearPreview()}>
          <DropdownMenuTrigger asChild>
            <IconButton
              label="Gráficos"
              hint="Para o gráfico ou o ponto selecionado: pontos notáveis, tangente, linhas até os eixos e formas que viram funções."
              ready
              className={APPEAR}
            >
              <ChartSpline />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent {...menu} className="w-80">
            <DropdownMenuLabel>Gráficos</DropdownMenuLabel>
            <MenuItem
              icon={<GraphPointIcon />}
              title="Ponto sobre o gráfico"
              hint="Também P=f(2) na barra, ou um clique na curva."
              availability={av.graphPoint}
              onSelect={() => actions.pointOnGraph()}
            />
            <MenuItem
              icon={<TangentIcon />}
              title="Reta tangente"
              hint="No ponto selecionado sobre o gráfico. Ou clique com o botão direito na curva."
              availability={av["construct-tangent"]}
              onSelect={() => actions.construct("tangent")}
            />
            <MenuItem
              icon={<RootsIcon />}
              title="Raízes"
              hint="x₁, x₂… Seguem a função quando ela muda."
              availability={av["notable-root"]}
              onSelect={() => actions.markNotable("root")}
            />
            <MenuItem
              icon={<ExtremumIcon />}
              title="Máximos e mínimos"
              hint="O vértice V, ou cada pico e vale."
              availability={av["notable-extremum"]}
              onSelect={() => actions.markNotable("extremum")}
            />
            <MenuItem
              icon={<YInterceptIcon />}
              title="Corte no eixo y"
              hint="O ponto (0; f(0))."
              availability={av["notable-yAxis"]}
              onSelect={() => actions.markNotable("yAxis")}
            />
            <MenuItem
              icon={<GuidesIcon />}
              title="Linhas até os eixos"
              hint="Tracejadas, do ponto aos eixos. Liga e desliga."
              availability={av.guides}
              onSelect={actions.toggleGuides}
            />
            <DropdownMenuSeparator />
            <MenuItem
              icon={<ToFunctionsIcon />}
              title="Transformar em funções"
              hint="Segmentos viram retas; circunferências, duas metades."
              availability={av.toFunctions}
              onSelect={actions.toFunctions}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {anyVectorOp && (
        <DropdownMenu onOpenChange={(open) => !open && clearPreview()}>
          <DropdownMenuTrigger asChild>
            <IconButton
              label="Vetores"
              hint="Com os pontos ou vetores selecionados: seta, soma, diferença, projeção, versor e componentes."
              ready
              className={APPEAR}
            >
              <MoveUpRight />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent {...menu} className="w-80">
            <DropdownMenuLabel>Vetores</DropdownMenuLabel>
            <MenuItem icon={<MoveUpRight />} title="Vetor entre pontos" hint="A origem primeiro, depois a extremidade." availability={av.vector} onSelect={actions.vector} />
            <DropdownMenuSeparator />
            {VECTOR_ITEMS.map((item) => (
              <MenuItem
                key={item.op}
                icon={<MoveUpRight />}
                title={item.title}
                hint={item.hint}
                availability={av[`vector-${item.op}`]}
                onSelect={() => actions.vectorOp(item.op)}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {hasCircuit && (
        <DropdownMenu onOpenChange={(open) => !open && clearPreview()}>
          <DropdownMenuTrigger asChild>
            <IconButton label="Circuito" hint="Ligar o circuito, indicar o sentido da corrente e pôr componentes entre dois pontos." ready className={APPEAR}>
              <CircuitIcon />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent {...menu} className="w-80">
            <DropdownMenuLabel>Circuito</DropdownMenuLabel>
            <MenuItem
              icon={<Power />}
              title={circuitOn ? "Desligar circuito" : "Ligar circuito"}
              hint={circuitOn ? "Volta ao enunciado, sem os valores." : "Escreve a corrente e a tensão de cada componente, e o que os medidores marcam."}
              availability={av.circuitPower}
              onSelect={() => actions.circuit({ on: !circuitOn })}
            />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-3 py-2">
                <span className="[&_svg]:h-5 [&_svg]:w-5">
                  <MoveUpRight />
                </span>
                <span className="font-medium">Indicar sentido da corrente</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-72">
                <MenuItem
                  icon={<MoveUpRight />}
                  title="Sentido real (elétrons)"
                  hint="Do polo negativo ao positivo, por fora do gerador."
                  availability={av["current-real"]}
                  onSelect={() => actions.circuit({ current: "real" })}
                />
                <MenuItem
                  icon={<MoveUpRight />}
                  title="Sentido convencional"
                  hint="Do polo positivo ao negativo, por fora do gerador."
                  availability={av["current-conventional"]}
                  onSelect={() => actions.circuit({ current: "conventional" })}
                />
                <MenuItem icon={<MoveUpRight />} title="Não indicar" hint="Sem setas." availability={av["current-none"]} onSelect={() => actions.circuit({ current: "none" })} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Entre os dois pontos selecionados</DropdownMenuLabel>
            {COMPONENT_ITEMS.map((item) => (
              <MenuItem
                key={item.kind}
                icon={<item.Icon />}
                title={item.title}
                hint={item.hint}
                availability={av[`component-${item.kind}`]}
                onSelect={() => actions.component(item.kind)}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {anySetOp && (
        <DropdownMenu onOpenChange={(open) => !open && clearPreview()}>
          <DropdownMenuTrigger asChild>
            <IconButton label="Conjuntos" hint="União, interseção, diferença e complementar, marcadas no diagrama." ready className={APPEAR}>
              <Blend />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent {...menu} className="w-80">
            <DropdownMenuLabel>Conjuntos</DropdownMenuLabel>
            {SET_ITEMS.map((item) => (
              <MenuItem
                key={item.op}
                icon={<item.Icon />}
                title={item.title}
                hint={item.hint}
                availability={av[`set-${item.op}`]}
                onSelect={() => actions.setOperation(item.op)}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

export function DeleteButton() {
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

export function History() {
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

/** Export as a square button, for the pro layout's toolbars. */
export function ExportIconButton() {
  const isEmpty = useFigureStore((s) => s.doc.elements.length === 0);
  return (
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
  );
}

/**
 * The figure's tools over the preview. `layout` is "row", or "strip" on phones:
 * one row that scrolls sideways, with the zoom controls (`zoom`) that don't
 * fit over the preview.
 */
export function ActionBar({ layout, zoom = null }: { layout: "row" | "strip"; zoom?: ZoomControls | null }) {
  const isEmpty = useFigureStore((s) => s.doc.elements.length === 0);

  return (
    <div
      role="toolbar"
      aria-label="Ações da figura"
      className={cn(
        // A container, so labels drop when the preview is narrow rather than the row wrapping.
        "@container flex shrink-0 items-center gap-0.5 border-b bg-background px-2 py-1.5",
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
        <span className="hidden @[54rem]:inline">Exportar</span>
      </Button>
      <Divider />
      <History />
      {layout === "strip" ? (
        // Phones: one row that scrolls sideways, instead of two rows over the small preview.
        // Inserir stays out of it, always in view.
        <>
          <Divider />
          <InsertCatalog side="bottom" />
          <Divider />
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
        </>
      ) : (
        <>
          <DeleteButton />
          <Divider />
          <InsertCatalog side="bottom" wideLabel />
          <Divider />
          <Tools menuSide="bottom" />
          {/* At the far end, so menus that come and go with the selection don't move it. */}
          <div className="ml-auto flex items-center gap-0.5 pl-1">
            <ModeSwitch />
          </div>
        </>
      )}
    </div>
  );
}
