import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { IconButton } from "@/components/IconButton";
import { Logo } from "@/components/icons";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { Customization } from "./Customization";
import { Tools } from "./Tools";

export function SidePanel() {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <aside aria-label="Painel" className="flex min-h-0 flex-col rounded-lg border bg-card">
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Logo className="h-6 w-6 text-primary" />
          GeoSimples
        </h1>
        <IconButton label="Como usar" onClick={() => setHelpOpen(true)}>
          <CircleHelp />
        </IconButton>
      </header>
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
    </aside>
  );
}
