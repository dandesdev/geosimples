import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface PanelState {
  /** Open side panel groups: Propriedades, Formatação, Rótulos e textos. */
  open: string[];
  setOpen: (open: string[]) => void;
  /** Side panel sections the teacher closed, by title. They stay closed across selections and visits. */
  closed: Record<string, true>;
  toggle: (title: string) => void;
  /** The starting example was closed for this visit. */
  welcomeClosed: boolean;
  closeWelcome: () => void;
  /** The teacher asked not to see the starting example again. */
  welcomeHidden: boolean;
  setWelcomeHidden: (hidden: boolean) => void;
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
      welcomeClosed: false,
      closeWelcome: () => set({ welcomeClosed: true }),
      welcomeHidden: false,
      setWelcomeHidden: (welcomeHidden) => set({ welcomeHidden, welcomeClosed: false }),
    }),
    {
      name: "geosimples-panel",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Closing the card lasts for this visit; only "não mostrar mais" is remembered.
      partialize: (s) => ({ open: s.open, closed: s.closed, welcomeHidden: s.welcomeHidden }),
    },
  ),
);
