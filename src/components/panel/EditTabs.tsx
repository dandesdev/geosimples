import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePanelStore, type EditTab } from "@/store/panelStore";
import { Formatting } from "./Formatting";
import { LabelTools } from "./LabelTools";
import { Properties } from "./Properties";
import { SelectionHeader } from "./SelectionHeader";

const TABS: { id: EditTab; title: string }[] = [
  { id: "properties", title: "Propriedades" },
  { id: "formatting", title: "Formatação" },
  { id: "labels", title: "Rótulos" },
];

/**
 * Propriedades, Formatação and Rótulos as tabs of one panel, under the name
 * of the selection. `labels` false leaves Rótulos out, where it lives elsewhere.
 */
export function EditTabs({ header = true, labels = true }: { header?: boolean; labels?: boolean }) {
  const stored = usePanelStore((s) => s.editTab);
  const setTab = usePanelStore((s) => s.setEditTab);
  const tab = !labels && stored === "labels" ? "properties" : stored;
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as EditTab)}>
      <TabsList className="grid h-8 w-full grid-cols-3 p-0.5" aria-label="Editar">
        {TABS.filter((t) => labels || t.id !== "labels").map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="h-7 text-xs">
            {t.title}
          </TabsTrigger>
        ))}
      </TabsList>
      {header && tab !== "labels" && <SelectionHeader />}
      <TabsContent value="properties" className="pb-3">
        <Properties />
      </TabsContent>
      <TabsContent value="formatting" className="pb-3">
        <Formatting />
      </TabsContent>
      {labels && (
        <TabsContent value="labels" className="pb-3">
          <LabelTools />
        </TabsContent>
      )}
    </Tabs>
  );
}
