import { forwardRef, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  /** Extra tooltip text, like a shortcut or what needs to be selected. */
  hint?: string;
  active?: boolean;
  children: ReactNode;
}

/** A square toolbar button with a tooltip. The label doubles as its accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, hint, active, className, children, ...props },
  ref,
) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-md text-foreground transition-colors hover:bg-muted hover:text-primary disabled:pointer-events-none disabled:opacity-35 [&_svg]:h-5 [&_svg]:w-5",
            active && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        <p className="font-medium">{label}</p>
        {hint && <p className="opacity-90">{hint}</p>}
      </TooltipContent>
    </Tooltip>
  );
});
