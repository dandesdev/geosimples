import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
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
            <b>Pontos.</b> Digite na barra abaixo da prévia, separados por espaço: <code>A=0;0 B=4;0 C=0;3</code>. Também
            vale <code>+R:θ</code> (R unidades a θ graus do ponto anterior).
          </li>
          <li>
            <b>Seleção.</b> Clique nos objetos da prévia. A ordem importa: os números verdes mostram a ordem dos pontos
            selecionados.
          </li>
          <li>
            <b>Construir.</b> Com pontos selecionados, use a barra acima da prévia: ligar pontos, marcar ângulo (A, B, C
            marca o ângulo em B), polígono e circunferência.
          </li>
          <li>
            <b>Ajustar.</b> Em Customização mude cor, traço, preenchimento, marcas e rótulos. Com vários objetos do mesmo
            tipo selecionados, a mudança vale para todos.
          </li>
          <li>
            <b>Exportar.</b> TikZ para colar no LaTeX, PNG para colar no Word ou Google Docs, SVG para editar em outros
            programas.
          </li>
        </ol>
        <div className="text-sm">
          <h3 className="mb-1 font-semibold">Atalhos</h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
            <li>
              <Kbd>Ctrl</Kbd> <Kbd>Z</Kbd> desfazer
            </li>
            <li>
              <Kbd>Ctrl</Kbd> <Kbd>Y</Kbd> refazer
            </li>
            <li>
              <Kbd>Delete</Kbd> apagar seleção
            </li>
            <li>
              <Kbd>Esc</Kbd> limpar seleção
            </li>
            <li>
              <Kbd>Ctrl</Kbd> <Kbd>A</Kbd> selecionar tudo
            </li>
            <li>Roda do mouse: zoom</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">A figura fica salva neste navegador, mesmo se você fechar a página.</p>
      </DialogContent>
    </Dialog>
  );
}
