import {
  angleArc,
  DEFAULT_STROKE,
  dist,
  formatNumber,
  pointMap,
  signedArea2,
  type Angle,
  type Circle,
  type FigureDoc,
  type Fill,
  type Point,
  type Polygon,
  type Segment,
  type Ticks,
} from "@geosimples/core/figure";
import { Button } from "@/components/ui/button";
import { actions } from "@/lib/actions";
import { useFigureStore } from "@/store/figureStore";
import { Choice, ColorPicker, Field, NumberInput, RangeField, Section, SwitchField } from "./controls";
import { pt } from "@/lib/format";
import { FillEditor, LabelEditor, StrokeEditor } from "./styleEditors";

export type Update<T> = (change: (el: T) => T, key: string) => void;

interface EditorProps<T> {
  el: T;
  update: Update<T>;
  /** True when the edit applies to several selected elements. */
  multi: boolean;
  doc: FigureDoc;
}

const TICK_OPTIONS: { value: string; label: string; title: string }[] = [
  { value: "0", label: "0", title: "Sem marcas" },
  { value: "1", label: "|", title: "Uma marca" },
  { value: "2", label: "||", title: "Duas marcas" },
  { value: "3", label: "|||", title: "Três marcas" },
];

const ANGLE_FILL: Fill = { color: "#808080", opacity: 0.3, pattern: "solid", angle: 45 };

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <span className="font-mono text-sm">{value}</span>
    </Field>
  );
}

export function PointEditor({ el, update, multi }: EditorProps<Point>) {
  return (
    <div className="space-y-2">
      {!multi && (
        <Section title="Posição">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput ariaLabel="Coordenada X" value={el.x} suffix="x" onChange={(x) => update((p) => ({ ...p, x }), "x")} />
            <NumberInput ariaLabel="Coordenada Y" value={el.y} suffix="y" onChange={(y) => update((p) => ({ ...p, y }), "y")} />
          </div>
        </Section>
      )}
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
      <LabelEditor multi={multi} label={el.label} onChange={(label, key) => update((p) => withLabel(p, label), key)} placeholder="Ex.: A, B', P₁" />
    </div>
  );
}

export function SegmentEditor({ el, update, doc, multi }: EditorProps<Segment>) {
  const pts = pointMap(doc);
  const a = pts.get(el.a);
  const b = pts.get(el.b);
  const decimals = useFigureStore((s) => s.settings.decimals);
  const length = a && b ? formatNumber(dist(a, b), decimals) : "";
  return (
    <div className="space-y-2">
      <Readout label="Comprimento" value={length} />
      <StrokeEditor stroke={el.stroke} onChange={(stroke, key) => update((s) => ({ ...s, stroke }), key)} />
      <Section title="Marcas de congruência">
        <Choice
          label="Marcas"
          value={String(el.ticks)}
          options={TICK_OPTIONS}
          onChange={(t) => update((s) => ({ ...s, ticks: Number(t) as Ticks }), "ticks")}
        />
      </Section>
      <LabelEditor multi={multi}
        label={el.label}
        onChange={(label, key) => update((s) => withLabel(s, label), key)}
        suggestions={length ? [{ text: length, title: "Usar medida" }] : []}
        placeholder="Ex.: a, 5, x"
      />
    </div>
  );
}

export function AngleEditor({ el, update, doc, multi }: EditorProps<Angle>) {
  const pts = pointMap(doc);
  const a = pts.get(el.a);
  const v = pts.get(el.vertex);
  const b = pts.get(el.b);
  const arc = a && v && b ? angleArc(a, v, b, el.reflex) : null;
  const measure = arc ? `${formatNumber(arc.measure, 1)}°` : "";
  return (
    <div className="space-y-2">
      <Readout label="Medida" value={measure} />
      <Section title="Marca">
        <Choice
          label="Lado"
          value={el.reflex ? "reflex" : "small"}
          options={[
            { value: "small", label: "Menor" },
            { value: "reflex", label: "Maior", title: "Ângulo replexo (maior que 180°)" },
          ]}
          onChange={(side) => update((x) => ({ ...x, reflex: side === "reflex" }), "reflex")}
        />
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
      <FillEditor fill={el.fill} defaultFill={ANGLE_FILL} onChange={(fill, key) => update((x) => ({ ...x, fill }), key)} />
      <LabelEditor multi={multi}
        label={el.label}
        onChange={(label, key) => update((x) => withLabel(x, label), key)}
        suggestions={measure ? [{ text: measure, title: "Usar medida" }] : []}
        placeholder="Ex.: α, 60°, x"
      />
    </div>
  );
}

export function CircleEditor({ el, update, multi }: EditorProps<Circle>) {
  const built = el.construction.kind !== "free";
  return (
    <div className="space-y-2">
      <Section title="Forma">
        <Field label="Raio">
          <NumberInput
            ariaLabel="Raio"
            value={el.radius}
            min={0.01}
            max={1e5}
            disabled={multi}
            onChange={(radius) => update((c) => ({ ...c, radius, construction: { kind: "free" } }), "radius")}
          />
        </Field>
        {built && (
          <p className="mb-1 text-xs text-muted-foreground">
            Construída a partir de pontos: acompanha quando eles se movem. Mudar o raio desfaz essa ligação.
          </p>
        )}
        <SwitchField
          label="Só um arco"
          checked={el.arc !== null}
          onChange={(on) => update((c) => ({ ...c, arc: on ? { start: 0, end: 180 } : null }), "arc-on")}
        />
        {el.arc && (
          <>
            <Field label="Do ângulo">
              <NumberInput ariaLabel="Ângulo inicial" value={el.arc.start} suffix="°" decimals={1} onChange={(start) => update((c) => ({ ...c, arc: { start, end: c.arc?.end ?? 180 } }), "arc-start")} />
            </Field>
            <Field label="Até o ângulo">
              <NumberInput ariaLabel="Ângulo final" value={el.arc.end} suffix="°" decimals={1} onChange={(end) => update((c) => ({ ...c, arc: { start: c.arc?.start ?? 0, end } }), "arc-end")} />
            </Field>
            <SwitchField label="Raios (setor)" checked={el.radii} onChange={(radii) => update((c) => ({ ...c, radii }), "radii")} />
          </>
        )}
      </Section>
      <StrokeEditor stroke={el.stroke} onChange={(stroke, key) => update((c) => ({ ...c, stroke }), key)} />
      <FillEditor fill={el.fill} onChange={(fill, key) => update((c) => ({ ...c, fill }), key)} />
      <LabelEditor multi={multi} label={el.label} onChange={(label, key) => update((c) => withLabel(c, label), key)} placeholder="Ex.: λ, C₁" />
    </div>
  );
}

export function PolygonEditor({ el, update, doc, multi }: EditorProps<Polygon>) {
  const pts = pointMap(doc);
  const vs = el.vertices.map((id) => pts.get(id)).filter((p): p is Point => !!p);
  const decimals = useFigureStore((s) => s.settings.decimals);
  const area = formatNumber(Math.abs(signedArea2(vs)) / 2, decimals);
  const perimeter = formatNumber(
    vs.reduce((acc, p, i) => acc + dist(p, vs[(i + 1) % vs.length]), 0),
    decimals,
  );
  return (
    <div className="space-y-2">
      <Readout label="Vértices" value={String(vs.length)} />
      <Readout label="Perímetro" value={perimeter} />
      <Readout label="Área" value={area} />
      {!multi && (
        <Button size="sm" variant="outline" className="w-full" onClick={() => actions.angles()}>
          Marcar os ângulos internos
        </Button>
      )}
      <FillEditor fill={el.fill} onChange={(fill, key) => update((g) => ({ ...g, fill }), key)} />
      <Section title="Contorno">
        <SwitchField
          label="Desenhar contorno"
          checked={el.stroke !== null}
          onChange={(on) => update((g) => ({ ...g, stroke: on ? { ...DEFAULT_STROKE } : null }), "stroke-on")}
        />
        <p className="mb-1 text-xs text-muted-foreground">Normalmente os lados já são segmentos. Use isto para um contorno sem segmentos.</p>
      </Section>
      {el.stroke && <StrokeEditor title="Traço do contorno" stroke={el.stroke} onChange={(stroke, key) => update((g) => ({ ...g, stroke }), key)} />}
      <LabelEditor multi={multi} label={el.label} onChange={(label, key) => update((g) => withLabel(g, label), key)} placeholder="Ex.: S, A₁" />
    </div>
  );
}

function withLabel<T extends { label?: unknown }>(el: T, label: T["label"] | undefined): T {
  if (label === undefined) {
    const next = { ...el };
    delete next.label;
    return next;
  }
  return { ...el, label };
}
