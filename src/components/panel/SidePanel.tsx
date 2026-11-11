import { CircleHelp, LayoutDashboard, Moon, Settings, Sun } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { Logo } from "@/components/icons";
import { AreaTools } from "@/components/tools/AreaTools";
import { cn } from "@/lib/utils";
import { emitCommand } from "@/lib/commands";
import { nextTheme, useDarkTheme } from "@/lib/theme";
import { useSidePanelBeside } from "@/lib/useMediaQuery";
import { activeProfileName, usePrefsStore } from "@/store/prefsStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { EditTabs } from "./EditTabs";
import { FigureTabs } from "./FigureTabs";
import { LabelTools } from "./LabelTools";

/** The title with the theme, Configurações, help and (wide enough) the pro layout. */
export function AppHeader({ className }: { className?: string }) {
  const profileName = usePrefsStore((s) => activeProfileName(s));
  const beside = useSidePanelBeside();
  const dark = useDarkTheme();
  const ws = useWorkspaceStore.getState;
  return (
    <header className={cn("flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5", className)}>
      <h1 className="flex items-center gap-2 text-base font-semibold">
        <Logo className="h-6 w-6 text-primary" />
        GeoSimples
      </h1>
      <div className="flex items-center gap-0.5">
        {beside && (
          <IconButton
            label="Layout profissional"
            hint="A tela inteira para a prévia, com painéis e barras de ferramentas que você arrasta para onde quiser: lado a lado, em abas ou flutuando."
            onClick={() => ws().setLayout("pro")}
          >
            <LayoutDashboard />
          </IconButton>
        )}
        <IconButton
          label={dark ? "Tema claro" : "Tema escuro"}
          hint="A prévia continua branca, como no papel."
          onClick={() => ws().setTheme(nextTheme(dark))}
        >
          {dark ? <Sun /> : <Moon />}
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
      </div>
    </header>
  );
}

/**
 * The classic layout's panel: the figure and Prontos, the tools by kind of
 * figure, and Propriedades, Formatação and Rótulos as tabs. Narrower, the
 * panel sits below the fold and editing the selection moves to EditSheet;
 * on a phone (`phone`) it is the menu's, and the tools are on the main screen.
 */
export function SidePanel({ phone = false }: { phone?: boolean }) {
  const beside = useSidePanelBeside();
  return (
    <aside aria-label="Painel" className="flex min-h-0 flex-col rounded-lg border bg-card">
      <AppHeader />
      <FigureTabs />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pt-3">
        {!phone && (
          <section aria-label="Ferramentas" className="border-b pb-3">
            <AreaTools />
          </section>
        )}
        {beside ? (
          <EditTabs />
        ) : (
          // Room under its buttons, as each tab of EditTabs has.
          <div className="pb-3">
            <LabelTools />
          </div>
        )}
      </div>
    </aside>
  );
}
