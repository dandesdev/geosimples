import { parseInput, type FigureDoc, type Id, type InputContext, type ParsedInput } from "@geosimples/core/figure";
import { lastSelectedPoint } from "@/lib/actions";

/** What the point input needs to know about the figure: named points and the selection. */
export function inputContext(doc: FigureDoc, selection: Id[]): InputContext {
  const points = doc.elements.flatMap((e) =>
    e.type === "point" ? [{ id: e.id, x: e.x, y: e.y, label: e.label?.text }] : [],
  );
  const selected = lastSelectedPoint(doc, selection);
  return { points, selected: selected ? { x: selected.x, y: selected.y } : undefined };
}

export function parseDraft(text: string, doc: FigureDoc, selection: Id[]): ParsedInput {
  return parseInput(text, inputContext(doc, selection));
}
