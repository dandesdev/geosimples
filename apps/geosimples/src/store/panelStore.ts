import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface PanelState {
  /** Open side panel groups: Propriedades, Formatação, Rótulos e textos. */
  open: string[];
  setOpen: (open: string[]) => void;
  /** Side panel sections the teacher closed, by title. They stay closed across selections and visits. */
  closed: Record<string, true>;
  toggle: (title: string) => void;
}

export const usePanelStore = create<PanelState>()(
  persist(
    (set) => ({
      open: ["properties", "formatting"],
      setOpen: (open) => set({ open }),
      closed: {},
      toggle: (title) =>
        set((s) => {
          const closed = { ...s.closed };
          if (closed[title]) delete closed[title];
          else closed[title] = true;
          return { closed };
        }),
    }),
    { name: "geosimples-panel", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);
