import { FigureBar } from "@/components/figures/FigureBar";
import { Formatting } from "@/components/panel/Formatting";
import { LabelTools } from "@/components/panel/LabelTools";
import { Properties } from "@/components/panel/Properties";
import { SelectionHeader } from "@/components/panel/SelectionHeader";
import { useWorkspaceStore } from "@/store/workspaceStore";

export const FigureWindow = FigureBar;

export function PropertiesWindow() {
  return (
    <div className="px-3 pb-3">
      <SelectionHeader />
      <div className="pt-2">
        <Properties />
      </div>
    </div>
  );
}

/** Formatação names the selection itself unless Propriedades shows it right above, in the same dock. */
function useFormattingHeader(): boolean {
  return useWorkspaceStore((s) => {
    const p = s.windows.properties;
    const f = s.windows.formatting;
    const stacked = p.place === f.place && p.place !== "float" && p.order < f.order;
    return p.closed || p.collapsed || !stacked;
  });
}

export function FormattingWindow() {
  const header = useFormattingHeader();
  return (
    <div className="px-3 pb-3">
      {header && <SelectionHeader />}
      <div className="pt-2">
        <Formatting />
      </div>
    </div>
  );
}

export function LabelsWindow() {
  return (
    <div className="px-3 py-3">
      <LabelTools />
    </div>
  );
}
