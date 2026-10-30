import type { ReactNode } from "react";
import {
  ChartSpline,
  CircleHelp,
  Download,
  Keyboard,
  LayoutDashboard,
  Plus,
  Redo2,
  Scan,
  Settings,
  SunMoon,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { formatNumber, type Vec } from "@geosimples/core/figure";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { AngleIcon, CloseLoopIcon, ConnectIcon, ConstructionsIcon, PolygonIcon, CircleThroughIcon } from "@/components/icons";
import { ShortcutKeys } from "@/components/ShortcutKeys";
import { actions } from "@/lib/actions";
import { CONSTRUCTION_KINDS, previewProps, useAvailability, type Availability } from "@/lib/availability";
import { emitCommand } from "@/lib/commands";
import { THEME_NAMES, useDarkTheme } from "@/lib/theme";
import { useCoarsePointer, useSidePanelBeside } from "@/lib/useMediaQuery";
import { runAction } from "@/lib/useShortcuts";
import { useFigureStore, type CanvasMode } from "@/store/figureStore";
import type { ActionId } from "@/store/prefsStore";
import { useActivePrefs } from "@/store/useActivePrefs";
import {
  useWorkspaceStore,
  DOCK_ITEM_IDS,
  DOCK_ITEM_TITLES,
  type Layout,
  type Theme,
} from "@/store/workspaceStore";
import { resetLayout, setItemOpen } from "@/components/workspace/dock";
import { CIRCLE_OPTIONS, CONSTRUCTIONS, MODES } from "./tools";
import type { ZoomControls } from "./ZoomBar";

const clearPreview = () => useFigureStore.getState().setActionPreview(null);

function Keys({ action }: { action: ActionId }) {
  return (
    <ContextMenuShortcut>
      <ShortcutKeys action={action} />
    </ContextMenuShortcut>
  );
}

/** An item for a construction action: grayed with the reason when it can't run, previewed on hover. */
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
  return (
    <ContextMenuItem
      disabled={availability.reason !== null}
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
 * Everything the editor can do, on a right click over the preview. A right
 * click on an object first selects it, as in desktop drawing apps.
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
      <ContextMenuContent className="w-64" collisionPadding={8}>
        <MenuBody at={at} zoom={zoom} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function MenuBody({ at, zoom }: { at: Vec | null; zoom: ZoomControls | null }) {
  const doc = useFigureStore((s) => s.doc);
  const hasSelection = useFigureStore((s) => s.selection.length > 0);
  const canUndo = useFigureStore((s) => s.past.length > 0);
  const canRedo = useFigureStore((s) => s.future.length > 0);
  const mode = useFigureStore((s) => s.mode);
  const multiSelect = useFigureStore((s) => s.multiSelect);
  const showGrid = useFigureStore((s) => s.settings.showGrid);
  const quickFigure = useActivePrefs().behavior.quickFigure;
  const av = useAvailability();
  const layout = useWorkspaceStore((s) => s.layout);
  const theme = useWorkspaceStore((s) => s.theme);
  const open = useWorkspaceStore((s) => s.open);
  const desktop = useSidePanelBeside();
  const dark = useDarkTheme();
  const isEmpty = doc.elements.length === 0;
  const store = useFigureStore.getState;
  const ws = useWorkspaceStore.getState;
  const pro = desktop && layout === "pro";
  const modes = MODES.filter((m) => m.mode !== "figure" || quickFigure || mode === "figure");

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
      <ContextMenuItem onSelect={() => emitCommand("focusInput")}>
        <Keyboard />
        Digitar pontos…
        <Keys action="focusInput" />
      </ContextMenuItem>
      <ContextMenuItem onSelect={actions.startGraph}>
        <ChartSpline />
        Gráfico de função…
      </ContextMenuItem>
      <ContextMenuSeparator />

      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={av.connect.reason !== null && av.closeContour.reason !== null}>
          <ConnectIcon />
          Ligar pontos
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-56">
          <ActionItem
            icon={<ConnectIcon />}
            title="Em sequência"
            shortcut="connect"
            availability={av.connect}
            onSelect={() => actions.connect(false)}
          />
          <ActionItem
            icon={<CloseLoopIcon />}
            title="Fechando o contorno"
            shortcut="closeContour"
            availability={av.closeContour}
            onSelect={() => actions.connect(true)}
          />
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ActionItem icon={<AngleIcon />} title="Marcar ângulo" shortcut="angle" availability={av.angle} onSelect={actions.angles} />
      <ActionItem
        icon={<PolygonIcon />}
        title="Polígono e preenchimento"
        shortcut="polygon"
        availability={av.polygon}
        onSelect={actions.polygon}
      />
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={CIRCLE_OPTIONS.every((o) => av[`circle-${o.mode}`].reason !== null)}>
          <CircleThroughIcon />
          Circunferência
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-56">
          {CIRCLE_OPTIONS.map((o) => (
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
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={CONSTRUCTION_KINDS.every((k) => av[`construct-${k}`].reason !== null)}>
          <ConstructionsIcon />
          Construções
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-56">
          {CONSTRUCTION_KINDS.map((kind) => {
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
      <ContextMenuSeparator />

      {hasSelection ? (
        <ContextMenuItem onSelect={() => actions.deleteSelected()}>
          <Trash2 />
          Apagar selecionados
          <Keys action="delete" />
        </ContextMenuItem>
      ) : (
        <ContextMenuItem disabled={isEmpty} onSelect={() => emitCommand("confirmClear")}>
          <Trash2 />
          Limpar figura…
        </ContextMenuItem>
      )}
      <ContextMenuItem inset disabled={isEmpty} onSelect={() => runAction("selectAll")}>
        Selecionar tudo
        <Keys action="selectAll" />
      </ContextMenuItem>
      <ContextMenuItem inset disabled={!hasSelection} onSelect={() => runAction("clearSelection")}>
        Limpar seleção
        <Keys action="clearSelection" />
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger inset>Ao clicar na prévia</ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-60">
          <ContextMenuRadioGroup value={mode} onValueChange={(m) => store().setMode(m as CanvasMode)}>
            {modes.map((m) => (
              <ContextMenuRadioItem key={m.mode} value={m.mode}>
                {m.label}
                <Keys action={m.action} />
              </ContextMenuRadioItem>
            ))}
          </ContextMenuRadioGroup>
          <ContextMenuSeparator />
          <ContextMenuCheckboxItem checked={multiSelect} onCheckedChange={(on) => store().setMultiSelect(on)}>
            Seleção múltipla
            <Keys action="toggleMultiSelect" />
          </ContextMenuCheckboxItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />

      <ContextMenuItem disabled={!canUndo} onSelect={() => store().undo()}>
        <Undo2 />
        Desfazer
        <Keys action="undo" />
      </ContextMenuItem>
      <ContextMenuItem disabled={!canRedo} onSelect={() => store().redo()}>
        <Redo2 />
        Refazer
        <Keys action="redo" />
      </ContextMenuItem>
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
      <ContextMenuSeparator />

      <ContextMenuItem disabled={isEmpty} onSelect={() => emitCommand("export")}>
        <Download />
        Exportar…
        <Keys action="export" />
      </ContextMenuItem>
      {pro && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <LayoutDashboard />
            Janelas
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            {DOCK_ITEM_IDS.map((id) => (
              <ContextMenuCheckboxItem key={id} checked={open.includes(id)} onCheckedChange={(on) => setItemOpen(id, on)}>
                {DOCK_ITEM_TITLES[id]}
              </ContextMenuCheckboxItem>
            ))}
            <ContextMenuSeparator />
            <ContextMenuItem inset onSelect={resetLayout}>
              Restaurar janelas
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <SunMoon />
          Aparência
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-56">
          <ContextMenuLabel>Tema{theme === "system" ? ` (agora ${dark ? "escuro" : "claro"})` : ""}</ContextMenuLabel>
          <ContextMenuRadioGroup value={theme} onValueChange={(t) => ws().setTheme(t as Theme)}>
            {(Object.keys(THEME_NAMES) as Theme[]).map((t) => (
              <ContextMenuRadioItem key={t} value={t}>
                {THEME_NAMES[t]}
              </ContextMenuRadioItem>
            ))}
          </ContextMenuRadioGroup>
          {desktop && (
            <>
              <ContextMenuSeparator />
              <ContextMenuLabel>Layout</ContextMenuLabel>
              <ContextMenuRadioGroup value={layout} onValueChange={(l) => ws().setLayout(l as Layout)}>
                <ContextMenuRadioItem value="classic">Clássico</ContextMenuRadioItem>
                <ContextMenuRadioItem value="pro">Profissional</ContextMenuRadioItem>
              </ContextMenuRadioGroup>
            </>
          )}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem onSelect={() => emitCommand("settings")}>
        <Settings />
        Configurações…
        <Keys action="settings" />
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => emitCommand("help")}>
        <CircleHelp />
        Como usar
        <Keys action="help" />
      </ContextMenuItem>
    </>
  );
}
