import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  isActive: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  size?: "default" | "small";
}

/**
 * Shared tool button wrapper with tooltip and active state styling.
 * Used by both main toolbar and utility toolbar.
 */
export function ToolButton({
  icon,
  label,
  shortcut,
  isActive,
  onClick,
  onMouseEnter,
  onMouseLeave,
  size = "default",
}: ToolButtonProps) {
  const sizeClasses = size === "small" ? "w-9 h-9" : "w-10 h-10";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={clsx(
              sizeClasses,
              "hover:bg-muted/80 rounded-sm",
              isActive &&
                "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          <span>{label}</span>
          <Kbd>{shortcut}</Kbd>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
