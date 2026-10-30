import type { ReactNode } from "react";
import { Keyboard, Plus, Scan, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { formatNumber, type Vec } from "@geosimples/core/figure";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AngleIcon,
  CircleThroughIcon,
  CloseLoopIcon,
  ConnectIcon,
  ConstructionsIcon,
  ExtremumIcon,
  GraphPointIcon,
  GuidesIcon,
  PolygonIcon,
  RootsIcon,
  ToFunctionsIcon,
  YInterceptIcon,
} from "@/components/icons";
import { ShortcutKeys } from "@/components/ShortcutKeys";
import { actions } from "@/lib/actions";
import { CONSTRUCTION_KINDS, previewProps, useAvailability, type Availability } from "@/lib/availability";
import { emitCommand } from "@/lib/commands";
import { useCoarsePointer } from "@/lib/useMediaQuery";
import { runAction } from "@/lib/useShortcuts";
import { useFigureStore } from "@/store/figureStore";
import type { ActionId } from "@/store/prefsStore";
import { CIRCLE_OPTIONS, CONSTRUCTIONS } from "./tools";
import type { ZoomControls } from "./ZoomBar";

const clearPreview = () => useFigureStore.getState().setActionPreview(null);

function Keys({ action }: { action: ActionId }) {
  return (
    <ContextMenuShortcut>
      <ShortcutKeys action={action} />
    </ContextMenuShortcut>
  );
}

/** An action on the selection, previewed on hover. The menu only lists the ones that can run. */
function ActionItem({
  icon,
  title,
  availability,
  shortcut,
  onSelect,
}: {
  icon: ReactNode;
  title: string;
  availability: Availability;
  shortcut?: ActionId;
  onSelect: () => void;
}) {
  if (availability.reason !== null) return null;
  return (
    <ContextMenuItem
      onSelect={() => {
        clearPreview();
        onSelect();
      }}
      {...previewProps(availability)}
    >
      {icon}
      {title}
      {shortcut && <Keys action={shortcut} />}
    </ContextMenuItem>
  );
}

/**
 * What can be done right where the preview was right-clicked: with the
 * actions that apply to the selection (a right click on an object selects it
 * first, as in desktop drawing apps), or, on an empty spot, adding a point
 * there and the view. Everything else lives in the toolbars.
 * `at` is the spot clicked, in world units, for "Adicionar ponto aqui".
 */
export function PreviewMenu({
  enabled,
  at,
  zoom,
  children,
}: {
  /** Only the pro layout has it; the classic page keeps the browser's menu. */
  enabled: boolean;
  at: Vec | null;
  zoom: ZoomControls | null;
  children: ReactNode;
}) {
  // A long press on a touch screen stays a press: phones have the toolbar for all of this.
  const coarse = useCoarsePointer();
  return (
    <ContextMenu onOpenChange={(open) => !open && clearPreview()}>
      <ContextMenuTrigger asChild disabled={!enabled || coarse}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-72" collisionPadding={8}>
        <MenuBody at={at} zoom={zoom} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function MenuBody({ at, zoom }: { at: Vec | null; zoom: ZoomControls | null }) {
  const hasSelection = useFigureStore((s) => s.selection.length > 0);
  const isEmpty = useFigureStore((s) => s.doc.elements.length === 0);
  const showGrid = useFigureStore((s) => s.settings.showGrid);
  const store = useFigureStore.getState;

  return (
    <>
      {at && (
        <ContextMenuItem onSelect={() => actions.addPointAt(at)}>
          <Plus />
          Adicionar ponto aqui
          <ContextMenuShortcut>
            ({formatNumber(at.x)}; {formatNumber(at.y)})
          </ContextMenuShortcut>
        </ContextMenuItem>
      )}
      {/* What was clicked decides: an object (it got selected) or an empty spot (`at`), whatever else is selected. */}
      {hasSelection && !at ? (
        <SelectionActions />
      ) : (
        <>
          <ContextMenuItem onSelect={() => emitCommand("focusInput")}>
            <Keyboard />
            Digitar pontos ou funções…
            <Keys action="focusInput" />
          </ContextMenuItem>
          {!isEmpty && (
            <ContextMenuItem inset onSelect={() => runAction("selectAll")}>
              Selecionar tudo
              <Keys action="selectAll" />
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Scan />
              Vista
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-64">
              <ContextMenuItem disabled={!zoom} onSelect={zoom?.onZoomIn}>
                <ZoomIn />
                Aproximar
                <Keys action="zoomIn" />
              </ContextMenuItem>
              <ContextMenuItem disabled={!zoom} onSelect={zoom?.onZoomOut}>
                <ZoomOut />
                Afastar
                <Keys action="zoomOut" />
              </ContextMenuItem>
              <ContextMenuCheckboxItem
                disabled={!zoom}
                checked={zoom?.autoFit ?? true}
                onCheckedChange={() => zoom?.onToggleAutoFit()}
              >
                Enquadrar automaticamente
                <Keys action="toggleAutoFit" />
              </ContextMenuCheckboxItem>
              <ContextMenuCheckboxItem checked={showGrid} onCheckedChange={(on) => store().setSetting("showGrid", on)}>
                Grade
                <Keys action="toggleGrid" />
              </ContextMenuCheckboxItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </>
      )}
    </>
  );
}

/** Only what the selection allows: anything unavailable is left out, not grayed. */
function SelectionActions() {
  const av = useAvailability();
  const circles = CIRCLE_OPTIONS.filter((o) => av[`circle-${o.mode}`].reason === null);
  const constructions = CONSTRUCTION_KINDS.filter((k) => av[`construct-${k}`].reason === null);
  return (
    <>
      <ActionItem icon={<ConnectIcon />} title="Ligar em sequência" shortcut="connect" availability={av.connect} onSelect={() => actions.connect(false)} />
      <ActionItem
        icon={<CloseLoopIcon />}
        title="Ligar fechando o contorno"
        shortcut="closeContour"
        availability={av.closeContour}
        onSelect={() => actions.connect(true)}
      />
      <ActionItem icon={<AngleIcon />} title="Marcar ângulo" shortcut="angle" availability={av.angle} onSelect={actions.angles} />
      <ActionItem icon={<PolygonIcon />} title="Polígono e preenchimento" shortcut="polygon" availability={av.polygon} onSelect={actions.polygon} />
      {circles.length > 0 && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <CircleThroughIcon />
            Circunferência
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            {circles.map((o) => (
              <ActionItem
                key={o.mode}
                icon={<o.Icon />}
                title={o.title}
                availability={av[`circle-${o.mode}`]}
                onSelect={() => actions.circle(o.mode)}
              />
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      {constructions.length > 0 && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <ConstructionsIcon />
            Construções
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            {constructions.map((kind) => {
              const { Icon, title } = CONSTRUCTIONS[kind];
              return (
                <ActionItem
                  key={kind}
                  icon={<Icon />}
                  title={title}
                  availability={av[`construct-${kind}`]}
                  onSelect={() => actions.construct(kind)}
                />
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      <ActionItem icon={<GraphPointIcon />} title="Ponto sobre o gráfico" availability={av.graphPoint} onSelect={actions.pointOnGraph} />
      <ActionItem icon={<RootsIcon />} title="Raízes" availability={av["notable-root"]} onSelect={() => actions.markNotable("root")} />
      <ActionItem
        icon={<ExtremumIcon />}
        title="Máximos e mínimos"
        availability={av["notable-extremum"]}
        onSelect={() => actions.markNotable("extremum")}
      />
      <ActionItem icon={<YInterceptIcon />} title="Corte no eixo y" availability={av["notable-yAxis"]} onSelect={() => actions.markNotable("yAxis")} />
      <ActionItem icon={<GuidesIcon />} title="Linhas até os eixos" availability={av.guides} onSelect={actions.toggleGuides} />
      <ActionItem icon={<ToFunctionsIcon />} title="Transformar em funções" availability={av.toFunctions} onSelect={actions.toFunctions} />
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => actions.deleteSelected()}>
        <Trash2 />
        Apagar selecionados
        <Keys action="delete" />
      </ContextMenuItem>
    </>
  );
}
