import type { LabelScheme, LabelTarget } from "@geosimples/core/figure";
import type { AutoLabelKind } from "@/store/prefsStore";

/** What each kind of Rotular automaticamente labels, and the ways it can name them. */
export const AUTO_LABEL: Record<AutoLabelKind, { label: string; target: LabelTarget; schemes: { value: LabelScheme; label: string }[] }> = {
  point: {
    label: "Pontos",
    target: "point",
    schemes: [
      { value: "latin", label: "A, B, C" },
      { value: "numbered", label: "P1, P2" },
      { value: "coordinates", label: "(x; y)" },
    ],
  },
  segment: {
    label: "Segmentos",
    target: "segment",
    schemes: [
      { value: "latin-lower", label: "a, b, c" },
      { value: "length", label: "Medida" },
    ],
  },
  angle: {
    label: "Ângulos",
    target: "angle",
    schemes: [
      { value: "greek", label: "α, β, γ" },
      { value: "measure", label: "Medida" },
    ],
  },
  radius: { label: "Raios", target: "circle", schemes: [{ value: "radius", label: "Medida" }] },
  area: { label: "Áreas", target: "polygon", schemes: [{ value: "area", label: "Medida" }] },
  perimeter: { label: "Perímetros", target: "polygon", schemes: [{ value: "perimeter", label: "Medida" }] },
};

/** Schemes that write numbers, so the decimals setting applies. */
export const NUMERIC_SCHEMES: LabelScheme[] = ["coordinates", "length", "measure", "radius", "area", "perimeter"];

/** Turns a kind on or off. A polygon has one label, so area and perimeter exclude each other. */
export function toggleKind<T extends Partial<Record<AutoLabelKind, boolean>>>(kinds: T, kind: AutoLabelKind, on: boolean): T {
  const next = { ...kinds, [kind]: on };
  if (on && kind === "area") next.perimeter = false;
  if (on && kind === "perimeter") next.area = false;
  return next;
}
