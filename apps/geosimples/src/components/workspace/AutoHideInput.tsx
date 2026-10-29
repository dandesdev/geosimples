import { useState } from "react";
import { Keyboard, Pin, PinOff } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { PointInput } from "@/components/PointInput";
import { ShortcutKeys } from "@/components/ShortcutKeys";
import { emitCommand } from "@/lib/commands";
import { cn } from "@/lib/utils";
import { useFigureStore } from "@/store/figureStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

/**
 * The point input of the pro layout, over the bottom of the preview. It slides
 * away to leave the figure clear, and comes back when the pointer nears the
 * bottom (`near`), when it gets focus (the / key) or while it has text.
 * The pin keeps it in view.
 */
export function AutoHideInput({ near }: { near: boolean }) {
  const autoHide = useWorkspaceStore((s) => s.inputAutoHide);
  const setAutoHide = useWorkspaceStore((s) => s.setInputAutoHide);
  const typing = useFigureStore((s) => s.inputDraft.trim() !== "");
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const shown = !autoHide || near || hovered || focused || typing;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-16 pb-2">
      <div
        data-testid="point-input-dock"
        data-shown={shown}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
        className={cn(
          "w-full max-w-3xl transition-[translate,opacity] duration-200 ease-out",
          shown ? "pointer-events-auto translate-y-0 opacity-100" : "translate-y-[calc(100%+1rem)] opacity-0",
        )}
      >
        <PointInput
          floating
          extra={
            <IconButton
              label={autoHide ? "Fixar a barra de pontos" : "Esconder a barra de pontos sozinha"}
              hint={autoHide ? "Ela fica sempre à vista." : "Ela some até o mouse chegar à borda de baixo."}
              active={!autoHide}
              onClick={() => setAutoHide(!autoHide)}
              className="h-8 w-8 [&_svg]:h-4 [&_svg]:w-4"
            >
              {autoHide ? <Pin /> : <PinOff />}
            </IconButton>
          }
        />
      </div>
      {!shown && (
        <button
          type="button"
          onClick={() => emitCommand("focusInput")}
          className="pointer-events-auto absolute bottom-0 flex items-center gap-1.5 rounded-t-md border border-b-0 bg-card/95 px-2.5 py-0.5 text-xs text-muted-foreground shadow-sm hover:text-primary"
        >
          <Keyboard className="h-3.5 w-3.5" />
          Digitar pontos
          <ShortcutKeys action="focusInput" />
        </button>
      )}
    </div>
  );
}
