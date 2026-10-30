import { forwardRef, useEffect, useState, type ReactNode } from "react";
import type {
  DockviewGroupPanel,
  IDockviewHeaderActionsProps,
  IDockviewPanel,
  IDockviewPanelHeaderProps,
} from "dockview-react";
import { ChevronDown, ChevronRight, EllipsisVertical, GripHorizontal, GripVertical, Maximize2, Minimize2, X } from "lucide-react";
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
import { DOCK_ITEM_TITLES, type DockItemId } from "@/store/workspaceStore";
import { canMinimize, isMinimized, isPreviewGroup, isToolbarGroup, onMinimizedChange, setMinimized } from "./dock";
import { panelMenuItems, type PanelMenuItem } from "./panelMenu";

/** Small square buttons for a tab strip. Takes a ref and extra props, so it can open a menu. */
const StripButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  function StripButton({ label, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        // Buttons in a tab or strip must not start dragging it.
        draggable={false}
        onPointerDown={(e) => e.stopPropagation()}
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:h-3.5 [&_svg]:w-3.5"
        {...props}
      >
        {children}
      </button>
    );
  },
);

/**
 * A group's state for its buttons, read again when the dock moves or resizes
 * things. Kept in state, not read while rendering: the group object stays the
 * same, so a memoized render would keep showing the old state.
 */
function useGroupState({ containerApi: api, group }: IDockviewHeaderActionsProps) {
  const read = () => ({
    minimized: isMinimized(group),
    canMinimize: canMinimize(group),
    maximized: group.api.location.type === "grid" && group.api.isMaximized(),
  });
  const [state, setState] = useState(read);
  useEffect(() => {
    let frame = 0;
    // Sizes settle after the event: read them on the next frame.
    const bump = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setState((was) => {
          const now = read();
          return now.minimized === was.minimized && now.canMinimize === was.canMinimize && now.maximized === was.maximized
            ? was
            : now;
        }),
      );
    };
    bump();
    const subs = [
      api.onDidLayoutChange(bump),
      api.onDidMaximizedGroupChange(bump),
      group.api.onDidDimensionsChange(bump),
      group.api.onDidLocationChange(bump),
    ];
    const stop = onMinimizedChange(bump);
    return () => {
      cancelAnimationFrame(frame);
      subs.forEach((s) => s.dispose());
      stop();
    };
    // `read` only reads `group`, which is in the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, group]);
  return state;
}

/**
 * The menu items of a group (or of one of its tabs, `panel`), built when the
 * menu opens so they say what is true then.
 */
function useMenuItems(group: DockviewGroupPanel | undefined, panel?: IDockviewPanel) {
  const [items, setItems] = useState<PanelMenuItem[]>([]);
  const onOpenChange = (open: boolean) => setItems(open && group ? panelMenuItems(group, panel) : []);
  return { items, onOpenChange };
}

/** A tab's right-click menu: everything its group's "more" button has. */
function TabMenu({ props, children }: { props: IDockviewPanelHeaderProps; children: ReactNode }) {
  const panel = props.containerApi.getPanel(props.api.id);
  const { items, onOpenChange } = useMenuItems(panel?.group, panel);
  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {items.map((item) => [
            item.group && <ContextMenuSeparator key={`${item.label}-sep`} />,
            <ContextMenuItem key={item.label} onSelect={item.onSelect}>
              {item.label}
            </ContextMenuItem>,
          ])}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** A panel's tab: its title, and a button to close it. Double-click minimizes the group. */
export function PanelTab(props: IDockviewPanelHeaderProps) {
  const title = DOCK_ITEM_TITLES[props.api.id as DockItemId] ?? props.api.title;
  return (
    <TabMenu props={props}>
      <div
        className="flex h-full items-center gap-1 pl-2.5 pr-1 text-xs font-semibold"
        onDoubleClick={() => {
          const group = props.api.group;
          if (canMinimize(group)) setMinimized(group, !isMinimized(group));
        }}
      >
        <span className="truncate">{title}</span>
        <StripButton label={`Fechar ${title}`} data-close onClick={() => props.api.close()}>
          <X />
        </StripButton>
      </div>
    </TabMenu>
  );
}

/** A toolbar's tab: a grip to drag it by, lying along the toolbar. */
export function GripTab(props: IDockviewPanelHeaderProps) {
  const title = DOCK_ITEM_TITLES[props.api.id as DockItemId] ?? props.api.title;
  const [row, setRow] = useState(() => props.api.group.api.getHeaderPosition() === "left");
  useEffect(() => {
    const sub = props.api.group.api.onDidHeaderDirectionChange((e) => setRow(e.direction === "vertical"));
    return () => sub.dispose();
  }, [props.api.group]);
  return (
    <TabMenu props={props}>
      <div
        data-grip
        aria-label={`Arrastar ${title}`}
        title={`${title}: arraste para mover`}
        className="grid h-full w-full cursor-grab place-items-center text-muted-foreground/70 hover:text-foreground active:cursor-grabbing"
      >
        {row ? <GripVertical className="h-3.5 w-3.5" /> : <GripHorizontal className="h-3.5 w-3.5" />}
      </div>
    </TabMenu>
  );
}

/** The buttons at the end of a panel group's tab strip: minimize, more options, maximize. */
export function GroupActions(props: IDockviewHeaderActionsProps) {
  const { minimized, maximized, canMinimize } = useGroupState(props);
  const { items, onOpenChange } = useMenuItems(props.group);
  const { group } = props;
  if (isPreviewGroup(group) || isToolbarGroup(group)) return null;
  const floating = props.location?.type === "floating";
  return (
    <div className="flex h-full items-center gap-0.5 px-1">
      {canMinimize && (
        <StripButton label={minimized ? "Expandir" : "Minimizar"} onClick={() => setMinimized(group, !minimized)}>
          {minimized ? <ChevronRight /> : <ChevronDown />}
        </StripButton>
      )}
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <StripButton label="Opções da janela">
            <EllipsisVertical />
          </StripButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {items.map((item) => [
            item.group && <DropdownMenuSeparator key={`${item.label}-sep`} />,
            <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
              {item.label}
            </DropdownMenuItem>,
          ])}
        </DropdownMenuContent>
      </DropdownMenu>
      {!floating && (
        <StripButton
          label={maximized ? "Restaurar tamanho" : "Maximizar"}
          onClick={() => (maximized ? group.api.exitMaximized() : group.api.maximize())}
        >
          {maximized ? <Minimize2 /> : <Maximize2 />}
        </StripButton>
      )}
    </div>
  );
}
