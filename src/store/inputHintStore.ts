import { create } from "zustand";

/**
 * A balloon over the input bar that says what to type there, set by a tool
 * that starts something typed (a function, a text). It goes when the input
 * loses the focus or the text is added.
 */
interface InputHintState {
  hint: string | null;
  setHint: (hint: string | null) => void;
}

export const useInputHint = create<InputHintState>()((set) => ({
  hint: null,
  setHint: (hint) => set({ hint }),
}));
