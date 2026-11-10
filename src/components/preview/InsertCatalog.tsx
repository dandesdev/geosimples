import { useCallback, useMemo, useRef, useState, type ComponentType } from "react";
import { Blend, Calculator, ChartSpline, MoveUpRight, Plus, Search } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddPointIcon, AxesIcon, GridIcon, NumberLineIcon, ToFunctionsIcon, VerticalLineIcon } from "@/components/icons";
import { actions } from "@/lib/actions";
import { previewProps, useInsertAvailability, type Availability, type InsertCheckId } from "@/lib/availability";
import { useCommand } from "@/lib/commands";
import { useFigureStore } from "@/store/figureStore";
import { cn } from "@/lib/utils";
import { BOARD_ITEMS } from "./tools";
import type { MenuSide } from "./ActionBar";

interface CatalogItem {
  section: string;
  Icon: ComponentType;
  title: string;
  hint: string;
  /** More words the search finds it by. */
  words?: string;
  availability: Availability;
  run: () => void;
  /** Goes on in the input bar, which keeps the focus when the catalog closes. */
  typing?: boolean;
}

/** Things that need no selection. */
const ALWAYS: Availability = { reason: null, preview: null };

const SECTIONS = ["Pontos", "Gráficos", "Vetores", "Conjuntos", "Contas e quadros"];

/** Lowercase and without accents, so "funcao" finds "função". */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const BOARD_WORDS: Record<string, string> = {
  "Conta armada…": "divisao multiplicacao soma adicao subtracao chave algoritmo",
  "MMC…": "minimo multiplo comum",
  "MDC…": "maximo divisor comum",
  "MDC por divisões sucessivas…": "euclides maximo divisor comum",
  "Fatoração em primos…": "decomposicao fatores primos",
  "Varal de intervalos…": "uniao intersecao intervalo reta",
  "Esboço de sinal…": "estudo do sinal inequacao",
  "Quadro de sinais…": "estudo do sinal inequacao produto quociente",
  "Equação modular…": "modulo valor absoluto",
};

function catalog(av: Record<InsertCheckId, Availability>): CatalogItem[] {
  const typing = (prefill: string) => () => actions.startTyping(prefill);
  return [
    {
      section: "Pontos",
      Icon: AddPointIcon,
      title: "Pontos…",
      hint: "A=0;0 B=4;0 C=0;3 na barra de entrada. Ou clique na prévia no modo Adicionar pontos.",
      words: "triangulo poligono vertice coordenadas",
      availability: ALWAYS,
      run: typing(""),
      typing: true,
    },
    {
      section: "Gráficos",
      Icon: ChartSpline,
      title: "Nova função…",
      hint: "y = na barra de entrada, como x^2 - 1. Os eixos vêm junto.",
      words: "grafico curva parabola reta f(x)",
      availability: ALWAYS,
      run: actions.startGraph,
      typing: true,
    },
    {
      section: "Gráficos",
      Icon: VerticalLineIcon,
      title: "Reta vertical…",
      hint: "x = na barra, como x = 2. Tracejada, como uma assíntota.",
      words: "assintota",
      availability: ALWAYS,
      run: actions.startVerticalLine,
      typing: true,
    },
    {
      section: "Gráficos",
      Icon: NumberLineIcon,
      title: "Reta numérica",
      hint: "Intervalos na barra: [-2; 3[ ou ]-∞; 1].",
      words: "intervalo",
      availability: ALWAYS,
      run: actions.addNumberLine,
      typing: true,
    },
    { section: "Gráficos", Icon: AxesIcon, title: "Eixos", hint: "Sem gráfico também. Eles se ajustam à figura.", words: "plano cartesiano", availability: av.axes, run: actions.addAxes },
    {
      section: "Gráficos",
      Icon: GridIcon,
      title: "Malha quadriculada",
      hint: "Impressa, atrás da figura: sobre os eixos ou em volta de tudo.",
      words: "grade quadriculado",
      availability: av.grid,
      run: actions.addGrid,
    },
    {
      section: "Gráficos",
      Icon: ToFunctionsIcon,
      title: "Transformar em funções",
      hint: "Os segmentos selecionados viram retas; circunferências, duas metades.",
      availability: av.toFunctions,
      run: actions.toFunctions,
    },
    {
      section: "Vetores",
      Icon: MoveUpRight,
      title: "Vetor entre pontos",
      hint: "Selecione a origem e depois a extremidade.",
      words: "seta forca fisica",
      availability: av.vector,
      run: actions.vector,
    },
    {
      section: "Vetores",
      Icon: MoveUpRight,
      title: "Digitar vetor…",
      hint: "vetor u=(3;2), vetor F=(5:30)@(1;1)",
      words: "seta forca fisica",
      availability: ALWAYS,
      run: typing("vetor "),
      typing: true,
    },
    { section: "Vetores", Icon: MoveUpRight, title: "Versores i e j", hint: "Saindo da origem.", words: "base unitario", availability: av.basis, run: actions.basis },
    ...([1, 2, 3] as const).map(
      (n): CatalogItem => ({
        section: "Conjuntos",
        Icon: Blend,
        title: n === 1 ? "Diagrama com 1 conjunto" : `Diagrama com ${n} conjuntos`,
        hint: n === 1 ? "Dentro de um retângulo U. Arraste os círculos no modo Mover." : n === 2 ? "A e B, dentro de U." : "A, B e C, dentro de U.",
        words: "venn",
        availability: av[`venn-${n}`],
        run: () => actions.venn(n),
      }),
    ),
    {
      section: "Conjuntos",
      Icon: Blend,
      title: "Digitar região…",
      hint: "região (A U B)' n C, com U para união e n para interseção.",
      words: "venn uniao intersecao diferenca complementar",
      availability: ALWAYS,
      run: typing("região "),
      typing: true,
    },
    {
      section: "Conjuntos",
      Icon: Blend,
      title: "Elementos…",
      hint: "A={1,2,3}. Cada um vai para a região certa. Ou n(A n B)=3.",
      words: "venn",
      availability: ALWAYS,
      run: typing("A={"),
      typing: true,
    },
    ...BOARD_ITEMS.flatMap((item): CatalogItem[] =>
      item === null
        ? []
        : [
            {
              section: "Contas e quadros",
              Icon: Calculator,
              title: item.title,
              hint: item.hint,
              words: BOARD_WORDS[item.title],
              availability: ALWAYS,
              run: typing(item.prefill),
              typing: true,
            },
          ],
    ),
  ];
}

function matches(item: CatalogItem, words: string[]) {
  const text = fold(`${item.title} ${item.hint} ${item.section} ${item.words ?? ""}`);
  return words.every((w) => text.includes(w));
}

/** Moves the focus among the catalog's items with the arrow keys. */
function moveFocus(list: HTMLElement | null, from: Element | null, step: 1 | -1) {
  if (!list) return;
  const items = [...list.querySelectorAll<HTMLButtonElement>("[data-catalog-item]:not(:disabled)")];
  if (items.length === 0) return;
  const at = items.indexOf(from as HTMLButtonElement);
  const next = at === -1 ? (step === 1 ? 0 : items.length - 1) : at + step;
  if (next < 0) list.closest("[data-catalog]")?.querySelector<HTMLInputElement>("input")?.focus();
  else items[Math.min(next, items.length - 1)].focus();
}

/**
 * Inserir: everything that adds something new to the figure without a
 * selection, in sections, with a search. New kinds of figures become new
 * sections here instead of new toolbar buttons. `compact` is a square
 * button; `wideLabel` shows the word only when the toolbar is wide.
 */
export function InsertCatalog({ side, compact = false, wideLabel = false }: { side: MenuSide; compact?: boolean; wideLabel?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = catalog(useInsertAvailability());
  useCommand("insert", useCallback(() => setOpen(true), []));
  const list = useRef<HTMLDivElement>(null);
  /** Set by items that go on in the input bar, so the closing catalog leaves the focus there. */
  const toInput = useRef(false);
  const words = useMemo(() => fold(query).split(/\s+/).filter(Boolean), [query]);
  const shown = items.filter((item) => matches(item, words));

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      useFigureStore.getState().setActionPreview(null);
    }
  };
  const run = (item: CatalogItem) => {
    if (item.availability.reason) return;
    toInput.current = item.typing === true;
    close(false);
    item.run();
  };

  return (
    <Popover open={open} onOpenChange={close}>
      <PopoverTrigger asChild>
        {compact ? (
          <IconButton label="Inserir" hint="Gráficos, vetores, conjuntos, contas e quadros." shortcut="insert" active={open}>
            <Plus />
          </IconButton>
        ) : (
          <Button size="sm" variant="outline" className="shrink-0" aria-label="Inserir" title="Inserir gráficos, vetores, conjuntos, contas e quadros">
            <Plus />
            <span className={cn(wideLabel && "hidden @[54rem]:inline")}>Inserir</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        data-catalog=""
        aria-label="Inserir"
        className="flex max-h-(--radix-popover-content-available-height) w-[min(60rem,calc(100vw-1rem))] flex-col p-0"
        onCloseAutoFocus={(e) => {
          if (!toInput.current) return;
          toInput.current = false;
          // The input bar has the focus now; the trigger would take it back.
          e.preventDefault();
        }}
      >
        <label className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const first = shown.find((item) => !item.availability.reason);
                if (first) run(first);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                moveFocus(list.current, null, 1);
              }
            }}
            placeholder="Buscar: função, mmc, venn, vetor…"
            aria-label="Buscar no Inserir"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div
          ref={list}
          className="min-h-0 flex-1 overflow-y-auto p-2"
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            moveFocus(list.current, document.activeElement, e.key === "ArrowDown" ? 1 : -1);
          }}
        >
          {shown.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nada encontrado para “{query}”.</p>}
          {/* Columns that the sections flow down, so a short one doesn't leave a hole beside a long one. */}
          <div className={cn("gap-x-3", words.length === 0 && "sm:columns-2 lg:columns-3")}>
            {SECTIONS.map((section) => {
              const inSection = shown.filter((item) => item.section === section);
              if (inSection.length === 0) return null;
              return (
                <section key={section} aria-label={section} className="mb-2 flex break-inside-avoid flex-col">
                  <h3 className="px-2 pb-1 pt-1.5 text-xs font-semibold text-muted-foreground">{section}</h3>
                  {inSection.map((item) => (
                    <CatalogButton key={item.title} item={item} onRun={() => run(item)} />
                  ))}
                </section>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CatalogButton({ item, onRun }: { item: CatalogItem; onRun: () => void }) {
  const reason = item.availability.reason;
  return (
    <button
      type="button"
      data-catalog-item=""
      disabled={reason !== null}
      onClick={onRun}
      className="flex items-start gap-3 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 [&_svg]:h-5 [&_svg]:w-5"
      {...previewProps(item.availability)}
    >
      <span className="mt-0.5 shrink-0">
        <item.Icon />
      </span>
      <span className="flex flex-col">
        <span className="font-medium">{item.title}</span>
        <span className="text-xs text-muted-foreground">{item.hint}</span>
        {reason && <span className="mt-0.5 text-xs text-destructive">{reason}</span>}
      </span>
    </button>
  );
}
