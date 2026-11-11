import { FigureBar } from "@/components/figures/FigureBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReadyFigures } from "./ReadyFigures";

/** The open figure and the library (Figura), beside the figures ready to use (Prontos). */
export function FigureTabs() {
  return (
    <Tabs defaultValue="figure" className="shrink-0 border-b">
      <TabsList aria-label="Figuras" className="mx-2 mt-2 grid h-8 grid-cols-2 p-0.5">
        <TabsTrigger value="figure" className="h-7 text-xs">
          Figura
        </TabsTrigger>
        <TabsTrigger value="ready" className="h-7 text-xs">
          Prontos
        </TabsTrigger>
      </TabsList>
      <TabsContent value="figure" className="mt-0">
        <FigureBar bordered={false} />
      </TabsContent>
      <TabsContent value="ready" className="mt-0">
        <ReadyFigures />
      </TabsContent>
    </Tabs>
  );
}
