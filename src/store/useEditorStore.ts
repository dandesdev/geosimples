import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  GeometryElement,
  CanvasState,
  TransformState,
  UserPreferences,
  PointID,
  ElementID,
  ToolType,
  Point,
  CoordinateSystemState,
} from "@/geometry/types";
import {
  DEFAULT_PREFERENCES,
  DEFAULT_TRANSFORM,
  EMPTY_SELECTION,
  DEFAULT_COORDINATE_SYSTEM,
} from "@/geometry/types";

interface EditorStore extends CanvasState {
  tool: ToolType;
  multiSelect: boolean;
  showBadges: boolean;
  isHoveringLineTool: boolean;
  isHoveringCircleTool: boolean; // For previewing creation from selection
  activeDragId: string | null;
  selectionOrder: ElementID[];
  coordinateSystem: CoordinateSystemState;
  history: {
    past: CanvasState[];
    present: CanvasState;
    future: CanvasState[];
  };
  setTool: (tool: ToolType) => void;
  toggleMultiSelect: () => void;
  toggleShowBadges: () => void;
  setIsHoveringLineTool: (hovering: boolean) => void;
  setIsHoveringCircleTool: (hovering: boolean) => void;
  setActiveDragId: (id: string | null) => void;
  updateElementPosition: (id: ElementID, x: number, y: number) => void;
  addElement: (element: GeometryElement) => void;
  updateElement: (id: ElementID, updates: Partial<GeometryElement>) => void;
  removeElement: (id: ElementID) => void;
  removeElements: (ids: ElementID[]) => void;
  select: (ids: ElementID[]) => void;
  selectSingle: (id: ElementID | null) => void;
  selectToggle: (id: ElementID) => void;
  clearSelection: () => void;
  setTransform: (transform: Partial<TransformState>) => void;
  zoom: (factor: number, centerX: number, centerY: number) => void;
  pan: (deltaX: number, deltaY: number) => void;
  resetView: () => void;
  setPreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
  toggleTheme: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  snapshotState: () => void;
  updateWorldOrigin: (canvasWidth: number, canvasHeight: number) => void;
}

const createInitialState = (): CanvasState => ({
  elements: [],
  selection: { ...EMPTY_SELECTION },
  transform: { ...DEFAULT_TRANSFORM },
  preferences: { ...DEFAULT_PREFERENCES },
});

function updateElementInArray(
  elements: GeometryElement[],
  id: ElementID,
  updates: Partial<GeometryElement>,
): GeometryElement[] {
  return elements.map((el) => {
    if (el.id !== id) return el;
    if (updates.type && updates.type !== el.type) return el;
    return { ...el, ...updates } as GeometryElement;
  });
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      tool: "select",
      multiSelect: false,
      showBadges: false,
      isHoveringLineTool: false,
      isHoveringCircleTool: false,
      activeDragId: null,
      selectionOrder: [],
      coordinateSystem: { ...DEFAULT_COORDINATE_SYSTEM },
      history: {
        past: [],
        present: createInitialState(),
        future: [],
      },

      setTool: (tool) => set({ tool }),

      toggleMultiSelect: () => {
        set((state) => ({
          multiSelect: !state.multiSelect,
          selection: { ...EMPTY_SELECTION },
          selectionOrder: [],
        }));
      },

      toggleShowBadges: () => {
        set((state) => ({
          showBadges: !state.showBadges,
        }));
      },

      setIsHoveringLineTool: (hovering) => {
        set({ isHoveringLineTool: hovering });
      },

      setIsHoveringCircleTool: (hovering) => {
        set({ isHoveringCircleTool: hovering });
      },

      setActiveDragId: (id) => {
        set({ activeDragId: id });
      },

      updateElementPosition: (id, x, y) => {
        set((state) => ({
          elements: state.elements.map((el) => {
            if (el.id === id && el.type === "point") {
              return { ...el, x, y } as GeometryElement;
            }
            return el;
          }),
        }));
        get().snapshotState();
      },

      addElement: (element) => {
        set((state) => ({
          elements: [...state.elements, element],
        }));
        get().snapshotState();
      },

      updateElement: (id, updates) => {
        set((state) => ({
          elements: updateElementInArray(state.elements, id, updates),
        }));
        get().snapshotState();
      },

      removeElement: (id) => {
        set((state) => ({
          elements: state.elements.filter((el) => el.id !== id),
          selection: {
            ...state.selection,
            ids: state.selection.ids.filter((selId) => selId !== id),
          },
          selectionOrder: state.selectionOrder.filter((selId) => selId !== id),
        }));
        get().snapshotState();
      },

      removeElements: (ids) => {
        set((state) => {
          const idSet = new Set(ids);
          return {
            elements: state.elements.filter((el) => !idSet.has(el.id)),
            selection: {
              ...state.selection,
              ids: state.selection.ids.filter((selId) => !idSet.has(selId)),
            },
            selectionOrder: state.selectionOrder.filter(
              (selId) => !idSet.has(selId),
            ),
          };
        });
        get().snapshotState();
      },

      select: (ids) => {
        const { elements } = get();
        // selectionOrder should only contain points (for geometry construction)
        const pointIds = ids.filter(
          (id) => elements.find((el) => el.id === id)?.type === "point",
        );

        set({
          selection: {
            type:
              ids.length === 0
                ? "none"
                : ids.length === 1
                  ? "single"
                  : "multiple",
            ids,
          },
          selectionOrder: pointIds,
        });
      },

      selectSingle: (id) => {
        const { elements } = get();
        const isPoint =
          id && elements.find((el) => el.id === id)?.type === "point";

        set({
          selection: {
            type: id === null ? "none" : "single",
            ids: id === null ? [] : [id],
          },
          selectionOrder: isPoint && id ? [id] : [],
        });
      },

      selectToggle: (id) => {
        const { selection, selectionOrder, elements } = get();
        const isSelected = selection.ids.includes(id);
        const isPoint = elements.find((el) => el.id === id)?.type === "point";

        if (isSelected) {
          const newIds = selection.ids.filter((selId) => selId !== id);
          const newOrder = selectionOrder.filter((selId) => selId !== id);
          set({
            selection: {
              type:
                newIds.length === 0
                  ? "none"
                  : newIds.length === 1
                    ? "single"
                    : "multiple",
              ids: newIds,
            },
            selectionOrder: newOrder,
          });
        } else {
          const newIds = [...selection.ids, id];
          // Only add to order if it is a point
          const newOrder = isPoint ? [...selectionOrder, id] : selectionOrder;
          set({
            selection: {
              type: newIds.length === 1 ? "single" : "multiple",
              ids: newIds,
            },
            selectionOrder: newOrder,
          });
        }
      },

      clearSelection: () => {
        set({ selection: { ...EMPTY_SELECTION }, selectionOrder: [] });
      },

      setTransform: (transform) => {
        set((state) => ({
          transform: { ...state.transform, ...transform },
        }));
      },

      zoom: (factor, centerX, centerY) => {
        const { transform } = get();
        const newScale = Math.min(Math.max(transform.scale * factor, 0.1), 10);
        const scaleRatio = newScale / transform.scale;
        const newOffsetX = centerX - (centerX - transform.offsetX) * scaleRatio;
        const newOffsetY = centerY - (centerY - transform.offsetY) * scaleRatio;
        set({
          transform: {
            scale: newScale,
            offsetX: newOffsetX,
            offsetY: newOffsetY,
          },
        });
      },

      pan: (deltaX, deltaY) => {
        set((state) => ({
          transform: {
            ...state.transform,
            offsetX: state.transform.offsetX + deltaX,
            offsetY: state.transform.offsetY + deltaY,
          },
        }));
      },

      resetView: () => {
        set({ transform: { ...DEFAULT_TRANSFORM } });
      },

      setPreference: (key, value) => {
        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        }));
      },

      toggleTheme: () => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            theme: state.preferences.theme === "light" ? "dark" : "light",
          },
        }));
      },

      snapshotState: () => {
        const { elements, selection, transform, preferences, history } = get();
        const currentState: CanvasState = {
          elements: JSON.parse(JSON.stringify(elements)),
          selection: { ...selection },
          transform: { ...transform },
          preferences: { ...preferences },
        };
        set({
          history: {
            past: [...history.past.slice(-49), history.present],
            present: currentState,
            future: [],
          },
        });
      },

      undo: () => {
        const { history } = get();
        if (history.past.length === 0) return;
        const previous = history.past[history.past.length - 1];
        set({
          elements: JSON.parse(JSON.stringify(previous.elements)),
          selection: { ...previous.selection },
          transform: { ...previous.transform },
          preferences: { ...previous.preferences },
          history: {
            past: history.past.slice(0, -1),
            present: previous,
            future: [history.present, ...history.future],
          },
        });
      },

      redo: () => {
        const { history } = get();
        if (history.future.length === 0) return;
        const next = history.future[0];
        set({
          elements: JSON.parse(JSON.stringify(next.elements)),
          selection: { ...next.selection },
          transform: { ...next.transform },
          preferences: { ...next.preferences },
          history: {
            past: [...history.past, history.present],
            present: next,
            future: history.future.slice(1),
          },
        });
      },

      reset: () => {
        set({
          ...createInitialState(),
          history: { past: [], present: createInitialState(), future: [] },
          multiSelect: false,
          showBadges: false,
          isHoveringLineTool: false,
          activeDragId: null,
          selectionOrder: [],
          coordinateSystem: { ...DEFAULT_COORDINATE_SYSTEM },
        });
      },

      updateWorldOrigin: (canvasWidth, canvasHeight) => {
        set((state) => ({
          coordinateSystem: {
            ...state.coordinateSystem,
            worldOrigin: {
              x: canvasWidth * 0.25,
              y: canvasHeight * 0.75,
            },
          },
        }));
      },
    }),
    {
      name: "geosimples-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        elements: state.elements,
        transform: state.transform,
        preferences: state.preferences,
      }),
    },
  ),
);

export const getPointById = (
  store: EditorStore,
  id: PointID,
): Point | undefined => {
  return store.elements.find(
    (el): el is Point => el.type === "point" && el.id === id,
  );
};

export const getSelectionOrderIndex = (
  store: EditorStore,
  id: ElementID,
): number => {
  return store.selectionOrder.indexOf(id);
};
