import { useMemo, useRef, useState } from "react";
import { CircleHelp, Plus } from "lucide-react";
import { toast } from "sonner";
import { applyInput, type InputTokenKind, type ParsedInput } from "@geosimples/core/figure";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { parseDraft } from "@/lib/inputContext";
import { useCommand } from "@/lib/commands";
import { cn } from "@/lib/utils";
import { useFigureStore } from "@/store/figureStore";
import { opOptions } from "@/store/prefsStore";

const TOKEN_CLASS: Record<InputTokenKind, string> = {
  name: "text-primary",
  point: "rounded-sm bg-primary/10",
  ref: "text-sky-700",
  text: "text-amber-700",
  // The text stays "--" but shows as a connector line, so it can't be mistaken for a minus.
  connector:
    "relative text-transparent after:absolute after:inset-x-px after:top-1/2 after:h-0.5 after:-translate-y-1/2 after:rounded-full after:bg-primary after:content-['']",
  error: "text-destructive underline decoration-destructive decoration-wavy underline-offset-4",
};

/** Splits the text into runs of the same token kind. Errors win over anything they overlap. */
function runs(text: string, parsed: ParsedInput): { text: string; kind: InputTokenKind | null }[] {
  const kinds: (InputTokenKind | null)[] = Array.from({ length: text.length }, () => null);
  const ordered = [...parsed.tokens].sort((a, b) => Number(a.kind === "error") - Number(b.kind === "error"));
  for (const t of ordered) for (let i = t.start; i < t.end && i < text.length; i++) kinds[i] = t.kind;
  const out: { text: string; kind: InputTokenKind | null }[] = [];
  for (let i = 0; i < text.length; i++) {
    const prev = out[out.length - 1];
    // Each connector is its own run so its line spans exactly its two characters.
    if (prev && prev.kind === kinds[i] && kinds[i] !== "connector") prev.text += text[i];
    else if (prev && kinds[i] === "connector" && prev.kind === "connector" && prev.text.length < 2) prev.text += text[i];
    else out.push({ text: text[i], kind: kinds[i] });
  }
  return out;
}

function summary(parsed: ParsedInput): string {
  const fresh = parsed.nodes.filter((n) => n.kind === "new").length;
  const parts: string[] = [];
  if (fresh) parts.push(`${fresh} ${fresh === 1 ? "ponto novo" : "pontos novos"}`);
  if (parsed.segments.length) {
    parts.push(`${parsed.segments.length} ${parsed.segments.length === 1 ? "segmento" : "segmentos"}`);
  }
  if (parsed.texts.length) parts.push(`${parsed.texts.length} ${parsed.texts.length === 1 ? "texto" : "textos"}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}` : parts[0];
  return list ? `${list}. Enter para adicionar.` : "";
}

export function PointInput() {
  const text = useFigureStore((s) => s.inputDraft);
  const setText = useFigureStore((s) => s.setInputDraft);
  const doc = useFigureStore((s) => s.doc);
  const selection = useFigureStore((s) => s.selection);
  const inputRef = useRef<HTMLInputElement>(null);
  const helpRef = useRef<HTMLButtonElement>(null);
  const [scroll, setScroll] = useState(0);
  const [helpPinned, setHelpPinned] = useState(false);
  const [helpHovered, setHelpHovered] = useState(false);

  const parsed = useMemo(() => parseDraft(text, doc, selection), [text, doc, selection]);
  const syncScroll = () => setScroll(inputRef.current?.scrollLeft ?? 0);
  useCommand("focusInput", () => inputRef.current?.focus());

  const submit = () => {
    const { doc, selection, run } = useFigureStore.getState();
    const current = parseDraft(text, doc, selection);
    if (current.errors.length > 0) {
      toast.error(current.errors[0].message);
      return;
    }
    const result = run((d) => applyInput(d, current, opOptions()), "created");
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setText("");
    setScroll(0);
  };

  const message = text.trim() === "" ? "" : parsed.errors[0]?.message ?? summary(parsed);

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <form
        className="flex items-center gap-2 rounded-lg border bg-card p-1.5 focus-within:ring-2 focus-within:ring-primary/50"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="point-input" className="sr-only">
          Adicionar pontos
        </label>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              // Same font size as the input, or the colors drift off the letters.
              className="whitespace-pre px-2 py-1.5 font-mono text-base sm:text-sm"
              // Follows the input's horizontal scroll; the offset comes from the DOM.
              style={{ transform: `translateX(${-scroll}px)` }}
            >
              {runs(text, parsed).map((r, i) => (
                <span key={i} className={r.kind ? TOKEN_CLASS[r.kind] : undefined}>
                  {r.text}
                </span>
              ))}
            </div>
          </div>
          <input
            ref={inputRef}
            id="point-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              requestAnimationFrame(syncScroll);
            }}
            onScroll={syncScroll}
            onSelect={syncScroll}
            autoComplete="off"
            autoCorrect="off"
            // Point names are capital letters; on phones this saves a shift per name.
            autoCapitalize="characters"
            enterKeyHint="go"
            spellCheck={false}
            aria-invalid={parsed.errors.length > 0}
            aria-describedby="point-input-message"
            placeholder="Ex.: A=(0;0)--B=(4;0)--C=(0;3)--   ou   (1;1) +(2;0) +(3:90)"
            // 16px on phones: smaller text makes iOS zoom the page when the input gets focus.
            className="relative w-full bg-transparent px-2 py-1.5 font-mono text-base text-transparent caret-foreground outline-none selection:bg-primary/25 selection:text-transparent placeholder:font-sans placeholder:text-muted-foreground sm:text-sm"
          />
        </div>
        {/* Tapping toggles the help too: touch screens have no hover. */}
        <Tooltip open={helpHovered || helpPinned} onOpenChange={setHelpHovered}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Como digitar pontos"
              aria-expanded={helpHovered || helpPinned}
              ref={helpRef}
              onClick={() => setHelpPinned((v) => !v)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-primary"
            >
              <CircleHelp className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            collisionPadding={8}
            onPointerDownOutside={(e) => {
              if (!helpRef.current?.contains(e.target as Node)) setHelpPinned(false);
            }}
            onEscapeKeyDown={() => setHelpPinned(false)}
            className="max-w-[min(24rem,calc(100vw-1rem))] space-y-1 p-3 text-left"
          >
            <p>
              <b>(X;Y)</b> coordenadas: <code>(2;3)</code>, <code>(1,5;-2)</code>. Os parênteses são opcionais.
            </p>
            <p>
              <b>(R:θ)</b> polar, R unidades a θ graus da origem: <code>(3:60)</code>
            </p>
            <p>
              <b>+(X;Y)</b> e <b>+(R:θ)</b> a partir do ponto anterior: <code>(0;0) +(4;0) +(3:90)</code>
            </p>
            <p>
              <b>Nome=</b> dá nome ao ponto: <code>A=(0;0)</code>. Um nome sozinho usa um ponto existente.
            </p>
            <p>
              <b>--</b> liga os pontos vizinhos; no fim, fecha o contorno: <code>A=(0;0)--B=(4;0)--C=(0;3)--</code>
            </p>
            <p>
              Espaço sem <b>--</b> separa pontos soltos. <code>A--C</code> liga pontos que já existem.
            </p>
            <p>
              <b>"texto"@(X;Y)</b> escreve um texto solto centrado no ponto: <code>"Figura 1"@(2;-1)</code>
            </p>
          </TooltipContent>
        </Tooltip>
        <Button
          type="submit"
          size="sm"
          aria-label="Adicionar"
          disabled={text.trim() === "" || parsed.errors.length > 0}
        >
          <Plus />
          <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </form>
      <p
        id="point-input-message"
        aria-live="polite"
        className={cn(
          "min-h-4 px-2 text-xs",
          parsed.errors.length > 0 ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {message}
      </p>
    </div>
  );
}
