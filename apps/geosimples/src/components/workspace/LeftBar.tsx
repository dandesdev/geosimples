import { CircleHelp, LayoutDashboard, Moon, PanelTop, Settings, Sun } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { Logo } from "@/components/icons";
import { TooltipSide } from "@/components/tooltipSide";
import { ActionBar } from "@/components/preview/ActionBar";
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
import { activeProfileName, usePrefsStore } from "@/store/prefsStore";
import { useWorkspaceStore, WINDOW_IDS, WINDOW_TITLES } from "@/store/workspaceStore";

/** Opens and closes the pro layout's windows. */
function WindowsMenu() {
  const windows = useWorkspaceStore((s) => s.windows);
  const ws = useWorkspaceStore.getState;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label="Janelas" hint="Mostrar ou esconder janelas, ou pô-las de volta à direita.">
          <LayoutDashboard />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuLabel>Janelas</DropdownMenuLabel>
        {WINDOW_IDS.map((id) => (
          <DropdownMenuCheckboxItem
            key={id}
            checked={!windows[id].closed}
            onCheckedChange={(on) => ws().setClosed(id, !on)}
            // Keeps the menu open, to toggle several.
            onSelect={(e) => e.preventDefault()}
          >
            {WINDOW_TITLES[id]}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => ws().resetWindows()}>Restaurar janelas</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The pro layout's tool column: export, history and the figure tools on top,
 * windows, theme and app settings at the bottom. Tooltips open to the right.
 */
export function LeftBar() {
  const dark = useDarkTheme();
  const profileName = usePrefsStore((s) => activeProfileName(s));
  const ws = useWorkspaceStore.getState;
  return (
    <TooltipSide.Provider value="right">
      <nav
        aria-label="Ferramentas"
        className="flex w-12 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r bg-card py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <Logo aria-label="GeoSimples" className="mb-1.5 h-7 w-7 shrink-0 text-primary" />
        <ActionBar layout="column" />
        <div className="min-h-3 flex-1" aria-hidden="true" />
        <WindowsMenu />
        <IconButton
          label={dark ? "Tema claro" : "Tema escuro"}
          hint="A prévia continua branca, como no papel."
          onClick={() => ws().setTheme(nextTheme(dark))}
        >
          {dark ? <Sun /> : <Moon />}
        </IconButton>
        <IconButton
          label="Layout clássico"
          hint="Volta à página com a barra de ferramentas em cima e o painel à direita."
          onClick={() => ws().setLayout("classic")}
        >
          <PanelTop />
        </IconButton>
        <IconButton
          label="Configurações"
          hint={`Em uso: ${profileName}. Padrões, comportamento, atalhos e aparência.`}
          shortcut="settings"
          onClick={() => emitCommand("settings")}
        >
          <Settings />
        </IconButton>
        <IconButton label="Como usar" shortcut="help" onClick={() => emitCommand("help")}>
          <CircleHelp />
        </IconButton>
      </nav>
    </TooltipSide.Provider>
  );
}
