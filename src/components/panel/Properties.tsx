import { useState, type ReactNode } from "react";
import {
  DEFAULT_GUIDE_STROKE,
  axesStepY,
  deleteElements,
  functionValue,
  gridWindow,
  moveNumberLine,
  piText,
  piWindow,
  setAxesWindow,
  updateElements,
  type Axes,
  type EndMark,
  type FunctionGraph,
  type Grid,
  type GridFollow,
  type NumberLine,
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
import { actions } from "@/lib/actions";
import { describeConstruction } from "@/lib/names";
import { useFigureStore } from "@/store/figureStore";
import { Choice, Field, NumberInput, Section, SwitchField } from "./controls";
import { useInspected, type EditorProps } from "./inspected";

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
  const { el, props } = inspected;
  return (
    <div className="space-y-2">
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
  return (
    <>
      {!bisector && (
        <Section title="Medidas">
          <Readout label="Comprimento" value={a && b ? formatNumber(dist(a, b), decimals) : ""} />
        </Section>
      )}
      {bisector && <BisectorFields el={el} bisector={bisector} doc={doc} />}
      {!multi && !bisector && <PointOnSegment el={el} doc={doc} />}
    </>
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
  if (multi) return <Hint>Com vários eixos selecionados, a janela se ajusta um por vez.</Hint>;
  const stepY = axesStepY(el);
  return (
    <>
      <Section title="Janela">
        <SwitchField
          label="Ajustar à figura"
          checked={!!el.fit}
          onChange={(fit) => update((a) => ({ ...a, fit }), "fit")}
          help="Os eixos cobrem a figura toda, com uma marca de folga, e as marcas se espaçam para os números não se amontoarem. Mudar a janela ou as marcas à mão desliga o ajuste."
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
        value={el.follow}
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
