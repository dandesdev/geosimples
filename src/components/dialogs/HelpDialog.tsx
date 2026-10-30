import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCoarsePointer } from "@/lib/useMediaQuery";
import { ShortcutKeys } from "@/components/ShortcutKeys";
import { ACTION_LABELS, type ActionId } from "@/store/prefsStore";

const HELP_ACTIONS: ActionId[] = [
  "undo",
  "redo",
  "delete",
  "selectAll",
  "clearSelection",
  "modeSelect",
  "modePan",
  "modeMove",
  "modeAdd",
  "modeFigure",
  "toggleMultiSelect",
  "connect",
  "angle",
  "polygon",
  "export",
  "focusInput",
  "settings",
];

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const touch = useCoarsePointer();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Como usar o GeoSimples</DialogTitle>
          <DialogDescription>
            Figuras geométricas padronizadas para provas e materiais, exportadas para LaTeX (TikZ), PNG ou SVG.
          </DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            <b>Pontos.</b> Digite na barra abaixo da prévia: <code>A=(0;0)--B=(4;0)--C=(0;3)--</code> cria o triângulo
            ABC. <code>--</code> liga pontos, e no fim fecha o contorno. <code>+(4;0)</code> e <code>+(3:90)</code> partem
            do ponto anterior. O ícone de ajuda ao lado da barra mostra tudo. Ou use Adicionar pontos e clique na
            prévia; segurando esse botão, Figura rápida liga os pontos e fecha o polígono.
          </li>
          {touch ? (
            <li>
              <b>Seleção.</b> Toque num objeto da prévia, ou arraste uma caixa em volta deles. Para somar à seleção,
              ligue Seleção múltipla na barra. A ordem importa: os números verdes mostram a ordem dos pontos
              selecionados. Dois dedos movem e aproximam a vista.
            </li>
          ) : (
            <li>
              <b>Seleção.</b> Clique num objeto da prévia, ou arraste uma caixa em volta deles. Shift (ou Seleção
              múltipla, na barra) soma à seleção. A ordem importa: os números verdes mostram a ordem dos pontos
              selecionados. Arrastar com o botão do meio move a vista.
            </li>
          )}
          <li>
            <b>Construir.</b> Com pontos selecionados, use a barra acima da prévia: ligar pontos, marcar ângulo (A, B, C
            marca o ângulo em B), polígono e circunferência. Em Construções ficam ponto médio, altura, projeção
            ortogonal, mediana, bissetriz, mediatriz e interseção. O que é construído acompanha os pontos quando você os move.
          </li>
          <li>
            <b>Ajustar.</b> Em Propriedades veja medidas e construção e ajuste posição, raio, arco, setor e
            mediatriz. Em Formatação mude cor, traço, preenchimento, marcas e rótulos. Cada grupo abre e fecha pelo
            título. Com vários objetos do mesmo tipo selecionados, a mudança vale para todos. Um rótulo pode ser <b>Medida (atualiza sozinha)</b>: o
            comprimento, o ângulo, o raio, a área ou o perímetro, que muda quando os pontos se movem.
          </li>
          <li>
            <b>Gráficos.</b> Digite <code>f(x)=x^2-1</code> ou <code>y=2sen(x)</code> na barra de entrada, ou use o botão
            Gráfico de função. Os eixos entram junto. Vale x², raiz(x), |x|, 1/x, sen, cos, tg, ln, log e decimais com
            vírgula. Em Propriedades mude a expressão, onde a curva aparece e a janela, as marcas e a grade dos eixos.
          </li>
          <li>
            <b>Texto livre.</b> Em Rótulos e textos › Texto livre, ou na barra de entrada com <code>"Figura 1"@(2;-1)</code>.
            Arraste o texto no modo Mover pontos e mude fonte, tamanho e cor em Formatação.
          </li>
          {!touch && (
            <li>
              <b>Layout profissional.</b> Em Configurações › Aparência, ou no botão ao lado do nome do GeoSimples. A
              prévia ocupa a tela e cada painel vai para onde você quiser: arraste pela aba até a parte de cima ou
              de baixo de outro painel para empilhar, até as abas dele para juntar, até uma borda da janela, ou solte
              sobre a prévia para flutuar. As barras de ferramentas também: arraste pelos pontinhos. Em cima ou
              embaixo, elas ficam deitadas. O botão direito do mouse na prévia mostra todas as ações; Janelas, no canto
              de cima da prévia, põe tudo de volta no lugar. Ali também ficam o tema escuro, as configurações e esta ajuda.
            </li>
          )}
          <li>
            <b>Exportar.</b> TikZ para colar no LaTeX, PNG para colar no Word ou Google Docs, SVG para editar em outros
            programas.
          </li>
        </ol>
        {/* Keyboard shortcuts mean little on a phone or tablet without a keyboard. */}
        <div className={touch ? "hidden" : "text-sm"}>
          <h3 className="mb-1 font-semibold">Atalhos</h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
            {HELP_ACTIONS.map((id) => (
              <li key={id} className="flex items-center justify-between gap-2">
                {ACTION_LABELS[id]}
                <ShortcutKeys action={id} />
              </li>
            ))}
            <li>Roda do mouse: zoom</li>
            <li>Botão do meio: mover a vista</li>
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">Os atalhos podem ser mudados em Configurações.</p>
        </div>
        <p className="text-xs text-muted-foreground">A figura fica salva neste navegador, mesmo se você fechar a página.</p>
      </DialogContent>
    </Dialog>
  );
}
