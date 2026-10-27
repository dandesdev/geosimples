import { useState } from "react";
import { selectedOfType, type Element, type LabelScheme, type LabelTarget } from "@geosimples/core/figure";
import { Button } from "@/components/ui/button";
import { actions } from "@/lib/actions";
import { useFigureStore } from "@/store/figureStore";
import { Choice, Field, NumberInput, RangeField, Section, SwitchField } from "./controls";

const nameOf = (el: Element | undefined) => (el ? el.label?.text || el.id : "?");

function PointOnSegmentTool() {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const [mode, setMode] = useState<"ratio" | "distance">("ratio");
  const [value, setValue] = useState(0.5);
  const [from, setFrom] = useState<"a" | "b">("a");
  const segment = selectedOfType(doc, selection, "segment")[0];
  const byId = new Map(doc.elements.map((e) => [e.id, e]));
  const a = segment && byId.get(segment.a);
  const b = segment && byId.get(segment.b);

  return (
    <Section title="Ponto em segmento">
      {!segment ? (
        <p className="text-xs text-muted-foreground">Selecione um segmento.</p>
      ) : (
        <>
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
              { value: "a", label: nameOf(a) },
              { value: "b", label: nameOf(b) },
            ]}
            onChange={setFrom}
          />
          <Button
            size="sm"
            className="mt-1 w-full"
            onClick={() => actions.pointOnSegment(segment.id, mode === "ratio" ? { ratio: value } : { distance: value }, from)}
          >
            Inserir ponto
          </Button>
        </>
      )}
    </Section>
  );
}

function ProjectionTool() {
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const [withHeight, setWithHeight] = useState(true);
  const points = selectedOfType(doc, selection, "point");
  const ready = points.length >= 3;
  return (
    <Section title="Projeção ortogonal">
      <p className="mb-1 text-xs text-muted-foreground">
        {ready
          ? `Projeta ${nameOf(points[0])} sobre a reta ${nameOf(points[1])}${nameOf(points[2])}.`
          : "Selecione o ponto a projetar e depois dois pontos da reta."}
      </p>
      <SwitchField label="Altura e ângulo reto" checked={withHeight} onChange={setWithHeight} />
      <Button size="sm" className="mt-1 w-full" disabled={!ready} onClick={() => actions.project(withHeight)}>
        Projetar ponto
      </Button>
    </Section>
  );
}

const SCHEMES: Record<LabelTarget, { value: LabelScheme; label: string }[]> = {
  point: [
    { value: "latin", label: "A, B, C" },
    { value: "numbered", label: "P1, P2" },
    { value: "coordinates", label: "(x; y)" },
  ],
  segment: [
    { value: "latin-lower", label: "a, b, c" },
    { value: "length", label: "Medida" },
  ],
  angle: [
    { value: "greek", label: "α, β, γ" },
    { value: "measure", label: "Medida" },
  ],
};

function AutoLabelTool() {
  const decimals = useFigureStore((s) => s.settings.decimals);
  const setSetting = useFigureStore((s) => s.setSetting);
  const hasSelection = useFigureStore((s) => s.selection.length > 0);
  const [target, setTarget] = useState<LabelTarget>("point");
  const [scheme, setScheme] = useState<LabelScheme>("latin");
  const [onlySelected, setOnlySelected] = useState(false);
  const usesDecimals = scheme === "length" || scheme === "coordinates" || scheme === "measure";

  return (
    <Section title="Rotular automaticamente">
      <Choice
        label="Objetos"
        value={target}
        options={[
          { value: "point", label: "Pontos" },
          { value: "segment", label: "Segmentos" },
          { value: "angle", label: "Ângulos" },
        ]}
        onChange={(t) => {
          setTarget(t);
          setScheme(SCHEMES[t][0].value);
        }}
      />
      <Choice label="Nomes" value={scheme} options={SCHEMES[target]} onChange={setScheme} />
      {(scheme === "length" || scheme === "measure") && (
        <p className="mb-1 text-xs text-muted-foreground">A medida atualiza sozinha quando os pontos se movem.</p>
      )}
      <Choice
        label="Quais"
        value={onlySelected ? "selected" : "all"}
        options={[
          { value: "all", label: "Todos" },
          { value: "selected", label: "Selecionados" },
        ]}
        onChange={(v) => setOnlySelected(v === "selected")}
      />
      {usesDecimals && (
        <RangeField
          label="Casas decimais"
          value={decimals}
          min={0}
          max={4}
          step={1}
          format={(n) => String(n)}
          onChange={(n) => setSetting("decimals", n)}
        />
      )}
      <Button
        size="sm"
        className="mt-1 w-full"
        disabled={onlySelected && !hasSelection}
        onClick={() => actions.autoLabel(target, scheme, onlySelected)}
      >
        Rotular
      </Button>
    </Section>
  );
}

function FreeTextTool() {
  const [text, setText] = useState("");
  const insert = () => {
    if (actions.addText(text)) setText("");
  };
  return (
    <Section title="Texto livre">
      <p className="mb-1 text-xs text-muted-foreground">
        Um texto solto, como "Figura 1" ou "não está em escala". Ele entra abaixo da figura; arraste no modo Mover
        pontos. Na barra de pontos também dá: <code>"Figura 1"@(2;-1)</code>.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          insert();
        }}
      >
        <input
          value={text}
          maxLength={200}
          placeholder="Ex.: Figura 1"
          aria-label="Texto livre"
          onChange={(e) => setText(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        />
        <Button type="submit" size="sm" disabled={text.trim() === ""}>
          Inserir
        </Button>
      </form>
    </Section>
  );
}

export function Tools() {
  return (
    <div className="space-y-3">
      <AutoLabelTool />
      <FreeTextTool />
      <PointOnSegmentTool />
      <ProjectionTool />
    </div>
  );
}
