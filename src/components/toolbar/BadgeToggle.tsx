import { clsx } from "clsx";
import { Toggle } from "@/components/ui/toggle";
import { useEditorStore } from "@/store/useEditorStore";

/**
 * Toggle button for showing/hiding selection order badges on points.
 */
export function BadgeToggle() {
  const showBadges = useEditorStore((s) => s.showBadges);
  const toggleShowBadges = useEditorStore((s) => s.toggleShowBadges);

  return (
    <Toggle
      pressed={showBadges}
      onPressedChange={toggleShowBadges}
      className={clsx(
        "h-fit text-sm font-medium rounded-sm",
        showBadges
          ? "bg-muted text-muted-foreground ring-primary ring-2"
          : "bg-muted/95 text-muted-foreground hover:bg-muted/80",
      )}
      aria-label="Toggle badges"
    >
      123
    </Toggle>
  );
}
