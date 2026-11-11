import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import {
  addAxes,
  addNumberLine,
  applyInput,
  emptyDoc,
  encodeShareToken,
  parseInput,
  shareUrl,
  type FigureDoc,
  type InputContext,
} from "@geosimples/core/figure";
import { FigureSnapshot } from "@/components/preview/FigureSnapshot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApplyTheme } from "@/lib/theme";
import { useActivePrefs } from "@/store/useActivePrefs";

/** One live example: lines typed in the bar, one after the other, over an optional starting figure. */
interface Sample {
  caption: string;
  lines: string[];
  /** A number line already in the figure, which intervals need. */
  numberLine?: boolean;
  /** Numbered axes already in the figure, so a point's coordinates can be read off them. */
  axes?: boolean;
}

interface Topic {
  id: string;
  title: string;
  intro: ReactNode;
  samples: Sample[];
}

const TOPICS: Topic[] = [
  {
    id: "pontos",
    title: "Pontos",
    intro: (
      <>
        Escreva as coordenadas entre parênteses, separadas por ponto e vírgula. A vírgula fica livre para os decimais. Um nome antes do
        sinal de igual vira o rótulo do ponto.
      </>
    ),
    samples: [
      { caption: "Um ponto com nome. Mude os números e veja o ponto andar nos eixos.", lines: ["A=(2;3)"], axes: true },
      { caption: "Coordenadas polares: 3 unidades a 60 graus.", lines: ["P=(3:60)"], axes: true },
      { caption: "O sinal + anda a partir do ponto anterior.", lines: ["A=(0;0) B=+(4;0) C=+(0;3)"], axes: true },
    ],
  },
  {
    id: "ligar",
    title: "Ligar pontos",
    intro: (
      <>
        Dois traços <code>--</code> ligam os pontos vizinhos. Um <code>--</code> no fim fecha o contorno. Um nome sozinho usa um ponto que
        já existe.
      </>
    ),
    samples: [
      { caption: "Um triângulo, fechado pelo último --.", lines: ["A=(0;0)--B=(4;0)--C=(0;3)--"] },
      { caption: "A segunda linha liga pontos criados na primeira.", lines: ["A=(0;0) B=(4;0) C=(4;3) D=(0;3)", "A--C"] },
    ],
  },
  {
    id: "textos",
    title: "Textos",
    intro: (
      <>
        Comece com <code>texto:</code>, e o texto entra centrado embaixo da figura. Para escolher o lugar, escreva entre aspas e diga onde
        fica com @.
      </>
    ),
    samples: [
      { caption: "Embaixo da figura, sem pensar no lugar.", lines: ["A=(0;0)--B=(4;0)--C=(0;3)--", "texto: Figura 1"] },
      { caption: "Num lugar escolhido.", lines: ["A=(0;0)--B=(4;0)--C=(0;3)--", '"não está em escala"@(2;-1)'] },
    ],
  },
  {
    id: "funcoes",
    title: "Funções e retas",
    intro: (
      <>
        Comece com <code>f(x)=</code> ou <code>y=</code>. Vale x^2 ou x², raiz(x), |x|, 1/x, sen, cos, tg, ln e log. Os eixos entram
        sozinhos.
      </>
    ),
    samples: [
      { caption: "Uma parábola. Troque a fórmula.", lines: ["f(x)=x^2-1"] },
      { caption: "Um ponto sobre o gráfico.", lines: ["f(x)=x^2-1", "P=f(2)"] },
      { caption: "Uma reta vertical, tracejada como assíntota.", lines: ["f(x)=1/x", "x=0"] },
      {
        caption: "Um intervalo na reta numérica. O colchete virado para fora deixa a ponta aberta.",
        lines: ["[-2; 3["],
        numberLine: true,
      },
    ],
  },
  {
    id: "vetores",
    title: "Vetores",
    intro: (
      <>
        Comece com <code>vetor</code>. Depois do igual vêm as componentes, ou módulo e ângulo. Com <code>@</code> você escolhe de onde ele
        sai. Selecione vetores e o botão Vetores aparece na barra, com soma, diferença e projeção.
      </>
    ),
    samples: [
      { caption: "Pelas componentes, saindo da origem.", lines: ["vetor u=(4;1)"] },
      { caption: "Módulo 5, a 30 graus, saindo de (1;1).", lines: ["vetor F=(5:30)@(1;1)"] },
      { caption: "Entre dois pontos que já existem.", lines: ["A=(0;0) B=(3;2)", "vetor A B"] },
    ],
  },
  {
    id: "conjuntos",
    title: "Conjuntos",
    intro: (
      <>
        Escreva os elementos entre chaves: cada um vai para a região certa do diagrama. Com um diagrama na figura, o botão Conjuntos aparece na barra, com as operações. Para digitar,
        use U para união, n para interseção, - para diferença e ' para complementar.
      </>
    ),
    samples: [
      { caption: "Dois conjuntos com um elemento em comum.", lines: ["A={1,2,3}", "B={3,4}"] },
      { caption: "A interseção, escrita com a letra n.", lines: ["A={}", "B={}", "região A n B"] },
      { caption: "O que está fora da união.", lines: ["A={}", "B={}", "região (A U B)'"] },
      { caption: "A quantidade em uma região.", lines: ["A={}", "B={}", "n(A n B)=7"] },
    ],
  },
  {
    id: "contas",
    title: "Contas armadas",
    intro: (
      <>
        Escreva a conta como numa calculadora. Ao clicar nela no editor, você escolhe entre Resolvido, Em branco e Lacunas, e na divisão, o
        processo e as casas decimais.
      </>
    ),
    samples: [
      { caption: "Divisão com a chave. Use / ou ÷.", lines: ["1234/5"] },
      { caption: "Soma com vai-um.", lines: ["58+67"] },
      { caption: "Subtração com empréstimo.", lines: ["302-5"] },
      { caption: "Multiplicação com as parcelas. Use x ou *.", lines: ["12x34"] },
    ],
  },
  {
    id: "divisores",
    title: "Fatoração, MMC e MDC",
    intro: <>Separe os números com ponto e vírgula ou espaço.</>,
    samples: [
      { caption: "Fatoração em primos.", lines: ["fatorar 360"] },
      { caption: "MMC pela fatoração simultânea.", lines: ["mmc(12;18)"] },
      { caption: "MDC com os primos comuns marcados.", lines: ["mdc(12;18)"] },
      { caption: "MDC por divisões sucessivas.", lines: ["euclides(48;18)"] },
    ],
  },
  {
    id: "reta",
    title: "Varal, sinais e módulos",
    intro: (
      <>
        Frações e raízes continuam exatas. Entre intervalos, use U, n ou -. Para infinito, escreva <code>inf</code>. Em sinal, quadro
        e módulos vale inequação: <code>&gt;=</code> vira ≥ e <code>&lt;=</code> vira ≤ enquanto você digita, e o conjunto solução aparece
        na reta, com bolinhas abertas e fechadas.
      </>
    ),
    samples: [
      { caption: "Varal da interseção de dois intervalos.", lines: ["varal [1/2;3] n ]2;5["] },
      { caption: "A curva sobre a reta, para o estudo de sinal.", lines: ["sinal x^2-4"] },
      { caption: "Quadro de sinais, um fator por linha.", lines: ["quadro (x-1)(x+2)/(x-3)"] },
      { caption: "Inequação: a solução na reta e o conjunto S.", lines: ["sinal x^2-4 ≥ 0"] },
      { caption: "Quadro de sinais de uma inequação.", lines: ["quadro (x-1)/(x+2) < 0"] },
      { caption: "Equação modular, em colunas.", lines: ["modular |x-1|+|x+2|=5"] },
      { caption: "Módulo de qualquer grau, e inequação.", lines: ["|x^2-1| ≤ 3"] },
      { caption: "Com seno, num intervalo.", lines: ["|sen(x)| = 1/2 em [0; 2pi]"] },
    ],
  },
];

const KEYS: [string, string][] = [
  ["∪ união", "U ou uniao"],
  ["∩ interseção", "n ou inter"],
  ["− diferença", "- ou menos"],
  ["A' complementar", "A'"],
  ["∞ infinito", "inf"],
  ["÷ divisão", "/"],
  ["× multiplicação", "x ou *"],
  ["x² potência", "x^2"],
  ["√ raiz", "raiz(2)"],
  ["π", "pi"],
];

function contextOf(doc: FigureDoc): InputContext {
  return {
    points: doc.elements.flatMap((e) => (e.type === "point" ? [{ id: e.id, x: e.x, y: e.y, label: e.label?.text }] : [])),
    graphs: doc.elements.flatMap((e) => (e.type === "function" && e.label?.text ? [{ id: e.id, name: e.label.text }] : [])),
  };
}

/** Runs the lines as the bar would, one after the other, and says what is wrong with each. */
function run(lines: string[], sample: Sample) {
  let doc = emptyDoc();
  if (sample.numberLine) doc = addNumberLine(doc).doc;
  if (sample.axes) doc = addAxes(doc).doc;
  const errors = lines.map((line) => {
    if (line.trim() === "") return null;
    const parsed = parseInput(line, contextOf(doc));
    const result = applyInput(doc, parsed, { autoName: true });
    if (result.error) return result.error;
    doc = result.doc;
    return null;
  });
  return { doc, errors };
}

function Example({ sample }: { sample: Sample }) {
  const [lines, setLines] = useState(sample.lines);
  const { doc, errors } = run(lines, sample);
  const changed = lines.some((l, i) => l !== sample.lines[i]);
  const open = async () => {
    const token = await encodeShareToken({ name: "Exemplo do guia", doc });
    window.open(shareUrl(`${window.location.origin}/`, token), "_blank", "noopener");
  };
  return (
    <figure className="overflow-hidden rounded-lg border bg-card">
      <figcaption className="px-3 pt-3 text-sm text-muted-foreground">{sample.caption}</figcaption>
      <div className="space-y-1.5 p-3">
        {lines.map((line, i) => (
          <div key={i}>
            <Input
              value={line}
              spellCheck={false}
              aria-label={`Linha ${i + 1}: ${sample.caption}`}
              aria-invalid={errors[i] !== null}
              className="font-mono sm:text-sm"
              onChange={(e) => setLines(lines.map((l, j) => (j === i ? e.target.value : l)))}
            />
            {errors[i] && <p className="mt-1 text-xs text-destructive">{errors[i]}</p>}
          </div>
        ))}
      </div>
      {doc.elements.length > 0 && <GuideFigure doc={doc} />}
      <div className="flex justify-end gap-1 border-t p-1.5">
        {changed && (
          <Button variant="ghost" size="sm" onClick={() => setLines(sample.lines)}>
            <RotateCcw />
            Voltar ao exemplo
          </Button>
        )}
        <Button variant="ghost" size="sm" disabled={doc.elements.length === 0} onClick={open}>
          <ExternalLink />
          Abrir no editor
        </Button>
      </div>
    </figure>
  );
}

/**
 * The figure as the editor's preview shows it, not as it is exported: on the
 * theme's paper, over the grid when the profile shows it.
 */
function GuideFigure({ doc }: { doc: FigureDoc }) {
  const showGrid = useActivePrefs().behavior.showGrid;
  return (
    <div data-testid="guide-figure" className="border-t">
      <FigureSnapshot doc={doc} grid={showGrid} label="Figura do exemplo" className="aspect-[3/2] w-full" />
    </div>
  );
}

/** The page behind "Mais explicações": the input bar, topic by topic, with examples that run for real. */
export function InputGuide() {
  useApplyTheme();
  // The page is drawn after the browser looks for the #topic of the link, so it goes there now.
  useEffect(() => {
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, []);
  return (
    <div className="h-dvh overflow-y-auto scroll-smooth bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8 sm:px-6">
        <nav aria-label="Assuntos" className="sticky top-8 hidden h-fit w-44 shrink-0 md:block">
          <ul className="space-y-1 text-sm">
            {TOPICS.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="block rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                  {t.title}
                </a>
              </li>
            ))}
            <li>
              <a href="#teclado" className="block rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                Sem a tecla no teclado
              </a>
            </li>
          </ul>
        </nav>
        <main className="min-w-0 flex-1">
          <header className="mb-8">
            <a href="/" className="text-sm text-primary underline underline-offset-2">
              Voltar ao GeoSimples
            </a>
            <h1 className="mt-2 text-2xl font-semibold">Guia da barra de entrada</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Tudo o que dá para criar digitando. Os exemplos abaixo funcionam de verdade: mude o texto e a figura muda junto. Quando gostar
              do resultado, abra no editor.
            </p>
          </header>
          {TOPICS.map((topic) => (
            <section key={topic.id} id={topic.id} className="mb-10 scroll-mt-6">
              <h2 className="text-lg font-semibold">{topic.title}</h2>
              <p className="mb-3 mt-1 max-w-2xl text-sm text-muted-foreground">{topic.intro}</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {topic.samples.map((sample) => (
                  <Example key={sample.caption} sample={sample} />
                ))}
              </div>
            </section>
          ))}
          <section id="teclado" className="mb-10 scroll-mt-6">
            <h2 className="text-lg font-semibold">Sem a tecla no teclado</h2>
            <p className="mb-3 mt-1 max-w-2xl text-sm text-muted-foreground">
              Nenhum símbolo especial é obrigatório. Digite como na coluna da direita.
            </p>
            <table className="w-full max-w-md text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1 font-medium">Símbolo</th>
                  <th className="py-1 font-medium">Digite</th>
                </tr>
              </thead>
              <tbody>
                {KEYS.map(([symbol, typed]) => (
                  <tr key={symbol} className="border-b last:border-0">
                    <td className="py-1.5">{symbol}</td>
                    <td className="py-1.5 font-mono">{typed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </main>
      </div>
    </div>
  );
}
