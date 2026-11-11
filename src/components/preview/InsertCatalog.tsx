import { useCallback, useMemo, useRef, useState, type ComponentType } from "react";
import { Blend, Calculator, ChartSpline, MoveUpRight, Plus, Search } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddPointIcon, AxesIcon, GridIcon, NumberLineIcon, ToFunctionsIcon, VerticalLineIcon } from "@/components/icons";
import { actions } from "@/lib/actions";
import { previewProps, useInsertAvailability, type Availability, type InsertCheckId } from "@/lib/availability";
import { useCommand } from "@/lib/commands";
import { useCoarsePointer } from "@/lib/useMediaQuery";
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
 * `variant` "screen" is the phone layout: a big button that opens the
 * catalog over the whole screen, where a popover would be a sliver.
 */
export function InsertCatalog({
  side = "bottom",
  compact = false,
  wideLabel = false,
  variant = "popover",
}: {
  side?: MenuSide;
  compact?: boolean;
  wideLabel?: boolean;
  variant?: "popover" | "screen";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = catalog(useInsertAvailability());
  useCommand("insert", useCallback(() => setOpen(true), []));
  const content = useRef<HTMLDivElement>(null);
  const touch = useCoarsePointer();
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

  /** Where the focus goes as the catalog opens and closes. */
  const focusProps = {
    onOpenAutoFocus: (e: Event) => {
      // A finger opened it: focusing the search would bring up the keyboard over half of the options.
      // The catalog itself takes the focus, and the search is one tap away.
      if (!touch) return;
      e.preventDefault();
      content.current?.focus();
    },
    onCloseAutoFocus: (e: Event) => {
      if (!toInput.current) return;
      toInput.current = false;
      // The input bar has the focus now; the trigger would take it back.
      e.preventDefault();
    },
  };
  const screen = variant === "screen";

  const search = (
    <label className={cn("flex shrink-0 items-center gap-2 border-b px-3", screen ? "py-3" : "py-2")}>
      <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <input
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
        enterKeyHint="search"
        className={cn(
          "min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground",
          // 16px on phones: smaller text makes iOS zoom the page when the input gets focus.
          screen ? "text-base" : "text-sm",
        )}
      />
    </label>
  );

  const sections = (
    <div
      ref={list}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
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
                <CatalogButton key={item.title} item={item} roomy={screen} onRun={() => run(item)} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );

  if (screen) {
    return (
      <Dialog open={open} onOpenChange={close}>
        <DialogTrigger asChild>
          {/* As tall as the input bar beside it, and the one filled button of the row. */}
          <Button className="h-[3.125rem] shrink-0 rounded-lg px-3.5 [&_svg]:size-5" title="Inserir gráficos, vetores, conjuntos, contas e quadros">
            <Plus />
            Inserir
          </Button>
        </DialogTrigger>
        <DialogContent
          ref={content}
          data-catalog=""
          aria-describedby={undefined}
          // The whole screen, instead of the centered box of the other dialogs.
          className="left-0 top-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden border-0 bg-popover p-0 outline-none sm:rounded-none"
          {...focusProps}
        >
          <DialogTitle className="shrink-0 border-b px-3 py-3.5 text-base">Inserir</DialogTitle>
          {search}
          {sections}
        </DialogContent>
      </Dialog>
    );
  }

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
        ref={content}
        side={side}
        align="start"
        data-catalog=""
        aria-label="Inserir"
        className="flex max-h-(--radix-popover-content-available-height) w-[min(60rem,calc(100vw-1rem))] flex-col p-0"
        {...focusProps}
      >
        {search}
        {sections}
      </PopoverContent>
    </Popover>
  );
}

function CatalogButton({ item, roomy, onRun }: { item: CatalogItem; roomy: boolean; onRun: () => void }) {
  const reason = item.availability.reason;
  return (
    <button
      type="button"
      data-catalog-item=""
      disabled={reason !== null}
      onClick={onRun}
      className={cn(
        "flex items-start gap-3 rounded-md px-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 [&_svg]:h-5 [&_svg]:w-5",
        // More room between the rows for a finger.
        roomy ? "py-2.5" : "py-1.5",
      )}
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
