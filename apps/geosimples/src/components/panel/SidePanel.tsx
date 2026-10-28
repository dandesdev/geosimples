import { useCallback, useState } from "react";
import { CircleHelp, Settings } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { IconButton } from "@/components/IconButton";
import { Logo } from "@/components/icons";
import { LazyHelpDialog, LazySettingsDialog } from "@/components/dialogs/lazy";
import { MountOnFirstOpen } from "@/components/dialogs/MountOnFirstOpen";
import { FigureBar } from "@/components/figures/FigureBar";
import { useCommand } from "@/lib/commands";
import { useSidePanelBeside } from "@/lib/useMediaQuery";
import { activeProfileName, usePrefsStore } from "@/store/prefsStore";
import { usePanelStore } from "@/store/panelStore";
import { Formatting } from "./Formatting";
import { LabelTools } from "./LabelTools";
import { Properties } from "./Properties";
import { SelectionHeader } from "./SelectionHeader";

export function SidePanel() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const profileName = usePrefsStore((s) => activeProfileName(s));
  const open = usePanelStore((s) => s.open);
  // Narrower, the panel sits below the fold: editing the selection moves to EditSheet.
  const beside = useSidePanelBeside();
  const setOpen = usePanelStore((s) => s.setOpen);
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
      <MountOnFirstOpen open={helpOpen}>
        <LazyHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      </MountOnFirstOpen>
      <MountOnFirstOpen open={settingsOpen}>
        <LazySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </MountOnFirstOpen>
    </aside>
  );
}
