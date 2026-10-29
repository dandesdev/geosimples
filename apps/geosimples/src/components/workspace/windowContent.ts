import type { ComponentType } from "react";
import type { WindowId } from "@/store/workspaceStore";
import { FigureWindow, FormattingWindow, LabelsWindow, PropertiesWindow } from "./WindowBodies";

/** What each window holds. Figura is one row, so it takes its own height in a dock. */
export const WINDOW_CONTENT: Record<WindowId, { fit: boolean; Body: ComponentType }> = {
  figure: { fit: true, Body: FigureWindow },
  properties: { fit: false, Body: PropertiesWindow },
  formatting: { fit: false, Body: FormattingWindow },
  labels: { fit: false, Body: LabelsWindow },
};
