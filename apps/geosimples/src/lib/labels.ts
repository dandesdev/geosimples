import { labelText, type Element, type FigureDoc, type Label, type MeasureKind } from "@geosimples/core/figure";

/** Names of the measures a live label can show. */
export const MEASURE_NAMES: Record<MeasureKind, string> = {
  length: "Comprimento",
  angle: "Ângulo",
  radius: "Raio",
  area: "Área",
  perimeter: "Perímetro",
};

/**
 * A change to one element's label. `shown` is the text the label shows now,
 * so turning a measure back into text keeps the current value.
 */
export type LabelChange = (label: Label, shown: string) => Label;

/**
 * Applies a label change to an element. Each element keeps its own text when
 * several are edited at once. A label with no text and no measure is removed.
 */
export function changeLabel<T extends Element>(
  doc: FigureDoc,
  el: T,
  change: LabelChange,
  base: Omit<Label, "text">,
): T {
  if (el.type === "text") return el;
  const next = change(el.label ?? { ...base, text: "" }, labelText(doc, el));
  if (next.text === "" && !next.measure) {
    const bare = { ...el };
    delete bare.label;
    return bare;
  }
  // The stored text of a measure keeps its latest value for readers that don't compute it.
  const text = next.measure ? labelText(doc, { ...el, label: next } as Element) || next.text : next.text;
  return { ...el, label: { ...next, text } };
}
