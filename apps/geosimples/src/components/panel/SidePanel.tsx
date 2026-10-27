import { useCallback, useState } from "react";
import { CircleHelp, Settings } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { IconButton } from "@/components/IconButton";
import { Logo } from "@/components/icons";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { SettingsDialog } from "@/components/dialogs/SettingsDialog";
import { FigureBar } from "@/components/figures/FigureBar";
import { useCommand } from "@/lib/commands";
import { activeProfileName, usePrefsStore } from "@/store/prefsStore";
import { Customization } from "./Customization";
import { Tools } from "./Tools";

export function SidePanel() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const profileName = usePrefsStore((s) => activeProfileName(s));
  useCommand("help", useCallback(() => setHelpOpen(true), []));
  useCommand("settings", useCallback(() => setSettingsOpen(true), []));

  return (
    <aside aria-label="Painel" className="flex min-h-0 flex-col rounded-lg border bg-card">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Logo className="h-6 w-6 text-primary" />
          GeoSimples
        </h1>
        <div className="flex items-center gap-0.5">
          <IconButton
            label="Configurações"
            hint={`Em uso: ${profileName}. Padrões, comportamento e atalhos.`}
            shortcut="settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings />
          </IconButton>
          <IconButton label="Como usar" shortcut="help" onClick={() => setHelpOpen(true)}>
            <CircleHelp />
          </IconButton>
        </div>
      </header>
      <FigureBar />
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <Accordion type="multiple" defaultValue={["custom"]}>
          <AccordionItem value="custom">
            <AccordionTrigger>Customização</AccordionTrigger>
            <AccordionContent>
              <Customization />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="tools" className="border-b-0">
            <AccordionTrigger>Ferramentas</AccordionTrigger>
            <AccordionContent>
              <Tools />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </aside>
  );
}
