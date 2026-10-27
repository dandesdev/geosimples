import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** A "?" button that opens a longer explanation on click or tap, so the layout only shows short labels. */
export function HelpTip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          className,
        )}
      >
        <CircleHelp className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent collisionPadding={8} className="max-w-[min(20rem,calc(100vw-1rem))] p-3 text-xs leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}
