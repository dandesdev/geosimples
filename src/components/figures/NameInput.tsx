import { useRef, type Ref } from "react";
import { FIGURE_NAME_MAX } from "@geosimples/core/figure";
import { cn } from "@/lib/utils";

/**
 * A figure name that edits in place. Enter or leaving the field saves,
 * Escape restores the name. `onDone` gets null when nothing should change.
 */
export function NameInput({
  name,
  onDone,
  className,
  ref,
}: {
  name: string;
  onDone: (name: string | null) => void;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}) {
  const cancelled = useRef(false);
  return (
    <input
      defaultValue={name}
      maxLength={FIGURE_NAME_MAX}
      ref={ref}
      aria-label="Nome da figura"
      spellCheck={false}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          // Escape only leaves the field; it must not close a dialog around it.
          e.preventDefault();
          e.stopPropagation();
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        const value = e.currentTarget.value.trim();
        const keep = cancelled.current || value === "" || value === name;
        cancelled.current = false;
        if (keep) e.currentTarget.value = name;
        onDone(keep ? null : value);
      }}
      className={cn(
        "h-8 w-full min-w-0 rounded-md bg-transparent px-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    />
  );
}
