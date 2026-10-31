import {
  MEASURES,
  sectorRadii,
  type Angle,
  type Axes,
  type Circle,
  type Extension,
  type FreeText,
  type FunctionGraph,
  type Grid,
  type Point,
  type Polygon,
  type Segment,
  type NumberLine,
  type Ticks,
  type VerticalLine,
} from "@geosimples/core/figure";
import { useActivePrefs } from "@/store/useActivePrefs";
import { Choice, ColorPicker, Field, RangeField, Section, SwitchField } from "./controls";
import { pt } from "@/lib/format";
import type { EditorProps } from "./inspected";
import { FillEditor, LabelEditor, StrokeEditor, TextStyleFields } from "./styleEditors";

/*
 * Formatação: how each object looks. What an object is, measures and is
 * built from lives in Propriedades.
 */

const TICK_OPTIONS: { value: string; label: string; title: string }[] = [
  { value: "0", label: "0", title: "Sem marcas" },
  { value: "1", label: "|", title: "Uma marca" },
  { value: "2", label: "||", title: "Duas marcas" },
  { value: "3", label: "|||", title: "Três marcas" },
];

export function PointEditor({ el, update, updateLabel, multi }: EditorProps<Point>) {
  return (
    <div className="space-y-2">
      <Section title="Marca">
        <Choice
          label="Destaque"
          value={el.shape}
          options={[
            { value: "dot", label: "Cheio" },
            { value: "ring", label: "Vazado" },
            { value: "none", label: "Oculto" },
          ]}
          onChange={(shape) => update((p) => ({ ...p, shape }), "shape")}
        />
        <RangeField label="Tamanho" value={el.size} min={0.6} max={5} step={0.1} format={pt} onChange={(size) => update((p) => ({ ...p, size }), "size")} />
        <Field label="Cor">
          <ColorPicker label="Cor do ponto" value={el.color} onChange={(color) => update((p) => ({ ...p, color }), "color")} />
        </Field>
      </Section>
      <LabelEditor multi={multi} label={el.label} onChange={updateLabel} placeholder="Ex.: A, B', P₁" />
    </div>
  );
}

export function SegmentEditor({ el, update, updateLabel, multi }: EditorProps<Segment>) {
  return (
    <div className="space-y-2">
      <StrokeEditor stroke={el.stroke} onChange={(stroke, key) => update((s) => ({ ...s, stroke }), key)} />
      <Section title="Marcas de congruência">
        <Choice
          label="Marcas"
          value={String(el.ticks)}
          options={TICK_OPTIONS}
          onChange={(t) => update((s) => ({ ...s, ticks: Number(t) as Ticks }), "ticks")}
        />
      </Section>
      <LabelEditor multi={multi} label={el.label} onChange={updateLabel} measures={MEASURES.segment} placeholder="Ex.: a, 5, x" />
    </div>
  );
}

export function ExtensionEditor({ el, update }: EditorProps<Extension>) {
  return (
    <div className="space-y-2">
      <StrokeEditor title="Traço do prolongamento" stroke={el.stroke} onChange={(stroke, key) => update((x) => ({ ...x, stroke }), key)} />
      <p className="mb-1 text-xs text-muted-foreground">Ele aparece só enquanto o ponto fica fora do segmento.</p>
    </div>
  );
}

export function AngleEditor({ el, update, updateLabel, multi }: EditorProps<Angle>) {
  const styles = useActivePrefs().styles;
  const angleFill = styles.angle.fill ?? styles.fill;
  return (
    <div className="space-y-2">
      <Section title="Marca">
        <RangeField label="Raio" value={el.radius} min={6} max={40} step={0.5} format={pt} onChange={(radius) => update((x) => ({ ...x, radius }), "radius")} />
        <Choice
          label="Arcos"
          value={String(el.arcs)}
          options={[
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
          ]}
          onChange={(n) => update((x) => ({ ...x, arcs: Number(n) as 1 | 2 | 3 }), "arcs")}
        />
        <Choice
          label="Marcas"
          value={String(el.ticks)}
          options={TICK_OPTIONS}
          onChange={(t) => update((x) => ({ ...x, ticks: Number(t) as Ticks }), "ticks")}
        />
        <SwitchField label="Reto com quadrado" checked={el.rightMark} onChange={(rightMark) => update((x) => ({ ...x, rightMark }), "right")} />
      </Section>
      <StrokeEditor stroke={el.stroke} onChange={(stroke, key) => update((x) => ({ ...x, stroke }), key)} />
      <FillEditor fill={el.fill} defaultFill={angleFill} onChange={(fill, key) => update((x) => ({ ...x, fill }), key)} />
      <LabelEditor multi={multi} label={el.label} onChange={updateLabel} measures={MEASURES.angle} placeholder="Ex.: α, 60°, x" />
    </div>
  );
}

export function CircleEditor({ el, update, updateLabel, multi, doc }: EditorProps<Circle>) {
  const radii = sectorRadii(doc, el).length > 0;
  return (
    <div className="space-y-2">
      <StrokeEditor
        title={el.arc ? "Traço do arco" : "Traço"}
        stroke={el.stroke}
        onChange={(stroke, key) => update((c) => ({ ...c, stroke }), key)}
      />
      {radii && (
        <p className="mb-1 text-xs text-muted-foreground">
          Os raios do setor têm traço próprio: clique em um deles na prévia para mudá-lo.
        </p>
      )}
      <FillEditor fill={el.fill} onChange={(fill, key) => update((c) => ({ ...c, fill }), key)} />
      <LabelEditor multi={multi} label={el.label} onChange={updateLabel} measures={MEASURES.circle} placeholder="Ex.: λ, C₁" />
    </div>
  );
}

export function PolygonEditor({ el, update, updateLabel, multi }: EditorProps<Polygon>) {
  const profileStroke = useActivePrefs().styles.stroke;
  return (
    <div className="space-y-2">
      <FillEditor fill={el.fill} onChange={(fill, key) => update((g) => ({ ...g, fill }), key)} />
      <Section title="Contorno">
        <SwitchField
          label="Desenhar contorno"
          checked={el.stroke !== null}
          onChange={(on) => update((g) => ({ ...g, stroke: on ? { ...profileStroke } : null }), "stroke-on")}
        />
        <p className="mb-1 text-xs text-muted-foreground">Normalmente os lados já são segmentos. Use isto para um contorno sem segmentos.</p>
      </Section>
      {el.stroke && <StrokeEditor title="Traço do contorno" stroke={el.stroke} onChange={(stroke, key) => update((g) => ({ ...g, stroke }), key)} />}
      <LabelEditor multi={multi} label={el.label} onChange={updateLabel} measures={MEASURES.polygon} placeholder="Ex.: S, A₁" />
    </div>
  );
}

export function TextEditor({ el, update }: EditorProps<FreeText>) {
  return (
    <div className="space-y-2">
      <Section title="Estilo">
        <TextStyleFields value={el} onChange={(patch, key) => update((t) => ({ ...t, ...patch }), key)} />
      </Section>
    </div>
  );
}

export function FunctionEditor({ el, update, updateLabel, multi }: EditorProps<FunctionGraph>) {
  return (
    <div className="space-y-2">
      <StrokeEditor title="Traço da curva" stroke={el.stroke} onChange={(stroke, key) => update((f) => ({ ...f, stroke }), key)} />
      <LabelEditor multi={multi} label={el.label} onChange={updateLabel} placeholder="Ex.: f, g, y = x²" />
    </div>
  );
}

export function VerticalLineEditor({ el, update, updateLabel, multi }: EditorProps<VerticalLine>) {
  return (
    <div className="space-y-2">
      <StrokeEditor title="Traço da reta" stroke={el.stroke} onChange={(stroke, key) => update((l) => ({ ...l, stroke }), key)} />
      <LabelEditor multi={multi} label={el.label} onChange={updateLabel} placeholder="Ex.: x = 2" />
    </div>
  );
}

export function NumberLineEditor({ el, update }: EditorProps<NumberLine>) {
  return (
    <div className="space-y-2">
      <StrokeEditor title="Traço da reta" stroke={el.stroke} onChange={(stroke, key) => update((l) => ({ ...l, stroke }), key)} />
      <Section title="Números">
        <RangeField label="Tamanho" value={el.size} min={5} max={16} step={0.5} format={pt} onChange={(size) => update((l) => ({ ...l, size }), "size")} />
      </Section>
    </div>
  );
}

export function GridEditor({ el, update }: EditorProps<Grid>) {
  return <StrokeEditor title="Traço da malha" stroke={el.stroke} onChange={(stroke, key) => update((g) => ({ ...g, stroke }), key)} />;
}

export function AxesEditor({ el, update }: EditorProps<Axes>) {
  return (
    <div className="space-y-2">
      <StrokeEditor title="Traço dos eixos" stroke={el.stroke} onChange={(stroke, key) => update((a) => ({ ...a, stroke }), key)} />
      <Section title="Números e nomes">
        <RangeField label="Tamanho" value={el.size} min={5} max={16} step={0.5} format={pt} onChange={(size) => update((a) => ({ ...a, size }), "size")} />
      </Section>
    </div>
  );
}
