import { createContext, useContext } from "react";

/**
 * Closes the phone's menu sheet. The sheet covers the whole screen, so what
 * a tap in it adds to the figure only shows once it is out of the way.
 * Null outside the sheet: on a wide screen the panel stays put.
 */
export const CloseMenuContext = createContext<(() => void) | null>(null);

export const useCloseMenu = () => useContext(CloseMenuContext);
