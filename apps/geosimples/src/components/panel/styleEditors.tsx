import {
  type Dash,
  type Fill,
  type FillPattern,
  type Label,
  type LabelFont,
  type LabelMeasure,
  type MeasureKind,
  type Stroke,
} from "@geosimples/core/figure";
import { MEASURE_NAMES, type LabelChange } from "@/lib/labels";
import { useFigureStore } from "@/store/figureStore";
import { useActivePrefs } from "@/store/useActivePrefs";
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
  defaultFill,
  switchLabel = "Preencher",
}: {
  fill: Fill | null;
  onChange: (f: Fill | null, key: string) => void;
  /** Used when the fill is turned on. Default: the profile's fill. */
  defaultFill?: Fill;
  switchLabel?: string;
}) {
  const profileFill = useActivePrefs().styles.fill;
  const startFill = defaultFill ?? profileFill;
  return (
    <Section title="Preenchimento">
      <SwitchField
        label={switchLabel}
        checked={fill !== null}
        onChange={(on) => onChange(on ? { ...startFill } : null, "fill-on")}
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

const TEXT_INPUT =
  "h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

export function LabelEditor({
  label,
  onChange,
  measures = [],
  placeholder = "Ex.: A, r, 60°",
  multi = false,
}: {
  label: Label | undefined;
  /** Applied to the label of each edited element. */
  onChange: (change: LabelChange, key: string) => void;
  /** Measures the element can show as a live label, the usual one first. */
  measures?: readonly MeasureKind[];
  placeholder?: string;
  /** Several elements are edited at once: no shared text, since one text for all is rarely wanted. */
  multi?: boolean;
}) {
  const base = useActivePrefs().styles.label;
  const decimals = useFigureStore((s) => s.settings.decimals);
  const current: Label = label ?? { ...base, text: "" };
  const measure = current.measure;
  const set = (patch: Partial<Label>, key: string) => onChange((l) => ({ ...l, ...patch }), key);
  const setMeasure = (patch: Partial<LabelMeasure>, key: string) =>
    onChange((l) => (l.measure ? { ...l, measure: { ...l.measure, ...patch } } : l), key);
  const toMeasure = () =>
    onChange(
      (l) => ({
        ...l,
        measure: {
          kind: measures[0],
          // Angles read best with at most one decimal, like the Medida readout.
          decimals: measures[0] === "angle" ? Math.min(decimals, 1) : decimals,
          prefix: "",
          suffix: "",
        },
      }),
      "label-measure",
    );
  // The value shown now becomes plain text, so nothing jumps.
  const toText = () =>
    onChange((l, shown) => {
      const next = { ...l, text: shown };
      delete next.measure;
      return next;
    }, "label-measure");

  return (
    <Section title="Rótulo">
      {measures.length > 0 && (
        <Choice
          label="Conteúdo"
          value={measure ? "measure" : "text"}
          options={[
            { value: "text", label: "Texto" },
            { value: "measure", label: "Medida (atualiza sozinha)" },
          ]}
          onChange={(v) => (v === "measure" ? toMeasure() : toText())}
        />
      )}
      {measure ? (
        <>
          {measures.length > 1 && (
            <Choice<MeasureKind>
              label="Medida"
              value={measure.kind}
              options={measures.map((kind) => ({ value: kind, label: MEASURE_NAMES[kind] }))}
              onChange={(kind) => setMeasure({ kind }, "label-measure-kind")}
            />
          )}
          <RangeField
            label="Casas decimais"
            value={measure.decimals}
            min={0}
            max={4}
            step={1}
            format={(n) => String(n)}
            onChange={(n) => setMeasure({ decimals: n }, "label-decimals")}
          />
          <Field label="Antes">
            <input
              value={measure.prefix}
              maxLength={40}
              placeholder="Ex.: x = "
              aria-label="Texto antes da medida"
              onChange={(e) => setMeasure({ prefix: e.target.value }, "label-prefix")}
              className={TEXT_INPUT}
            />
          </Field>
          <Field label="Depois">
            <input
              value={measure.suffix}
              maxLength={40}
              placeholder="Ex.:  cm"
              aria-label="Texto depois da medida"
              onChange={(e) => setMeasure({ suffix: e.target.value }, "label-suffix")}
              className={TEXT_INPUT}
            />
          </Field>
        </>
      ) : multi ? (
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
              className={TEXT_INPUT}
            />
          </Field>
          {measures.length > 0 && (
            <div className="mb-1 flex flex-wrap justify-end gap-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={toMeasure}>
                Usar medida
              </Button>
            </div>
          )}
        </>
      )}
      {label && (
        <TextStyleFields
          colorLabel="Cor do rótulo"
          value={current}
          onChange={(patch, key) => set(patch, `label-${key}`)}
        />
      )}
      {label && (
        <>
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

/** Font, size and color, shared by labels and free texts. */
export function TextStyleFields({
  value,
  onChange,
  colorLabel = "Cor do texto",
}: {
  value: { font: LabelFont; size: number; color: string };
  colorLabel?: string;
  onChange: (patch: { font?: LabelFont; size?: number; color?: string }, key: string) => void;
}) {
  return (
    <>
      <Choice<LabelFont>
        label="Fonte"
        value={value.font}
        options={[
          { value: "serif", label: "Serifada", title: "Como a fonte padrão do LaTeX" },
          { value: "sans", label: "Sem serifa" },
        ]}
        onChange={(font) => onChange({ font }, "font")}
      />
      <RangeField
        label="Tamanho"
        value={value.size}
        min={6}
        max={24}
        step={0.5}
        format={pt}
        onChange={(size) => onChange({ size }, "size")}
      />
      <Field label="Cor">
        <ColorPicker label={colorLabel} value={value.color} onChange={(color) => onChange({ color }, "color")} />
      </Field>
    </>
  );
}
