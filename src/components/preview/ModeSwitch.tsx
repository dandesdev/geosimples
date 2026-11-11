import { useRef } from "react";
import { CheckCheck } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { useFigureStore } from "@/store/figureStore";
import { useActivePrefs } from "@/store/useActivePrefs";
import { cn } from "@/lib/utils";
import { MODES } from "./tools";

/** How long Adicionar pontos is held to switch to Figura rápida. */
const HOLD_MS = 500;


/**
 * The phone layout's tiles: squares with the name under the icon, sharing the
 * row's width equally, up to a size where they stop growing taller.
 */
const TILE = "aspect-square h-auto max-h-16 min-w-0 flex-1 basis-0 px-0.5 text-[10px] tracking-tight [&_svg]:h-[18px] [&_svg]:w-[18px]";

/**
 * What pressing and dragging in the preview does, and whether clicks add to
 * the selection. Figura rápida shows when the profile turns it on, or while
 * it is in use after holding Adicionar pontos. `tiles`: the phone layout,
 * a row of small named squares.
 */
export function ModeSwitch({ vertical = false, tiles = false }: { vertical?: boolean; tiles?: boolean }) {
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
      <div
        role="group"
        aria-label="Ao clicar ou arrastar na prévia"
        className={cn(
          "flex gap-0.5",
          tiles ? "min-w-0 items-start gap-1" : "shrink-0 rounded-md bg-muted/60 p-0.5",
          vertical && "flex-col",
        )}
        // Tiles: one share of the row per mode, plus its own gaps, so each mode is exactly as wide as Vários.
        style={tiles ? { flex: `${shown.length} 1 ${(shown.length - 1) * 0.25}rem` } : undefined}
      >
        {shown.map((m) => (
          <IconButton
            key={m.mode}
            label={m.label}
            text={tiles ? m.short : undefined}
            className={tiles ? TILE : undefined}
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
            <m.Icon />
          </IconButton>
        ))}
      </div>
      {/* Vários isn't one of the modes: it adds to whichever is on. */}
      {tiles && <div aria-hidden="true" className="mx-0.5 w-px shrink-0 self-stretch rounded-full bg-border" />}
      <IconButton
        label="Seleção múltipla"
        hint="Cliques e toques somam à seleção em vez de trocá-la, como segurar Shift."
        shortcut="toggleMultiSelect"
        active={multiSelect}
        text={tiles ? "Vários" : undefined}
        className={tiles ? TILE : undefined}
        onClick={() => setMultiSelect(!multiSelect)}
      >
        <CheckCheck />
      </IconButton>
    </>
  );
}
