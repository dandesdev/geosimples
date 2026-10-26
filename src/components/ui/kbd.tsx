import * as React from "react";
import { cn } from "@/lib/utils";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/**
 * Keyboard key indicator component for displaying keyboard shortcuts.
 * Styled to look like a physical keyboard key.
 */
const Kbd = React.forwardRef<HTMLElement, KbdProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <kbd
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center",
          "h-5 min-w-5 px-1.5",
          "text-[10px] font-medium font-mono",
          "bg-muted text-muted-foreground",
          "border border-border rounded",
          "shadow-[0_1px_0_1px_hsl(var(--border))]",
          className,
        )}
        {...props}
      >
        {children}
      </kbd>
    );
  },
);
Kbd.displayName = "Kbd";

export { Kbd };
