import { useState } from "react";
import type { LabelScheme } from "@geosimples/core/figure";
import { Button } from "@/components/ui/button";
import { actions } from "@/lib/actions";
import { AUTO_LABEL, NUMERIC_SCHEMES, toggleKind } from "@/lib/autoLabel";
import { useFigureStore } from "@/store/figureStore";
import { AUTO_LABEL_KINDS, type AutoLabelKind } from "@/store/prefsStore";
import { useActivePrefs } from "@/store/useActivePrefs";
import { Choice, RangeField, Section, SwitchField } from "./controls";

function AutoLabelTool() {
  const decimals = useFigureStore((s) => s.settings.decimals);
  const setSetting = useFigureStore((s) => s.setSetting);
  const hasSelection = useFigureStore((s) => s.selection.length > 0);
  const defaults = useActivePrefs().behavior.autoLabel;
  // Changes here last for the session; the starting choice lives in Configurações.
  const [picked, setPicked] = useState<Partial<Record<AutoLabelKind, boolean>>>({});
  const [schemes, setSchemes] = useState<Partial<Record<AutoLabelKind, LabelScheme>>>({});
  const [onlySelected, setOnlySelected] = useState(false);
  const isOn = (k: AutoLabelKind) => picked[k] ?? defaults[k];
  const schemeOf = (k: AutoLabelKind) => schemes[k] ?? AUTO_LABEL[k].schemes[0].value;
  const kinds = AUTO_LABEL_KINDS.filter(isOn);
  const usesDecimals = kinds.some((k) => NUMERIC_SCHEMES.includes(schemeOf(k)));
  const jobs = kinds.map((k) => ({ type: AUTO_LABEL[k].target, scheme: schemeOf(k) }));
  const disabled = kinds.length === 0 || (onlySelected && !hasSelection);

  return (
    <Section title="Rotular automaticamente">
      {AUTO_LABEL_KINDS.map((k) => (
        <div key={k}>
          <SwitchField
            label={AUTO_LABEL[k].label}
            checked={isOn(k)}
            onChange={(on) => setPicked((p) => toggleKind({ ...defaults, ...p }, k, on))}
          />
          {isOn(k) && AUTO_LABEL[k].schemes.length > 1 && (
            <Choice
              label="Como"
              value={schemeOf(k)}
              options={AUTO_LABEL[k].schemes}
              onChange={(s) => setSchemes((x) => ({ ...x, [k]: s }))}
            />
          )}
        </div>
      ))}
      <p className="mb-1 text-xs text-muted-foreground">
        Medidas atualizam sozinhas quando os pontos se movem. Um raio já desenhado, como o lado de um setor, recebe o
        rótulo no próprio segmento. Um polígono tem um rótulo só: área ou perímetro.
      </p>
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
      <div className="mt-1 flex gap-2">
        <Button size="sm" className="flex-1" disabled={disabled} onClick={() => actions.autoLabel(jobs, onlySelected)}>
          Rotular
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={disabled}
          title="Apaga os rótulos dos tipos marcados"
          onClick={() => actions.clearLabels(jobs, onlySelected)}
        >
          Apagar rótulos
        </Button>
      </div>
    </Section>
  );
}

/** Rótulos: labels for many objects at once. Free text is in Inserir and the input bar (texto: …). */
export function LabelTools() {
  return (
    <div className="space-y-3">
      <AutoLabelTool />
    </div>
  );
}
