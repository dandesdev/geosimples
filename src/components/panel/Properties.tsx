import { useState, type ReactNode } from "react";
import {
  DEFAULT_GUIDE_STROKE,
  axesStepY,
  deleteElements,
  functionValue,
  boardError,
  gridWindow,
  moveNumberLine,
  parseBoard,
  parseSetExpr,
  setRegionExpr,
  shapeOperationOf,
  type ShapeOperation,
  piText,
  piWindow,
  setAxesWindow,
  updateElements,
  type Axes,
  type Board,
  circuitOf,
  solveCircuit,
  type Circuit,
  type Component,
  type ComponentKind,
  type BoardShow,
  type GapStyle,
  MAX_GAP_TEXT,
  type EndMark,
  type FunctionGraph,
  type Grid,
  type GridFollow,
  type NumberLine,
  type Region,
  type Vector,
  type VennItems,
  type VerticalLine,
} from "@geosimples/core/figure";
import { toast } from "sonner";
import { parseExpr } from "@geosimples/core/plot";
import {
  angleArc,
  dist,
  formatNumber,
  perpendicularBisectorOf,
  pointMap,
  tangentOf,
  type Tangent,
  sectorRadii,
  signedArea2,
  type Angle,
  type Circle,
  type FigureDoc,
  type FreeText,
  type Point,
  type Polygon,
  type Segment,
} from "@geosimples/core/figure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actions } from "@/lib/actions";
import { previewProps, useAvailability } from "@/lib/availability";
import { IconButton } from "@/components/IconButton";
import { SHAPE_TOOLS } from "@/components/tools/areas";
import { describeConstruction } from "@/lib/names";
import { COMPONENT_ITEMS, CURRENT_OPTIONS } from "@/components/preview/circuitItems";
import { useFigureStore } from "@/store/figureStore";
import { Choice, Field, NumberInput, Section, SwitchField } from "./controls";
import { useInspected, type EditorProps } from "./inspected";
import { StudyProperties } from "./StudyProperties";

/**
 * Propriedades: what an object is and measures, and how it was built.
 * Changes here change the geometry; looks are in Formatação.
 */
export function Properties() {
  const inspected = useInspected();
  if (!inspected) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione um objeto na prévia para ver medidas e construção, e ajustar posição, raio ou arco.
      </p>
    );
  }
  const { el, props, selected } = inspected;
  const shapes = selected.filter((e) => e.type === "circle" || (e.type === "polygon" && !e.universe));
  return (
    <div className="space-y-2">
      {shapes.length >= 2 && <ShapeFills count={shapes.length} />}
      {el.type === "point" && <PointProperties el={el} {...props} />}
      {el.type === "segment" && <SegmentProperties el={el} {...props} />}
      {el.type === "angle" && <AngleProperties el={el} {...props} />}
      {el.type === "circle" && <CircleProperties el={el} {...props} />}
      {el.type === "polygon" && <PolygonProperties el={el} {...props} />}
      {el.type === "text" && <TextProperties el={el} {...props} />}
      {/* Keyed, so a half-typed expression stays with its graph when the selection changes. */}
      {el.type === "function" && <FunctionProperties key={el.id} el={el} {...props} />}
      {el.type === "vline" && <VerticalLineProperties el={el} {...props} />}
      {el.type === "numberline" && <NumberLineProperties el={el} {...props} />}
      {el.type === "axes" && <AxesProperties el={el} {...props} />}
      {el.type === "grid" && <GridProperties el={el} {...props} />}
      {el.type === "vector" && <VectorProperties el={el} {...props} />}
      {/* Keyed, so a half-typed text stays with its object when the selection changes. */}
      {el.type === "region" && <RegionProperties key={el.id} el={el} {...props} />}
      {el.type === "vennitems" && <VennItemsProperties el={el} {...props} />}
      {el.type === "board" && <BoardProperties key={el.id} el={el} {...props} />}
      {el.type === "study" && <StudyProperties key={el.id} el={el} />}
      {el.type === "component" && <ComponentProperties el={el} {...props} />}
      {el.type === "circuit" && <CircuitFields circuit={el} doc={props.doc} />}
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <span className="font-mono text-sm">{value}</span>
    </Field>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="mb-1 text-xs text-muted-foreground">{children}</p>;
}

const nameOf = (doc: FigureDoc, id: string) => {
  const el = doc.elements.find((e) => e.id === id);
  return el?.label?.text || id;
};

function PointProperties(props: EditorProps<Point>) {
  const hasAxes = props.doc.elements.some((e) => e.type === "axes");
  return (
    <>
      <PointPlace {...props} />
      {hasAxes && (
        <Section title="Eixos">
          <SwitchField
            label="Linhas até os eixos"
            checked={!!props.el.guides}
            onChange={(on) =>
              props.update((p) => {
                if (on) return p.guides ? p : { ...p, guides: { ...DEFAULT_GUIDE_STROKE, color: p.color } };
                const rest = { ...p };
                delete rest.guides;
                return rest;
              }, "guides")
            }
            help="Tracejadas, do ponto até cada eixo, como para marcar f(a) no gráfico."
          />
        </Section>
      )}
    </>
  );
}

function PointPlace({ el, update, multi, doc }: EditorProps<Point>) {
  const decimals = useFigureStore((s) => s.settings.decimals);
  if (multi) return <Hint>Com vários pontos selecionados, a posição se ajusta um por vez.</Hint>;
  const c = el.construction;
  if (c?.kind === "onGraph") {
    return (
      <Section title="Sobre o gráfico">
        <Hint>{describeConstruction(doc, c)}. Acompanha a função quando ela muda, e desliza por ela no modo Mover.</Hint>
        <Field label="x">
          <NumberInput
            ariaLabel="x do ponto no gráfico"
            value={c.x}
            onChange={(x) => {
              const graph = doc.elements.find((g) => g.id === c.graph);
              // Where f is undefined the point would have nowhere to go.
              if (graph?.type === "function" && functionValue(graph.expr, x) === null) {
                toast.error(`${graph.label?.text || "A função"} não está definida em x = ${formatNumber(x)}.`);
                return;
              }
              update((p) => (p.construction?.kind === "onGraph" ? { ...p, construction: { ...p.construction, x } } : p), "graph-x");
            }}
          />
        </Field>
        <Readout label="y = f(x)" value={formatNumber(el.y, decimals)} />
        <Button size="sm" variant="outline" className="mt-1 w-full" onClick={() => actions.freePoints([el.id])}>
          Soltar ponto
        </Button>
      </Section>
    );
  }
  if (c) {
    return (
      <Section title="Construção">
        <Hint>{describeConstruction(doc, c)}. Acompanha esses objetos quando eles se movem.</Hint>
        <Readout label="Posição" value={`(${formatNumber(el.x, decimals)}; ${formatNumber(el.y, decimals)})`} />
        <Button size="sm" variant="outline" className="mt-1 w-full" onClick={() => actions.freePoints([el.id])}>
          Soltar ponto
        </Button>
      </Section>
    );
  }
  return (
    <Section title="Posição">
      <div className="grid grid-cols-2 gap-2">
        <NumberInput ariaLabel="Coordenada X" value={el.x} suffix="x" onChange={(x) => update((p) => ({ ...p, x }), "x")} />
        <NumberInput ariaLabel="Coordenada Y" value={el.y} suffix="y" onChange={(y) => update((p) => ({ ...p, y }), "y")} />
      </div>
    </Section>
  );
}

function SegmentProperties({ el, doc, multi }: EditorProps<Segment>) {
  const pts = pointMap(doc);
  const a = pts.get(el.a);
  const b = pts.get(el.b);
  const decimals = useFigureStore((s) => s.settings.decimals);
  const bisector = multi ? null : perpendicularBisectorOf(doc, el);
  const tangent = multi ? null : tangentOf(doc, el);
  return (
    <>
      {!bisector && !tangent && (
        <Section title="Medidas">
          <Readout label="Comprimento" value={a && b ? formatNumber(dist(a, b), decimals) : ""} />
        </Section>
      )}
      {bisector && <BisectorFields el={el} bisector={bisector} doc={doc} />}
      {tangent && <TangentFields el={el} tangent={tangent} doc={doc} />}
      {!multi && !bisector && !tangent && <PointOnSegment el={el} doc={doc} />}
    </>
  );
}

/** Its equation, its length and the point it touches, which slides along the graph in Mover. */
function TangentFields({ el, tangent, doc }: { el: Segment; tangent: Tangent; doc: FigureDoc }) {
  const decimals = useFigureStore((s) => s.settings.decimals);
  const p = pointMap(doc).get(tangent.point);
  const n = (v: number) => formatNumber(v, decimals);
  let equation = "";
  if (p && tangent.slope === null) equation = `x = ${n(p.x)}`;
  else if (p && tangent.slope !== null) {
    const m = tangent.slope;
    const q = p.y - m * p.x;
    const slope = n(m) === "0" ? "" : `${n(m) === "1" ? "" : n(m) === "-1" ? "-" : n(m)}x`;
    const shift = n(q) === "0" ? "" : `${slope ? (q < 0 ? " - " : " + ") : q < 0 ? "-" : ""}${n(Math.abs(q))}`;
    equation = `y = ${slope + shift || "0"}`;
  }
  return (
    <Section title="Reta tangente">
      <Hint>
        Tangente a {nameOf(doc, tangent.graph)} em {nameOf(doc, tangent.point)}. No modo Mover, arraste a reta ou o ponto e ela
        acompanha a curva; arraste as pontas para mudar o comprimento.
      </Hint>
      <Readout label="Equação" value={equation} />
      {tangent.slope !== null && <Readout label="Inclinação" value={n(tangent.slope)} />}
      <SwitchField
        label="Preencher a janela"
        checked={tangent.fill}
        onChange={(on) => actions.fillTangent(el.id, on)}
        help="A reta vai de uma borda à outra da janela dos eixos, sem aumentá-la, e acompanha a janela quando ela muda."
      />
      {!tangent.fill && (
        <Field label="Comprimento">
          <NumberInput
            ariaLabel="Comprimento da tangente"
            value={Math.round(tangent.length * 100) / 100}
            min={0.01}
            max={200}
            onChange={(length) => actions.resizeTangent(el.id, length)}
          />
        </Field>
      )}
    </Section>
  );
}

function BisectorFields({
  el,
  bisector,
  doc,
}: {
  el: Segment;
  bisector: NonNullable<ReturnType<typeof perpendicularBisectorOf>>;
  doc: FigureDoc;
}) {
  const name = bisector.points.map((id) => nameOf(doc, id)).join("");
  return (
    <Section title="Mediatriz">
      <Hint>Mediatriz de {name}.</Hint>
      <Field label="Comprimento">
        <NumberInput
          ariaLabel="Comprimento da mediatriz"
          value={bisector.length}
          min={0.01}
          max={200}
          onChange={(length) => actions.resizeBisector(el.id, length, bisector.fixed)}
        />
      </Field>
      <SwitchField
        label={`Acompanhar ${name}`}
        checked={!bisector.fixed}
        onChange={(follow) => actions.resizeBisector(el.id, bisector.length, !follow)}
      />
      <Hint>
        {bisector.fixed
          ? "O comprimento fica fixo quando os pontos se movem."
          : `O comprimento cresce e diminui junto com ${name}.`}
      </Hint>
      <SwitchField label="Marca de ângulo reto" checked={bisector.mark !== null} onChange={(on) => actions.markBisector(el.id, on)} />
    </Section>
  );
}

function PointOnSegment({ el, doc }: { el: Segment; doc: FigureDoc }) {
  const [mode, setMode] = useState<"ratio" | "distance">("ratio");
  const [value, setValue] = useState(0.5);
  const [from, setFrom] = useState<"a" | "b">("a");
  return (
    <Section title="Inserir ponto no segmento">
      <Choice
        label="Posição por"
        value={mode}
        options={[
          { value: "ratio", label: "Fração" },
          { value: "distance", label: "Distância" },
        ]}
        onChange={(m) => {
          setMode(m);
          setValue(m === "ratio" ? 0.5 : 1);
        }}
      />
      <Field label={mode === "ratio" ? "Fração (0 a 1)" : "Distância"}>
        <NumberInput ariaLabel="Valor" value={value} min={0} max={mode === "ratio" ? 1 : 1e6} onChange={setValue} />
      </Field>
      <Choice
        label="A partir de"
        value={from}
        options={[
          { value: "a", label: nameOf(doc, el.a) },
          { value: "b", label: nameOf(doc, el.b) },
        ]}
        onChange={setFrom}
      />
      <Button
        size="sm"
        variant="outline"
        className="mt-1 w-full"
        onClick={() => actions.pointOnSegment(el.id, mode === "ratio" ? { ratio: value } : { distance: value }, from)}
      >
        Inserir ponto
      </Button>
    </Section>
  );
}

function AngleProperties({ el, update, doc }: EditorProps<Angle>) {
  const pts = pointMap(doc);
  const a = pts.get(el.a);
  const v = pts.get(el.vertex);
  const b = pts.get(el.b);
  const arc = a && v && b ? angleArc(a, v, b, el.reflex) : null;
  return (
    <Section title="Medida">
      <Readout label="Medida" value={arc ? `${formatNumber(arc.measure, 1)}°` : ""} />
      <Choice
        label="Lado"
        value={el.reflex ? "reflex" : "small"}
        options={[
          { value: "small", label: "Menor" },
          { value: "reflex", label: "Maior", title: "Ângulo replexo (maior que 180°)" },
        ]}
        onChange={(side) => update((x) => ({ ...x, reflex: side === "reflex" }), "reflex")}
      />
    </Section>
  );
}

function CircleProperties({ el, update, multi, targets, doc }: EditorProps<Circle>) {
  const built = el.construction.kind !== "free";
  const radii = el.radii || sectorRadii(doc, el).length > 0;
  return (
    <>
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
        {built && <Hint>Construída a partir de pontos: acompanha quando eles se movem. Mudar o raio desfaz essa ligação.</Hint>}
      </Section>
      <Section title="Arco e setor">
        <SwitchField label="Só um arco" checked={el.arc !== null} onChange={(on) => actions.circleArc(targets, on)} />
        {el.arc && (
          <>
            <Field label="Do ângulo">
              <NumberInput
                ariaLabel="Ângulo inicial"
                value={el.arc.start}
                suffix="°"
                decimals={1}
                onChange={(start) => update((c) => ({ ...c, arc: { start, end: c.arc?.end ?? 180 } }), "arc-start")}
              />
            </Field>
            <Field label="Até o ângulo">
              <NumberInput
                ariaLabel="Ângulo final"
                value={el.arc.end}
                suffix="°"
                decimals={1}
                onChange={(end) => update((c) => ({ ...c, arc: { start: c.arc?.start ?? 0, end } }), "arc-end")}
              />
            </Field>
            <SwitchField label="Raios (setor)" checked={radii} onChange={(on) => actions.sectorRadii(targets, on)} />
            {radii && <Hint>Os raios são segmentos: clique em um deles na prévia para mudar o traço ou dar um rótulo.</Hint>}
          </>
        )}
      </Section>
    </>
  );
}

function PolygonProperties({ el, doc, multi }: EditorProps<Polygon>) {
  const pts = pointMap(doc);
  const vs = el.vertices.map((id) => pts.get(id)).filter((p): p is Point => !!p);
  const decimals = useFigureStore((s) => s.settings.decimals);
  const area = formatNumber(Math.abs(signedArea2(vs)) / 2, decimals);
  const perimeter = formatNumber(
    vs.reduce((acc, p, i) => acc + dist(p, vs[(i + 1) % vs.length]), 0),
    decimals,
  );
  return (
    <Section title="Medidas">
      <Readout label="Vértices" value={String(vs.length)} />
      <Readout label="Perímetro" value={perimeter} />
      <Readout label="Área" value={area} />
      {!multi && (
        <Button size="sm" variant="outline" className="mt-1 w-full" onClick={() => actions.angles()}>
          Marcar os ângulos internos
        </Button>
      )}
    </Section>
  );
}

function TextProperties({ el, update, multi }: EditorProps<FreeText>) {
  if (multi) return <Hint>Com vários textos selecionados, o conteúdo e a posição se ajustam um por vez.</Hint>;
  return (
    <Section title="Texto">
      <Field label="Texto">
        <Input
          value={el.text}
          maxLength={200}
          aria-label="Texto"
          // An empty text can't be drawn or picked; delete the text to remove it.
          onChange={(e) => e.target.value.trim() !== "" && update((t) => ({ ...t, text: e.target.value }), "text")}
          className="h-8 bg-background px-2 sm:text-sm"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput ariaLabel="Coordenada X" value={el.x} suffix="x" onChange={(x) => update((t) => ({ ...t, x }), "x")} />
        <NumberInput ariaLabel="Coordenada Y" value={el.y} suffix="y" onChange={(y) => update((t) => ({ ...t, y }), "y")} />
      </div>
      <Hint>Para arrastar o texto, use o modo Mover.</Hint>
    </Section>
  );
}


/** A [from, to] pair of number fields; a change that would put "from" past "to" is ignored. */
function IntervalFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: [number, number];
  onChange: (next: [number, number]) => void;
}) {
  const set = (next: [number, number]) => next[0] < next[1] && onChange(next);
  return (
    <Field label={label}>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput ariaLabel={`${label}: de`} value={value[0]} suffix="a" onChange={(a) => set([a, value[1]])} />
        <NumberInput ariaLabel={`${label}: até`} value={value[1]} onChange={(b) => set([value[0], b])} />
      </div>
    </Field>
  );
}

function FunctionProperties({ el, update, multi, doc }: EditorProps<FunctionGraph>) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? el.expr;
  const parsed = parseExpr(text);
  const axes = doc.elements.find((e): e is Axes => e.type === "axes");
  const commit = () => {
    if (draft === null || !parsed.ok) return;
    update((f) => ({ ...f, expr: text.trim() }), "expr");
    setDraft(null);
  };
  if (multi) return <Hint>Com vários gráficos selecionados, a expressão se ajusta um por vez.</Hint>;
  return (
    <>
      <Section title="Função">
        <Field label="y =">
          <Input
            value={text}
            aria-label="Expressão da função"
            aria-invalid={!parsed.ok}
            spellCheck={false}
            className="font-mono"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setDraft(null);
            }}
          />
        </Field>
        {!parsed.ok && <p className="mb-1 text-xs text-destructive">{parsed.error}</p>}
        <Hint>Ex.: x^2 - 1, 2x + 3, sen(x), raiz(x), |x|, 1/x. Vírgula ou ponto nos decimais.</Hint>
      </Section>
      <Section title="Onde desenhar">
        <IntervalFields label="x de" value={el.domain} onChange={(domain) => update((f) => ({ ...f, domain }), "domain")} />
        <IntervalFields label="Cortar y de" value={el.range} onChange={(range) => update((f) => ({ ...f, range }), "range")} />
        {axes && (
          <Button
            size="sm"
            variant="outline"
            className="mt-1 w-full"
            onClick={() => update((f) => ({ ...f, domain: [...axes.x], range: [...axes.y] }), "fit-axes")}
          >
            Usar a janela dos eixos
          </Button>
        )}
      </Section>
      <Section title="Extremos">
        <EndChoice label="No início" value={el.ends?.[0] ?? "none"} onChange={(m) => update((f) => ({ ...f, ends: [m, f.ends?.[1] ?? "none"] }), "end-0")} />
        <EndChoice label="No fim" value={el.ends?.[1] ?? "none"} onChange={(m) => update((f) => ({ ...f, ends: [f.ends?.[0] ?? "none", m] }), "end-1")} />
        <Hint>Bolinha fechada: o extremo pertence ao gráfico. Aberta: não pertence.</Hint>
      </Section>
    </>
  );
}

function VerticalLineProperties({ el, update, multi }: EditorProps<VerticalLine>) {
  if (multi) return <Hint>Com várias retas selecionadas, a posição se ajusta uma por vez.</Hint>;
  return (
    <Section title="Reta vertical">
      <Field label="x =">
        <NumberInput ariaLabel="Posição da reta vertical" value={el.x} onChange={(x) => update((l) => ({ ...l, x }), "x")} />
      </Field>
      <IntervalFields label="y de" value={el.range} onChange={(range) => update((l) => ({ ...l, range }), "range")} />
      <Hint>Tracejada, marca uma assíntota. O traço muda em Formatação.</Hint>
    </Section>
  );
}

function NumberLineProperties({ el, update, multi }: EditorProps<NumberLine>) {
  if (multi) return <Hint>Com várias retas numéricas selecionadas, a janela se ajusta uma por vez.</Hint>;
  const moveTo = (y: number) => {
    const store = useFigureStore.getState();
    store.commit(moveNumberLine(store.doc, el.id, y), `${el.id}:y`);
  };
  return (
    <Section title="Reta numérica">
      <IntervalFields label="x de" value={el.x} onChange={(x) => update((l) => ({ ...l, x }), "x")} />
      <Field label="Altura (y)">
        <NumberInput ariaLabel="Altura da reta numérica" value={el.y} onChange={moveTo} />
      </Field>
      <Field label="De quanto em quanto">
        <NumberInput ariaLabel="Distância entre marcas" value={el.step} min={0.01} onChange={(step) => update((l) => ({ ...l, step }), "step")} />
      </Field>
      <SwitchField label="Números" checked={el.numbers} onChange={(numbers) => update((l) => ({ ...l, numbers }), "numbers")} />
      <Hint>Intervalos: digite [-2; 3[ ou ]-∞; 1] na barra de entrada. Mudar a altura leva os intervalos junto.</Hint>
    </Section>
  );
}

function VectorProperties({ el, doc, multi }: EditorProps<Vector>) {
  const pts = pointMap(doc);
  const a = pts.get(el.a);
  const b = pts.get(el.b);
  const decimals = useFigureStore((s) => s.settings.decimals);
  const tip = b?.construction;
  const n = (v: number) => formatNumber(v, decimals);
  // A multiple's factor lives on the construction of its tip.
  const isMultiple = !multi && tip?.kind === "translate" && tip.point === el.a;
  const setFactor = (factor: number) => {
    const store = useFigureStore.getState();
    store.commit(
      updateElements(store.doc, [el.b], (p) => (p.type === "point" && p.construction?.kind === "translate" ? { ...p, construction: { ...p.construction, factor } } : p)),
      `${el.id}:factor`,
    );
  };
  return (
    <Section title="Medidas">
      {a && b && (
        <>
          <Readout label="Módulo" value={n(dist(a, b))} />
          <Readout label="Componentes" value={`(${n(b.x - a.x)}; ${n(b.y - a.y)})`} />
          <Readout label="Direção" value={`${formatNumber(((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 360) % 360, 1)}°`} />
        </>
      )}
      {isMultiple && (
        <Field label="Fator k">
          <NumberInput ariaLabel="Fator do múltiplo" value={tip.factor} min={-100} max={100} onChange={setFactor} />
        </Field>
      )}
      <Hint>Soma, diferença, projeção, versor e componentes ficam no menu Vetores, e acompanham o vetor quando ele se move.</Hint>
    </Section>
  );
}

/** What each kind's value is, and in what unit. */
const VALUE_FIELD: Partial<Record<ComponentKind, { label: string; unit: string }>> = {
  resistor: { label: "Resistência", unit: "Ω" },
  lamp: { label: "Resistência", unit: "Ω" },
  source: { label: "Força eletromotriz", unit: "V" },
  capacitor: { label: "Capacitância", unit: "μF" },
};

function ComponentProperties({ el, doc, multi }: EditorProps<Component>) {
  const field = VALUE_FIELD[el.kind];
  const circuit = circuitOf(doc);
  return (
    <>
      {!multi && (
        <Section title="Componente">
          <Field label="Tipo">
            <Select value={el.kind} onValueChange={(kind) => actions.updateComponent(el.id, { kind: kind as ComponentKind }, "kind")}>
              <SelectTrigger aria-label="Tipo do componente" className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPONENT_ITEMS.map((item) => (
                  <SelectItem key={item.kind} value={item.kind}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nome">
            <Input
              value={el.name}
              aria-label="Nome do componente"
              maxLength={12}
              onChange={(e) => actions.updateComponent(el.id, { name: e.target.value }, "name")}
            />
          </Field>
          {field && (
            <Field label={field.label}>
              <NumberInput
                ariaLabel={field.label}
                value={el.value}
                min={0}
                max={1e9}
                decimals={3}
                suffix={field.unit}
                onChange={(value) => actions.updateComponent(el.id, { value }, "value")}
              />
            </Field>
          )}
          {el.kind === "source" && (
            <>
              <Field label="Resistência interna">
                <NumberInput
                  ariaLabel="Resistência interna"
                  value={el.internal}
                  min={0}
                  max={1e9}
                  decimals={3}
                  suffix="Ω"
                  onChange={(internal) => actions.updateComponent(el.id, { internal }, "internal")}
                />
              </Field>
              <Button size="sm" variant="outline" className="mt-1 w-full" onClick={() => actions.flipComponent(el.id)}>
                Inverter os polos
              </Button>
              <Hint>Ligado ao contrário de geradores mais fortes, ele passa a ser receptor.</Hint>
            </>
          )}
          {el.kind === "switch" && (
            <SwitchField label="Fechada" checked={el.closed} onChange={(closed) => actions.updateComponent(el.id, { closed }, "closed")} />
          )}
          {el.kind === "lamp" && <Hint>A lâmpada é tratada como um resistor. Para a nominal, R = U² / P.</Hint>}
        </Section>
      )}
      {!multi && circuit && <PieceReadout el={el} doc={doc} decimals={circuit.decimals} />}
      {circuit && <CircuitFields circuit={circuit} doc={doc} />}
    </>
  );
}

/** The current, voltage and power of one piece, as the switched-on circuit has them. */
function PieceReadout({ el, doc, decimals }: { el: Component; doc: FigureDoc; decimals: number }) {
  const solution = solveCircuit(doc);
  if (!solution.ok) {
    return (
      <Section title="Medidas">
        <p className="mb-1 text-xs text-destructive">{solution.error}</p>
      </Section>
    );
  }
  const state = solution.pieces.get(el.id);
  if (!state) return null;
  const n = (v: number) => formatNumber(v, decimals);
  const i = Math.abs(state.current);
  const u = state.voltage === null ? null : Math.abs(state.voltage);
  const role = el.kind === "source" ? (state.current < -1e-9 ? "Receptor" : i > 1e-9 ? "Gerador" : "Sem corrente") : null;
  return (
    <Section title="Medidas">
      <Readout label="Corrente" value={`${n(i)} A`} />
      <Readout label="Tensão" value={u === null ? "—" : `${n(u)} V`} />
      {(el.kind === "resistor" || el.kind === "lamp" || el.kind === "source") && u !== null && <Readout label="Potência" value={`${n(u * i)} W`} />}
      {el.kind === "capacitor" && u !== null && <Readout label="Carga" value={`${n(el.value * u)} μC`} />}
      {role && <Readout label="Funciona como" value={role} />}
    </Section>
  );
}

/** Switching the circuit on, its current arrows and what it writes: for the whole figure. */
function CircuitFields({ circuit, doc }: { circuit: Circuit; doc: FigureDoc }) {
  const solution = solveCircuit(doc);
  return (
    <Section title="Circuito">
      <SwitchField label="Ligado" checked={circuit.on} onChange={(on) => actions.circuit({ on })} />
      <Choice label="Sentido da corrente" value={circuit.current} options={CURRENT_OPTIONS} onChange={(current) => actions.circuit({ current })} />
      {circuit.on && (
        <>
          <SwitchField label="Corrente" checked={circuit.values.current} onChange={(current) => actions.circuit({ values: { ...circuit.values, current } })} />
          <SwitchField label="Tensão" checked={circuit.values.voltage} onChange={(voltage) => actions.circuit({ values: { ...circuit.values, voltage } })} />
          <SwitchField label="Potência" checked={circuit.values.power} onChange={(power) => actions.circuit({ values: { ...circuit.values, power } })} />
          <Field label="Casas decimais">
            <NumberInput ariaLabel="Casas decimais dos valores" value={circuit.decimals} min={0} max={4} decimals={0} onChange={(d) => actions.circuit({ decimals: Math.round(d) })} />
          </Field>
        </>
      )}
      {!solution.ok && <p className="mb-1 text-xs text-destructive">{solution.error}</p>}
      <Hint>Fios são segmentos: os componentes se ligam onde dividem um ponto. Medidores e geradores são ideais, a não ser pela resistência interna.</Hint>
    </Section>
  );
}

/** Pathfinder: fills what two or more selected shapes make together. */
function ShapeFills({ count }: { count: number }) {
  const av = useAvailability();
  return (
    <Section title="Preencher entre as formas">
      <div className="grid grid-cols-4 gap-1.5">
        {SHAPE_TOOLS.map((t) => (
          <IconButton
            key={t.op}
            label={t.title}
            text={t.short}
            hint={t.hint}
            hoverTip
            unavailable={av[`shape-${t.op}`].reason}
            onClick={() => actions.shapeOperation(t.op)}
            {...previewProps(av[`shape-${t.op}`])}
          >
            <t.Icon />
          </IconButton>
        ))}
      </div>
      <Hint>
        {count === 2 ? "As duas formas" : `As ${count} formas`} continuam como estão; o preenchimento acompanha quando elas se movem. Para a
        diferença, a primeira selecionada é a de onde se tira.
      </Hint>
    </Section>
  );
}

const SHAPE_OP_OPTIONS: { value: ShapeOperation; label: string }[] = [
  { value: "union", label: "União" },
  { value: "inter", label: "Interseção" },
  { value: "diff", label: "Diferença" },
  { value: "xor", label: "Exclusão" },
];

function RegionProperties(props: EditorProps<Region>) {
  const op = shapeOperationOf(props.el);
  if (op) return <ShapeRegionProperties el={props.el} op={op} multi={props.multi} />;
  return <SetRegionProperties {...props} />;
}

/** A fill between shapes: which operation, kept on the same shapes. */
function ShapeRegionProperties({ el, op, multi }: { el: Region; op: ShapeOperation; multi: boolean }) {
  if (multi) return <Hint>Com vários preenchimentos selecionados, a operação muda um por vez.</Hint>;
  const options = SHAPE_OP_OPTIONS.filter((o) => o.value !== "xor" || el.sets.length === 2);
  return (
    <Section title="Preenchimento entre formas">
      <Choice label="Operação" value={op} options={options} onChange={(next) => actions.setShapeOperation(el.id, next)} />
      <Hint>Acompanha as formas quando elas se movem. A cor e a textura ficam em Formatação.</Hint>
    </Section>
  );
}

function SetRegionProperties({ el, multi }: EditorProps<Region>) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? el.expr;
  const parsed = parseSetExpr(text);
  const commit = () => {
    if (draft === null || !parsed.ok) return;
    const store = useFigureStore.getState();
    const result = setRegionExpr(store.doc, el.id, text);
    if (result.error) toast.error(result.error);
    else store.commit(result.doc, `${el.id}:expr`);
    setDraft(null);
  };
  if (multi) return <Hint>Com várias regiões selecionadas, a expressão se ajusta uma por vez.</Hint>;
  return (
    <Section title="Região">
      <Field label="Expressão">
        <Input
          value={text}
          aria-label="Expressão da região"
          aria-invalid={!parsed.ok}
          spellCheck={false}
          className="font-mono"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setDraft(null);
          }}
        />
      </Field>
      {!parsed.ok && <p className="mb-1 text-xs text-destructive">{parsed.error}</p>}
      <Hint>U para união, n para interseção, - para diferença e ' para complementar. A região acompanha os conjuntos quando eles se movem.</Hint>
    </Section>
  );
}

function VennItemsProperties({ el, doc }: EditorProps<VennItems>) {
  const name = (id: string) => nameOf(doc, id);
  return (
    <Section title="Conteúdo do diagrama">
      {el.members.map((m) => (
        <Readout key={m.set} label={name(m.set)} value={`{${m.items.join(", ")}}`} />
      ))}
      {el.counts.map((c) => (
        <Readout key={c.in.join()} label={`n(${c.in.map(name).join("∩") || "fora"})`} value={c.text} />
      ))}
      <Hint>Cada elemento vai para a região dos conjuntos em que aparece. Para mudar, digite de novo na barra: A={"{1,2,3}"} ou n(A∩B)=3.</Hint>
    </Section>
  );
}

const BOARD_SHOW: { value: BoardShow; label: string; title: string }[] = [
  { value: "full", label: "Resolvido", title: "Com todos os passos, para o gabarito" },
  { value: "blank", label: "Em branco", title: "Só o enunciado armado, para o aluno resolver" },
  { value: "gaps", label: "Lacunas", title: "Algumas partes ficam para completar" },
];

const GAP_STYLES: { value: GapStyle; label: string; title: string }[] = [
  { value: "box", label: "Quadradinho", title: "Um quadradinho vazio no lugar do número" },
  { value: "blank", label: "Em branco", title: "Só o espaço, sem nada" },
  { value: "text", label: "Texto", title: "Um texto no lugar do número, como ?" },
];

function BoardProperties({ el, update, multi }: EditorProps<Board>) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? el.source;
  const error = boardError(text);
  const spec = parseBoard(el.source);
  const kind = spec && typeof spec !== "string" ? spec.kind : null;
  const commit = () => {
    if (draft === null || error !== null) return;
    update((b) => ({ ...b, source: text.trim() }), "source");
    setDraft(null);
  };
  return (
    <>
      {!multi && (
        <Section title="Conteúdo">
          <Field label="Texto">
            <Input
              value={text}
              aria-label="Texto da conta ou do quadro"
              aria-invalid={error !== null}
              spellCheck={false}
              className="font-mono"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setDraft(null);
              }}
            />
          </Field>
          {error !== null && <p className="mb-1 text-xs text-destructive">{error}</p>}
        </Section>
      )}
      <Section title="Para a prova">
        <Choice label="Mostrar" value={el.show} options={BOARD_SHOW} onChange={(show) => update((b) => ({ ...b, show }), "show")} />
        {el.show === "gaps" && (
          <>
            {!multi && <Hint>Clique na prévia em qualquer algarismo ou sinal, do enunciado também, para torná-lo lacuna. Sortear escolhe só entre os resultados.</Hint>}
            <div className="mt-1 grid grid-cols-3 gap-1">
              <Button size="sm" variant="outline" title="Outras lacunas, escolhidas ao acaso" onClick={() => update((b) => ({ ...b, seed: b.seed + 1, gaps: null }), "seed")}>
                Sortear
              </Button>
              {!multi && (
                <>
                  <Button size="sm" variant="outline" onClick={() => actions.allGaps(el.id, true)}>
                    Todas
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => actions.allGaps(el.id, false)}>
                    Nenhuma
                  </Button>
                </>
              )}
            </div>
            <Choice label="Na lacuna" value={el.gapStyle} options={GAP_STYLES} onChange={(gapStyle) => update((b) => ({ ...b, gapStyle }), "gapStyle")} />
            {el.gapStyle === "text" && (
              <Field label="Texto">
                <Input
                  value={el.gapText}
                  maxLength={MAX_GAP_TEXT}
                  aria-label="Texto da lacuna"
                  onChange={(e) => update((b) => ({ ...b, gapText: e.target.value }), "gapText")}
                />
              </Field>
            )}
          </>
        )}
      </Section>
      {kind === "div" && (
        <Section title="Divisão">
          <Choice
            label="Processo"
            value={el.method}
            options={[
              { value: "long", label: "Longo", title: "Escreve cada subtração" },
              { value: "short", label: "Breve", title: "Escreve só os restos" },
            ]}
            onChange={(method) => update((b) => ({ ...b, method }), "method")}
          />
          <Field label="Casas decimais">
            <NumberInput ariaLabel="Casas decimais do quociente" value={el.places} min={0} max={6} decimals={0} onChange={(places) => update((b) => ({ ...b, places: Math.round(places) }), "places")} />
          </Field>
        </Section>
      )}
      {(kind === "add" || kind === "sub" || kind === "mul") && (
        <Section title="Conta">
          <SwitchField label="Vai um e empréstimos" checked={el.marks} onChange={(marks) => update((b) => ({ ...b, marks }), "marks")} />
          <Choice
            label="Sinal da conta"
            value={el.signSide}
            options={[
              { value: "left", label: "À esquerda", title: "O +, o − ou o × antes dos números" },
              { value: "right", label: "À direita", title: "O +, o − ou o × depois dos números" },
            ]}
            onChange={(signSide) => update((b) => ({ ...b, signSide }), "signSide")}
          />
        </Section>
      )}
      {(kind === "varal" || kind === "sign" || kind === "table" || kind === "modulus") && (
        <Section title="Reta">
          <Choice
            label="Intervalos"
            value={el.intervals}
            options={[
              { value: "thick", label: "Linha grossa", title: "Os intervalos como uma linha grossa" },
              { value: "wave", label: "Ondinhas", title: "Os intervalos como uma linha ondulada" },
            ]}
            onChange={(intervals) => update((b) => ({ ...b, intervals }), "intervals")}
          />
          {kind !== "varal" && <Hint>Com uma inequação, como x²-4 ≥ 0, o conjunto solução aparece na reta.</Hint>}
        </Section>
      )}
      {!multi && (
        <Section title="Posição">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput ariaLabel="Coordenada X" value={el.x} suffix="x" onChange={(x) => update((b) => ({ ...b, x }), "x")} />
            <NumberInput ariaLabel="Coordenada Y" value={el.y} suffix="y" onChange={(y) => update((b) => ({ ...b, y }), "y")} />
          </div>
          <Hint>Para arrastar, use o modo Mover.</Hint>
        </Section>
      )}
    </>
  );
}

const END_OPTIONS: { value: EndMark; label: string; title: string }[] = [
  { value: "none", label: "—", title: "Sem bolinha" },
  { value: "closed", label: "●", title: "Bolinha fechada" },
  { value: "open", label: "○", title: "Bolinha aberta" },
];

function EndChoice({ label, value, onChange }: { label: string; value: EndMark; onChange: (m: EndMark) => void }) {
  return <Choice label={label} value={value} options={END_OPTIONS} onChange={onChange} />;
}

/** π steps a trigonometry figure uses, as fractions of π. */
const PI_STEPS = [
  { value: "0.25", label: "π/4" },
  { value: "0.5", label: "π/2" },
  { value: "1", label: "π" },
];

function AxesProperties({ el, update, multi, doc }: EditorProps<Axes>) {
  /** A window or step set by hand stops the axes fitting the figure. */
  const byHand = (d: FigureDoc) => updateElements(d, [el.id], (a) => (a.type === "axes" ? { ...a, fit: false } : a));
  const setWindow = (x: [number, number], y: [number, number]) => {
    const store = useFigureStore.getState();
    const r = setAxesWindow(store.doc, el.id, x, y);
    if (!r.error) store.commit(byHand(r.doc), `${el.id}:window`);
  };
  /** Ticks every `x` and `y`: one step when they match, and `yStep` when y counts on its own. */
  const setSteps = (x: number, y: number, key: string) =>
    update((a) => {
      const next: Axes = { ...a, step: x, fit: false };
      if (y === x) delete next.yStep;
      else next.yStep = y;
      return next;
    }, key);
  /** Counts x in π (every xPi·π) or in plain numbers, and puts the window's ends on ticks. */
  const setPi = (xPi: number | null) => {
    const store = useFigureStore.getState();
    const counted = updateElements(store.doc, [el.id], (a) => {
      if (a.type !== "axes") return a;
      if (xPi !== null) return { ...a, xPi };
      const rest = { ...a };
      delete rest.xPi;
      return rest;
    });
    const x: [number, number] = xPi !== null ? piWindow(el.x, xPi) : [Math.floor(el.x[0]), Math.ceil(el.x[1])];
    const r = setAxesWindow(counted, el.id, x, el.y);
    if (!r.error) store.commit(r.doc, `${el.id}:pi`);
  };
  const grids = doc.elements.filter((e): e is Grid => e.type === "grid");
  const gridOn = grids.some((g) => g.follow === "axes");
  const setGrid = (on: boolean) => {
    const store = useFigureStore.getState();
    if (!on) {
      store.commit(deleteElements(store.doc, grids.filter((g) => g.follow === "axes").map((g) => g.id)).doc);
      return;
    }
    // A grid already in the figure moves onto the axes instead of a second one coming in.
    if (grids.length > 0) store.commit(updateElements(store.doc, [grids[0].id], (g) => (g.type === "grid" ? { ...g, follow: "axes" } : g)));
    else actions.addGrid();
  };
  const unit = el.unit ?? [1, 1];
  /** cm per unit on each axis; 1 and 1 is the plain figure. */
  const setUnit = (next: [number, number]) =>
    update((a) => {
      // A scale set by hand is the teacher's: the fit stops picking y.
      // Even 1 and 1 stays written: a fitting window would otherwise pick its own y again.
      const rest = { ...a, unit: next };
      delete rest.fitUnit;
      return rest;
    }, "unit");
  const distorted = doc.elements.some((e) => e.type === "circle" || e.type === "angle" || e.type === "polygon");
  if (multi) return <Hint>Com vários eixos selecionados, a janela se ajusta um por vez.</Hint>;
  const stepY = axesStepY(el);
  return (
    <>
      <Section title="Janela">
        <SwitchField
          label="Ajustar à figura"
          checked={!!el.fit}
          onChange={(fit) => update((a) => ({ ...a, fit }), "fit")}
          help="Os eixos cobrem a figura toda numa janela 4:3 ou quadrada, com o gráfico centrado na sua simetria, e as marcas se espaçam para os números não se amontoarem. Mudar a janela ou as marcas à mão desliga o ajuste."
        />
        <IntervalFields label="x de" value={el.x} onChange={(x) => setWindow(x, el.y)} />
        <IntervalFields label="y de" value={el.y} onChange={(y) => setWindow(el.x, y)} />
        <Hint>Os gráficos desenhados na janela dos eixos acompanham a mudança.</Hint>
      </Section>
      <Section title="Marcas">
        <Choice
          label="Eixo x"
          value={el.xPi ? "pi" : "number"}
          options={[
            { value: "number", label: "1, 2, 3", title: "Números" },
            { value: "pi", label: "π/2, π", title: "Múltiplos de π" },
          ]}
          onChange={(v) => setPi(v === "pi" ? 0.5 : null)}
          help="Em múltiplos de π, para gráficos de seno, cosseno e tangente. As pontas da janela vão para as marcas mais próximas."
        />
        {el.xPi ? (
          <>
            <Choice
              label="Marcas em x a cada"
              value={String(el.xPi)}
              options={
                PI_STEPS.some((s) => s.value === String(el.xPi))
                  ? PI_STEPS
                  : [...PI_STEPS, { value: String(el.xPi), label: piText(el.xPi * Math.PI) ?? `${el.xPi}π` }]
              }
              onChange={(v) => setPi(Number(v))}
            />
            <Field label="Marcas em y a cada">
              <NumberInput ariaLabel="Distância entre marcas em y" value={stepY} min={0.01} onChange={(y) => setSteps(y, y, "step")} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Marcas em x a cada">
              <NumberInput ariaLabel="Distância entre marcas em x" value={el.step} min={0.01} onChange={(x) => setSteps(x, stepY, "step")} />
            </Field>
            <Field label="Marcas em y a cada">
              <NumberInput ariaLabel="Distância entre marcas em y" value={stepY} min={0.01} onChange={(y) => setSteps(el.step, y, "y-step")} />
            </Field>
          </>
        )}
        <SwitchField label="Números" checked={el.numbers} onChange={(numbers) => update((a) => ({ ...a, numbers }), "numbers")} />
        <SwitchField
          label="Malha quadriculada"
          checked={gridOn}
          onChange={setGrid}
          help="Impressa, atrás da figura, nas marcas dos eixos. A grade do editor fica em Vista."
        />
      </Section>
      <Section title="Escala">
        <Field label="1 em x mede">
          <NumberInput ariaLabel="Centímetros por unidade em x" value={unit[0]} min={0.05} max={20} suffix="cm" onChange={(x) => setUnit([x, unit[1]])} />
        </Field>
        <Field label="1 em y mede">
          <NumberInput ariaLabel="Centímetros por unidade em y" value={unit[1]} min={0.05} max={20} suffix="cm" onChange={(y) => setUnit([unit[0], y])} />
        </Field>
        {/* Only when the fit picks the y scale: a scale typed by hand stays anyway. */}
        {el.fit && (!el.unit || el.fitUnit) && (
          <SwitchField
            label="Bloquear reescala com figuras geométricas"
            checked={!el.scaleShapes}
            onChange={(block) =>
              update((a) => {
                const rest: Axes = { ...a };
                if (block) delete rest.scaleShapes;
                else rest.scaleShapes = true;
                return rest;
              }, "scale-shapes")
            }
            help="Com circunferências, polígonos, ângulos ou segmentos na figura, o ajuste não estica nem encolhe o y para um gráfico achatado ou íngreme, para não deformá-los. Os intervalos na reta numérica não contam. Desligado, o ajuste escolhe a escala do y mesmo assim."
          />
        )}
        {unit[0] !== unit[1] && distorted ? (
          <Hint>Com escalas diferentes, circunferências viram elipses e ângulos ficam deformados na figura.</Hint>
        ) : (
          <Hint>Escalas diferentes em x e y destacam uma parte do gráfico, como uma curva que sobe rápido.</Hint>
        )}
      </Section>
      <Section title="Nomes">
        <div className="grid grid-cols-2 gap-2">
          <Input
            aria-label="Nome do eixo horizontal"
            value={el.names[0]}
            maxLength={20}
            onChange={(e) => update((a) => ({ ...a, names: [e.target.value, a.names[1]] }), "name-x")}
          />
          <Input
            aria-label="Nome do eixo vertical"
            value={el.names[1]}
            maxLength={20}
            onChange={(e) => update((a) => ({ ...a, names: [a.names[0], e.target.value] }), "name-y")}
          />
        </div>
      </Section>
    </>
  );
}

const GRID_FOLLOW: { value: GridFollow; label: string; title: string }[] = [
  { value: "axes", label: "Eixos", title: "Na janela e nas marcas dos eixos" },
  { value: "figure", label: "Figura", title: "Em volta da figura toda, com um quadrado de folga" },
  { value: "none", label: "Fixa", title: "Na janela escolhida abaixo" },
];

function GridProperties({ el, update, multi, doc }: EditorProps<Grid>) {
  const hasAxes = doc.elements.some((e) => e.type === "axes");
  const w = gridWindow(doc, el);
  /** A window set by hand keeps the grid where it is from then on. */
  const setWindow = (x: [number, number], y: [number, number]) => update((g) => ({ ...g, x, y, follow: "none" }), "window");
  return (
    <Section title="Malha">
      <Choice
        label="Acompanha"
        // Without axes, a grid that followed them fits the figure.
        value={el.follow === "axes" && !hasAxes ? "figure" : el.follow}
        options={hasAxes ? GRID_FOLLOW : GRID_FOLLOW.filter((o) => o.value !== "axes")}
        // Fixed where it is now, so choosing Fixa doesn't make it jump.
        onChange={(follow) => update((g) => ({ ...g, follow, ...(follow === "none" ? { x: w.x, y: w.y } : {}) }), "follow")}
      />
      {el.follow === "axes" && hasAxes ? (
        <Hint>Os quadrados seguem as marcas dos eixos: mude-as nas propriedades dos eixos.</Hint>
      ) : (
        <>
          {!multi && (
            <>
              <IntervalFields label="x de" value={w.x} onChange={(x) => setWindow(x, w.y)} />
              <IntervalFields label="y de" value={w.y} onChange={(y) => setWindow(w.x, y)} />
            </>
          )}
          <Field label="Lado do quadrado">
            <NumberInput ariaLabel="Lado do quadrado" value={el.step} min={0.05} onChange={(step) => update((g) => ({ ...g, step }), "step")} />
          </Field>
        </>
      )}
    </Section>
  );
}
