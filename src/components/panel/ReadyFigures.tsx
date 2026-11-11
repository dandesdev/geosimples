import { actions } from "@/lib/actions";
import { TEMPLATE_ITEMS } from "@/components/preview/circuitItems";

/**
 * Prontos: figures used often, ready to adjust. Each goes beside what is
 * already drawn. For now the ready-made circuits; the list grows later.
 */
export function ReadyFigures() {
  return (
    <section aria-label="Prontos" className="grid grid-cols-2 gap-1.5 p-2">
      {TEMPLATE_ITEMS.map((item) => (
        <button
          key={item.template}
          type="button"
          onClick={() => actions.circuitTemplate(item.template)}
          className="flex items-start gap-2 rounded-lg border bg-card p-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-5 [&_svg]:w-5"
        >
          <span className="mt-0.5 shrink-0 text-primary">
            <item.Icon />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-medium leading-tight">{item.title}</span>
            <span className="text-xs text-muted-foreground">{item.hint}</span>
          </span>
        </button>
      ))}
    </section>
  );
}
