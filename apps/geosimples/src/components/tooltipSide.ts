import { createContext, useContext } from "react";

type Side = "top" | "right" | "bottom" | "left";

/** Which side of a toolbar button its tooltip opens on: the pro layout's tool column wants them to the right. */
export const TooltipSide = createContext<Side>("top");

export const useTooltipSide = () => useContext(TooltipSide);
