import { useRef } from "react";
import { CheckCheck, Hand, Move, SquareDashedMousePointer } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { AddPointIcon, QuickFigureIcon } from "@/components/icons";
import { useFigureStore, type CanvasMode } from "@/store/figureStore";
import type { ActionId } from "@/store/prefsStore";
import { useActivePrefs } from "@/store/useActivePrefs";

/** How long Adicionar pontos is held to switch to Figura rápida. */
const HOLD_MS = 500;

const MODES: { mode: CanvasMode; action: ActionId; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    mode: "select",
    action: "modeSelect",
    label: "Selecionar",
    hint: "Arraste para selecionar o que estiver dentro da caixa. Shift soma à seleção.",
    icon: <SquareDashedMousePointer />,
  },
  {
    mode: "pan",
    action: "modePan",
    label: "Mover a vista",
    hint: "Arraste para deslocar a prévia.",
    icon: <Hand />,
  },
  {
    mode: "move",
    action: "modeMove",
    label: "Mover pontos",
    hint: "Arraste um ponto, ou vários selecionados, para mudá-los de lugar.",
    icon: <Move />,
  },
  {
    mode: "add",
    action: "modeAdd",
    label: "Adicionar pontos",
    hint: "Clique na prévia para criar um ponto ali. Segure o botão para Figura rápida.",
    icon: <AddPointIcon />,
  },
  {
    mode: "figure",
    action: "modeFigure",
    label: "Figura rápida",
    hint: "Cada clique põe um vértice ligado ao anterior; o terceiro fecha o polígono, com preenchimento e ângulos.",
    icon: <QuickFigureIcon />,
  },
];

/**
 * What pressing and dragging in the preview does, and whether clicks add to
 * the selection. Figura rápida shows when the profile turns it on, or while
 * it is in use after holding Adicionar pontos.
 */
export function ModeSwitch() {
  const mode = useFigureStore((s) => s.mode);
  const setMode = useFigureStore((s) => s.setMode);
  const multiSelect = useFigureStore((s) => s.multiSelect);
  const setMultiSelect = useFigureStore((s) => s.setMultiSelect);
  const quickFigure = useActivePrefs().behavior.quickFigure;
  const hold = useRef<{ timer?: number; fired: boolean }>({ fired: false });

  const startHold = (e: React.PointerEvent) => {
    hold.current.fired = false;
    if (e.button !== 0) return;
    window.clearTimeout(hold.current.timer);
    hold.current.timer = window.setTimeout(() => {
      hold.current.fired = true;
      setMode("figure");
    }, HOLD_MS);
  };
  const endHold = () => window.clearTimeout(hold.current.timer);

  const shown = MODES.filter((m) => m.mode !== "figure" || quickFigure || mode === "figure");
  return (
    <>
      <div role="group" aria-label="Ao clicar ou arrastar na prévia" className="flex shrink-0 gap-0.5 rounded-md bg-muted/60 p-0.5">
        {shown.map((m) => (
          <IconButton
            key={m.mode}
            label={m.label}
            hint={m.hint}
            shortcut={m.action}
            active={mode === m.mode}
            onClick={(e) => {
              // The click that ends a hold already switched to Figura rápida.
              // Keyboard clicks (detail 0) never come from a hold.
              if (m.mode === "add" && hold.current.fired && e.detail !== 0) {
                hold.current.fired = false;
                return;
              }
              setMode(m.mode);
            }}
            {...(m.mode === "add" && {
              onPointerDown: startHold,
              onPointerUp: endHold,
              onPointerLeave: endHold,
              onPointerCancel: endHold,
              // A long press on a phone would open the browser's menu.
              onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
            })}
          >
            {m.icon}
          </IconButton>
        ))}
      </div>
      <IconButton
        label="Seleção múltipla"
        hint="Cliques e toques somam à seleção em vez de trocá-la, como segurar Shift."
        shortcut="toggleMultiSelect"
        active={multiSelect}
        onClick={() => setMultiSelect(!multiSelect)}
      >
        <CheckCheck />
      </IconButton>
    </>
  );
}
