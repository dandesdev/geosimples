import { Hand, Move, SquareDashedMousePointer } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { useFigureStore, type CanvasMode } from "@/store/figureStore";

const MODES: { mode: CanvasMode; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    mode: "select",
    label: "Selecionar",
    hint: "V. Arraste para selecionar o que estiver dentro da caixa. Shift soma à seleção.",
    icon: <SquareDashedMousePointer />,
  },
  {
    mode: "pan",
    label: "Mover a vista",
    hint: "H. Arraste para deslocar a prévia.",
    icon: <Hand />,
  },
  {
    mode: "move",
    label: "Mover pontos",
    hint: "M. Arraste um ponto, ou vários selecionados, para mudá-los de lugar.",
    icon: <Move />,
  },
];

/** What dragging in the preview does. Clicking an object selects it in every mode. */
export function ModeSwitch() {
  const mode = useFigureStore((s) => s.mode);
  const setMode = useFigureStore((s) => s.setMode);
  return (
    <div role="group" aria-label="Ao arrastar na prévia" className="flex shrink-0 gap-0.5 rounded-md bg-muted/60 p-0.5">
      {MODES.map((m) => (
        <IconButton key={m.mode} label={m.label} hint={m.hint} active={mode === m.mode} onClick={() => setMode(m.mode)}>
          {m.icon}
        </IconButton>
      ))}
    </div>
  );
}
