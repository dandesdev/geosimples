import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { PALETTE, resolveColor } from "@geosimples/core/figure";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { parseDecimal, show } from "@/lib/format";
import { usePanelStore } from "@/store/panelStore";

/** The label column is 6.5rem; a wider container can set `--field-label` for longer labels. */
export function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[var(--field-label,6.5rem)_1fr] items-center gap-2 py-1">
      <label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const OpenSections = createContext(false);

/** Sections inside stay open with a plain title, as dialogs want: they show everything at once. */
export function SectionsStayOpen({ children }: { children: ReactNode }) {
  return <OpenSections.Provider value>{children}</OpenSections.Provider>;
}

/**
 * A titled group of fields. In the side panel it opens and closes from its
 * title, and stays as the teacher left it. Inside SectionsStayOpen it is always open.
 */
export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  const fixed = useContext(OpenSections);
  const closed = usePanelStore((s) => !fixed && !!s.closed[title]);
  const toggle = usePanelStore((s) => s.toggle);
  const bodyId = useId();
  const heading = <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>;
  return (
    <section className="border-t pt-2 first:border-t-0 first:pt-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        {fixed ? (
          heading
        ) : (
          <button
            type="button"
            aria-expanded={!closed}
            aria-controls={bodyId}
            onClick={() => toggle(title)}
            className="-mx-1 flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", closed && "-rotate-90")} />
            {heading}
          </button>
        )}
        {!closed && aside}
      </div>
      {!closed && <div id={bodyId}>{children}</div>}
    </section>
  );
}

export function ColorPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  const current = resolveColor(value);
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1 pointer-coarse:gap-1.5">
      {PALETTE.map((c) => {
        const selected = resolveColor(c.value) === current;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.name}
            title={c.name}
            onClick={() => onChange(c.value)}
            className={cn(
              "h-5 w-5 rounded-full border border-black/20 transition-transform hover:scale-110 pointer-coarse:h-6 pointer-coarse:w-6",
              selected && "ring-2 ring-primary ring-offset-1",
            )}
            // Swatch colors come from data, so they can't be Tailwind classes.
            style={{ backgroundColor: resolveColor(c.value) }}
          />
        );
      })}
      <label
        title="Outra cor"
        className="relative h-5 w-5 cursor-pointer overflow-hidden rounded-full border border-black/20 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] pointer-coarse:h-6 pointer-coarse:w-6"
      >
        <span className="sr-only">Outra cor</span>
        <input
          type="color"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}


export function NumberInput({
  value,
  onChange,
  min,
  max,
  decimals = 2,
  suffix,
  id,
  disabled,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  decimals?: number;
  suffix?: string;
  id?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? show(value, decimals);
  const commit = (text: string) => {
    const n = parseDecimal(text);
    if (n === null) return false;
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    onChange(clamped);
    return true;
  };
  return (
    <div className="flex items-center gap-1">
      <Input
        id={id}
        inputMode="decimal"
        aria-label={ariaLabel}
        disabled={disabled}
        value={shown}
        onChange={(e) => {
          setDraft(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={cn(
          "h-8 min-w-0 bg-background px-2 font-mono sm:text-sm",
          draft !== null && parseDecimal(draft) === null && "border-destructive",
        )}
      />
      {suffix && <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (n: number) => string;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Slider
          aria-label={label}
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={([v]) => onChange(v)}
        />
        <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
          {format ? format(value) : show(value, 2)}
        </span>
      </div>
    </Field>
  );
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Field label={label}>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as T)}
        aria-label={label}
        className="flex-wrap justify-start gap-0.5"
      >
        {options.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            title={o.title ?? o.label}
            aria-label={o.title ?? o.label}
            className="h-7 min-w-7 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

export function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  );
}
