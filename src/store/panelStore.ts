import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** The tabs of the tools panel, one per kind of figure. */
export type AreaId = "geometry" | "graphs" | "vectors" | "sets" | "circuits" | "boards";
/** The tabs of the editing panel. */
export type EditTab = "properties" | "formatting" | "labels";

interface PanelState {
  /** The tools panel's tab in view. */
  area: AreaId;
  setArea: (area: AreaId) => void;
  /** The editing panel's tab in view. */
  editTab: EditTab;
  setEditTab: (tab: EditTab) => void;
  /** Phones: the hint under the modes is folded away for room. */
  hintsHidden: boolean;
  setHintsHidden: (hidden: boolean) => void;
  /** Phones: the preview's height as a share of the screen, as dragged; null for the usual one. */
  phonePreview: number | null;
  setPhonePreview: (share: number | null) => void;
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
      area: "geometry",
      setArea: (area) => set({ area }),
      editTab: "properties",
      setEditTab: (editTab) => set({ editTab }),
      hintsHidden: false,
      setHintsHidden: (hintsHidden) => set({ hintsHidden }),
      phonePreview: null,
      setPhonePreview: (phonePreview) => set({ phonePreview }),
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
      partialize: (s) => ({
        open: s.open,
        closed: s.closed,
        welcomeHidden: s.welcomeHidden,
        area: s.area,
        editTab: s.editTab,
        hintsHidden: s.hintsHidden,
        phonePreview: s.phonePreview,
      }),
    },
  ),
);
