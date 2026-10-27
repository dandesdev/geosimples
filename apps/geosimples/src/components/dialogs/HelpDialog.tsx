import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  "connect",
  "angle",
  "polygon",
  "export",
  "focusInput",
  "settings",
];

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
            <b>Pontos.</b> Digite na barra abaixo da prévia: <code>A=(0;0)--B=(4;0)--C=(0;3)--</code> cria o triângulo
            ABC. <code>--</code> liga pontos, e no fim fecha o contorno. <code>+(4;0)</code> e <code>+(3:90)</code> partem
            do ponto anterior. O ícone de ajuda ao lado da barra mostra tudo.
          </li>
          <li>
            <b>Seleção.</b> Clique nos objetos da prévia, ou arraste uma caixa em volta deles. A ordem importa: os
            números verdes mostram a ordem dos pontos selecionados. Arrastar com o botão do meio move a vista.
          </li>
          <li>
            <b>Construir.</b> Com pontos selecionados, use a barra acima da prévia: ligar pontos, marcar ângulo (A, B, C
            marca o ângulo em B), polígono e circunferência. Em Construções ficam ponto médio, altura, mediana,
            bissetriz, mediatriz e interseção. O que é construído acompanha os pontos quando você os move.
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
