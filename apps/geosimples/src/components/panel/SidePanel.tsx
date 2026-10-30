import { CircleHelp, LayoutDashboard, Moon, Settings, Sun } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { IconButton } from "@/components/IconButton";
import { Logo } from "@/components/icons";
import { FigureBar } from "@/components/figures/FigureBar";
import { emitCommand } from "@/lib/commands";
import { nextTheme, useDarkTheme } from "@/lib/theme";
import { useSidePanelBeside } from "@/lib/useMediaQuery";
import { activeProfileName, usePrefsStore } from "@/store/prefsStore";
import { usePanelStore } from "@/store/panelStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Formatting } from "./Formatting";
import { LabelTools } from "./LabelTools";
import { Properties } from "./Properties";
import { SelectionHeader } from "./SelectionHeader";

export function SidePanel() {
  const profileName = usePrefsStore((s) => activeProfileName(s));
  const open = usePanelStore((s) => s.open);
  // Narrower, the panel sits below the fold: editing the selection moves to EditSheet.
  const beside = useSidePanelBeside();
  const setOpen = usePanelStore((s) => s.setOpen);
  const dark = useDarkTheme();
  const ws = useWorkspaceStore.getState;

  return (
    <aside aria-label="Painel" className="flex min-h-0 flex-col rounded-lg border bg-card">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5">
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
      <FigureBar />
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {beside && <SelectionHeader />}
        <Accordion type="multiple" value={open} onValueChange={setOpen}>
          {beside && (
            <AccordionItem value="properties">
              <AccordionTrigger>Propriedades</AccordionTrigger>
              <AccordionContent>
                <Properties />
              </AccordionContent>
            </AccordionItem>
          )}
          {beside && (
            <AccordionItem value="formatting">
              <AccordionTrigger>Formatação</AccordionTrigger>
              <AccordionContent>
                <Formatting />
              </AccordionContent>
            </AccordionItem>
          )}
          <AccordionItem value="labels" className="border-b-0">
            <AccordionTrigger>Rótulos e textos</AccordionTrigger>
            <AccordionContent>
              <LabelTools />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </aside>
  );
}
