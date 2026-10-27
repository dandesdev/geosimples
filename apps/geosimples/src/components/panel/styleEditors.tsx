import {
  DEFAULT_FILL,
  DEFAULT_LABEL,
  type Dash,
  type Fill,
  type FillPattern,
  type Label,
  type Stroke,
} from "@geosimples/core/figure";
import { Button } from "@/components/ui/button";
import {
  Choice,
  ColorPicker,
  Field,
  RangeField,
  Section,
  SwitchField,
} from "./controls";
import { pct, pt } from "@/lib/format";

const DASH_OPTIONS: { value: Dash; label: string; title: string }[] = [
  { value: "solid", label: "—", title: "Contínuo" },
  { value: "dashed", label: "- -", title: "Tracejado" },
  { value: "dotted", label: "···", title: "Pontilhado" },
];

export function StrokeEditor({
  stroke,
  onChange,
  title = "Traço",
}: {
  stroke: Stroke;
  onChange: (s: Stroke, key: string) => void;
  title?: string;
}) {
  return (
    <Section title={title}>
      <Choice
        label="Estilo"
        value={stroke.dash}
        options={DASH_OPTIONS}
        onChange={(dash) => onChange({ ...stroke, dash }, "dash")}
      />
      <RangeField
        label="Espessura"
        value={stroke.width}
        min={0.2}
        max={4}
        step={0.1}
        format={pt}
        onChange={(width) => onChange({ ...stroke, width }, "width")}
      />
      <Field label="Cor">
        <ColorPicker
          label="Cor do traço"
          value={stroke.color}
          onChange={(color) => onChange({ ...stroke, color }, "color")}
        />
      </Field>
      <RangeField
        label="Opacidade"
        value={stroke.opacity}
        min={0.1}
        max={1}
        step={0.05}
        format={pct}
        onChange={(opacity) => onChange({ ...stroke, opacity }, "opacity")}
      />
    </Section>
  );
}

const PATTERN_OPTIONS: { value: FillPattern; label: string }[] = [
  { value: "solid", label: "Sólido" },
  { value: "hatch", label: "Hachura" },
  { value: "crosshatch", label: "Cruzada" },
  { value: "dots", label: "Pontos" },
];

const ANGLE_OPTIONS = [
  { value: "0", label: "—", title: "Horizontal" },
  { value: "45", label: "/", title: "45°" },
  { value: "90", label: "|", title: "Vertical" },
  { value: "135", label: "\\", title: "135°" },
];

export function FillEditor({
  fill,
  onChange,
  defaultFill = DEFAULT_FILL,
}: {
  fill: Fill | null;
  onChange: (f: Fill | null, key: string) => void;
  defaultFill?: Fill;
}) {
  return (
    <Section title="Preenchimento">
      <SwitchField
        label="Preencher"
        checked={fill !== null}
        onChange={(on) => onChange(on ? { ...defaultFill } : null, "fill-on")}
      />
      {fill && (
        <>
          <Choice
            label="Padrão"
            value={fill.pattern}
            options={PATTERN_OPTIONS}
            onChange={(pattern) => onChange({ ...fill, pattern }, "pattern")}
          />
          {fill.pattern !== "solid" && (
            <Choice
              label="Direção"
              value={String(
                (((Math.round(fill.angle / 45) * 45) % 180) + 180) % 180,
              )}
              options={ANGLE_OPTIONS}
              onChange={(a) =>
                onChange({ ...fill, angle: Number(a) }, "fill-angle")
              }
            />
          )}
          <Field label="Cor">
            <ColorPicker
              label="Cor do preenchimento"
              value={fill.color}
              onChange={(color) => onChange({ ...fill, color }, "fill-color")}
            />
          </Field>
          <RangeField
            label="Opacidade"
            value={fill.opacity}
            min={0.05}
            max={1}
            step={0.05}
            format={pct}
            onChange={(opacity) =>
              onChange({ ...fill, opacity }, "fill-opacity")
            }
          />
        </>
      )}
    </Section>
  );
}

export function LabelEditor({
  label,
  onChange,
  suggestions = [],
  placeholder = "Ex.: A, r, 60°",
  multi = false,
}: {
  label: Label | undefined;
  onChange: (l: Label | undefined, key: string) => void;
  suggestions?: { text: string; title: string }[];
  placeholder?: string;
  /** Several elements are edited at once: style only, since one text for all is rarely wanted. */
  multi?: boolean;
}) {
  const current = label ?? DEFAULT_LABEL;
  const set = (patch: Partial<Label>, key: string) => {
    const next = { ...current, ...patch };
    onChange(next.text === "" ? undefined : next, key);
  };
  return (
    <Section title="Rótulo">
      {multi ? (
        <p className="mb-1 text-xs text-muted-foreground">
          Para escrever os textos, desligue "Aplicar a todos" ou use Ferramentas
          › Rotular automaticamente.
        </p>
      ) : (
        <>
          <Field label="Texto">
            <input
              value={current.text}
              maxLength={200}
              placeholder={placeholder}
              aria-label="Texto do rótulo"
              onChange={(e) => set({ text: e.target.value }, "label-text")}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </Field>
          {suggestions.length > 0 && (
            <div className="mb-1 flex flex-wrap justify-end gap-1">
              {suggestions.map((s) => (
                <Button
                  key={s.title}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => set({ text: s.text }, "label-text")}
                >
                  {s.title}
                </Button>
              ))}
            </div>
          )}
        </>
      )}
      {label && (
        <>
          <RangeField
            label="Tamanho"
            value={current.size}
            min={6}
            max={24}
            step={0.5}
            format={pt}
            onChange={(size) => set({ size }, "label-size")}
          />
          <Field label="Cor">
            <ColorPicker
              label="Cor do rótulo"
              value={current.color}
              onChange={(color) => set({ color }, "label-color")}
            />
          </Field>
          <SwitchField
            label="Posição automática"
            checked={current.angle === null}
            onChange={(auto) => set({ angle: auto ? null : 90 }, "label-auto")}
          />
          {current.angle !== null && (
            <RangeField
              label="Direção"
              value={current.angle}
              min={0}
              max={355}
              step={5}
              format={(n) => `${n}°`}
              onChange={(angle) => set({ angle }, "label-angle")}
            />
          )}
          <RangeField
            label="Afastamento"
            value={current.distance}
            min={0}
            max={40}
            step={0.5}
            format={pt}
            onChange={(distance) => set({ distance }, "label-distance")}
          />
        </>
      )}
    </Section>
  );
}
