import { CircleHelp, LayoutDashboard, Moon, PanelTop, Settings, Sun } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { DeleteButton, ExportIconButton, History, type MenuSide } from "@/components/preview/ActionBar";
import { ModeSwitch } from "@/components/preview/ModeSwitch";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { emitCommand } from "@/lib/commands";
import { nextTheme, useDarkTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { activeProfileName, usePrefsStore } from "@/store/prefsStore";
import {
  PANEL_IDS,
  PANEL_TITLES,
  TOOLBAR_IDS,
  TOOLBAR_TITLES,
  useWorkspaceStore,
  type DockItemId,
  type ToolbarId,
} from "@/store/workspaceStore";
import { resetLayout, setItemOpen } from "./dock";

/**
 * The app's own buttons (Janelas, theme, Configurações, help) in a quieter tone than the
 * figure's: on the bar's plain background they would otherwise stand out more than the modes,
 * which sit on a tinted group. They take the full color under the pointer, as the others do.
 */
const QUIET = "text-foreground/50 dark:text-foreground/65 dark:hover:text-primary";

/** Opens and closes the pro layout's panels and toolbars. `side` is where it opens. */
function WindowsMenu({ side }: { side: MenuSide }) {
  const open = useWorkspaceStore((s) => s.open);
  const item = (id: DockItemId, title: string) => (
    <DropdownMenuCheckboxItem
      key={id}
      checked={open.includes(id)}
      onCheckedChange={(on) => setItemOpen(id, on)}
      // Keeps the menu open, to toggle several.
      onSelect={(e) => e.preventDefault()}
    >
      {title}
    </DropdownMenuCheckboxItem>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton className={QUIET} label="Janelas" hint="Mostrar ou esconder painéis e barras, pô-los de volta no lugar, ou voltar ao layout clássico.">
          <LayoutDashboard />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" className="w-56">
        <DropdownMenuLabel>Painéis</DropdownMenuLabel>
        {PANEL_IDS.map((id) => item(id, PANEL_TITLES[id]))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Barras de ferramentas</DropdownMenuLabel>
        {TOOLBAR_IDS.map((id) => item(id, TOOLBAR_TITLES[id]))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={resetLayout}>Restaurar janelas</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => useWorkspaceStore.getState().setLayout("classic")}>
          <PanelTop />
          Voltar ao layout clássico
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Janelas, the theme, Configurações and help: the last of the pro layout's toolbars. */
function AppButtons({ side }: { side: MenuSide }) {
  const dark = useDarkTheme();
  const profileName = usePrefsStore((s) => activeProfileName(s));
  const ws = useWorkspaceStore.getState;
  return (
    <>
        <WindowsMenu side={side} />
        <IconButton
          className={QUIET}
          label={dark ? "Tema claro" : "Tema escuro"}
          hint="A prévia continua branca, como no papel."
          onClick={() => ws().setTheme(nextTheme(dark))}
        >
          {dark ? <Sun /> : <Moon />}
        </IconButton>
        <IconButton
          className={QUIET}
          label="Configurações"
          hint={`Em uso: ${profileName}. Padrões, comportamento, atalhos e aparência.`}
          shortcut="settings"
          onClick={() => emitCommand("settings")}
        >
          <Settings />
        </IconButton>
        <IconButton className={QUIET} label="Como usar" shortcut="help" onClick={() => emitCommand("help")}>
          <CircleHelp />
        </IconButton>
    </>
  );
}

/**
 * One of the pro layout's toolbars. `row` lays it across instead of down;
 * `side` is where its menus open, away from the edge it sits on.
 */
export function Toolbar({ id, row, side }: { id: ToolbarId; row: boolean; side: MenuSide }) {
  return (
    <div
      role="toolbar"
      aria-label={TOOLBAR_TITLES[id]}
      aria-orientation={row ? "horizontal" : "vertical"}
      data-toolbar={id}
      // As long as its buttons, not its place, so they can be measured.
      className={cn("flex items-center gap-0.5 p-1", row ? "w-max flex-row" : "flex-col")}
    >
      {id === "tools-file" && (
        <>
          <ExportIconButton />
          <History />
          <DeleteButton />
        </>
      )}
      {id === "tools-mode" && <ModeSwitch vertical={!row} />}
      {id === "tools-app" && <AppButtons side={side} />}
    </div>
  );
}
