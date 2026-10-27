import { forwardRef, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ShortcutKeys } from "@/components/ShortcutKeys";
import type { ActionId } from "@/store/prefsStore";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  /** Extra tooltip text, like what the action does. */
  hint?: string;
  /** Shows the action's current keys from the active profile. */
  shortcut?: ActionId;
  active?: boolean;
  /**
   * Why the action can't run now. The button stays hoverable and focusable so
   * the reason can be read; clicking it shows the reason instead of acting.
   */
  unavailable?: string | null;
  /** Looks unavailable but still works, for menus whose options are all unavailable. */
  dimmed?: boolean;
  /** The action can run with the current selection: a small dot says so. */
  ready?: boolean;
  children: ReactNode;
}

/** A square toolbar button with a tooltip. The label doubles as its accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, hint, shortcut, active, unavailable, dimmed, ready, className, children, onClick, ...props },
  ref,
) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const explain = () => {
    setPinned(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPinned(false), 2500);
  };

  return (
    <Tooltip open={hovered || pinned} onOpenChange={setHovered}>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          aria-pressed={active}
          aria-disabled={unavailable ? true : undefined}
          className={cn(
            "relative grid h-9 w-9 shrink-0 place-items-center rounded-md text-foreground transition-colors hover:bg-muted hover:text-primary disabled:pointer-events-none disabled:opacity-35 [&_svg]:h-5 [&_svg]:w-5",
            active && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
            (unavailable || dimmed) && "text-muted-foreground/60 hover:text-muted-foreground",
            className,
          )}
          onClick={(e) => {
            if (unavailable) {
              e.preventDefault();
              explain();
              return;
            }
            onClick?.(e);
          }}
          {...props}
        >
          {children}
          {ready && !unavailable && (
            <span aria-hidden="true" className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        <p className="flex items-center gap-2 font-medium">
          {label}
          {shortcut && <ShortcutKeys action={shortcut} />}
        </p>
        {hint && <p className="opacity-90">{hint}</p>}
        {unavailable && (
          <p className="mt-1 flex gap-1.5 rounded bg-black/15 px-1.5 py-1">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{unavailable}</span>
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
});
