import { useCallback, useRef, useEffect, useSyncExternalStore } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import type { Point } from "@/geometry/types";
import { snapToWorldGrid } from "@/utils/geometry/coordinate";

export interface DragState {
  isDragging: boolean;
  elementIds: string[]; // Supports multiple elements
  startPositions: Map<string, { x: number; y: number }>; // Start position for each element
  currentDelta: { x: number; y: number } | null;
}

export interface UseSvgDragOptions {
  svgRef: React.RefObject<SVGSVGElement | null>;
  enabled?: boolean;
  onDragEnd?: (updates: Array<{ id: string; x: number; y: number }>) => void;
}

const EMPTY_DRAG_STATE: DragState = {
  isDragging: false,
  elementIds: [],
  startPositions: new Map(),
  currentDelta: null,
};

/**
 * Refs-based drag state manager
 *
 * Instead of using useState (which triggers re-renders on every mouse move),
 * we store state in a ref and use a subscription pattern. This allows
 * GhostRenderer to update without triggering parent re-renders.
 */
function createDragStore() {
  let state: DragState = EMPTY_DRAG_STATE;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (newState: DragState) => {
      state = newState;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// Global drag store instance
const dragStore = createDragStore();

/**
 * Hook to subscribe to drag state changes
 * Uses useSyncExternalStore for React 18 compatibility
 */
export function useDragState(): DragState {
  return useSyncExternalStore(
    dragStore.subscribe,
    dragStore.getState,
    dragStore.getState,
  );
}

export function useSvgDrag({
  svgRef: _svgRef,
  enabled = true,
  onDragEnd,
}: UseSvgDragOptions) {
  const transform = useEditorStore((s) => s.transform);
  const coordinateSystem = useEditorStore((s) => s.coordinateSystem);
  const preferences = useEditorStore((s) => s.preferences);
  const elements = useEditorStore((s) => s.elements);
  const selection = useEditorStore((s) => s.selection);

  // Store initial mouse position when drag starts
  const dragStartMousePos = useRef<{ x: number; y: number } | null>(null);

  // Track isDragging locally to trigger effect (without full state subscription)
  const isDraggingRef = useRef(false);

  // RAF throttling for smooth 60fps updates
  const rafId = useRef<number | null>(null);
  const pendingDelta = useRef<{ x: number; y: number } | null>(null);

  // Store stable references to avoid effect dependency issues
  const transformRef = useRef(transform);
  const coordinateSystemRef = useRef(coordinateSystem);
  const preferencesRef = useRef(preferences);
  const onDragEndRef = useRef(onDragEnd);

  // Update refs when values change
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);
  useEffect(() => {
    coordinateSystemRef.current = coordinateSystem;
  }, [coordinateSystem]);
  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);
  useEffect(() => {
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      if (!enabled) return;

      e.preventDefault();
      e.stopPropagation();

      // Get the clicked element
      const clickedPoint = elements.find(
        (el) => el.id === elementId && el.type === "point",
      ) as Point | undefined;
      if (!clickedPoint) return;

      // Only allow drag if the element is already selected
      const isClickedSelected = selection.ids.includes(elementId);
      if (!isClickedSelected) return;

      // Determine which elements to drag
      const elementsToDrag =
        selection.ids.length > 1 ? selection.ids : [elementId];

      // Build start positions map
      const startPositions = new Map<string, { x: number; y: number }>();
      for (const id of elementsToDrag) {
        const point = elements.find(
          (el) => el.id === id && el.type === "point",
        ) as Point | undefined;
        if (point) {
          startPositions.set(id, { x: point.x, y: point.y });
        }
      }

      dragStartMousePos.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = true;

      dragStore.setState({
        isDragging: true,
        elementIds: elementsToDrag,
        startPositions,
        currentDelta: { x: 0, y: 0 },
      });

      // Attach listeners immediately on mousedown
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [enabled, elements, selection.ids],
  );

  // Use stable handler that reads from refs
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const state = dragStore.getState();
    if (!state.isDragging || !dragStartMousePos.current) return;

    const currentTransform = transformRef.current;
    const currentCoordSystem = coordinateSystemRef.current;

    // Calculate delta in screen pixels, then convert to world units
    const screenDeltaX =
      (e.clientX - dragStartMousePos.current.x) / currentTransform.scale;
    const screenDeltaY =
      (e.clientY - dragStartMousePos.current.y) / currentTransform.scale;

    // Convert screen delta to world delta (divide by pixelsPerUnit, flip Y)
    const worldDeltaX = screenDeltaX / currentCoordSystem.pixelsPerUnit;
    const worldDeltaY = -screenDeltaY / currentCoordSystem.pixelsPerUnit;

    // Store pending delta and schedule RAF if not already scheduled
    pendingDelta.current = { x: worldDeltaX, y: worldDeltaY };
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(processDelta);
    }
  }, []);

  // Process pending delta in next animation frame
  const processDelta = useCallback(() => {
    if (pendingDelta.current) {
      const state = dragStore.getState();
      if (state.isDragging) {
        dragStore.setState({
          ...state,
          currentDelta: pendingDelta.current,
        });
      }
      pendingDelta.current = null;
    }
    rafId.current = null;
  }, []);

  const handleMouseUp = useCallback(
    (_e: MouseEvent) => {
      // Cancel any pending RAF
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }

      // Remove listeners first
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      const state = dragStore.getState();
      if (
        !state.isDragging ||
        state.elementIds.length === 0 ||
        !state.currentDelta
      ) {
        isDraggingRef.current = false;
        dragStore.setState(EMPTY_DRAG_STATE);
        return;
      }

      const currentPrefs = preferencesRef.current;

      // Build updates for all dragged elements
      const updates: Array<{ id: string; x: number; y: number }> = [];

      for (const id of state.elementIds) {
        const startPos = state.startPositions.get(id);
        if (!startPos) continue;

        let newX = startPos.x + state.currentDelta.x;
        let newY = startPos.y + state.currentDelta.y;

        // Only snap to world grid for single element drag
        if (currentPrefs.snapToGrid && state.elementIds.length === 1) {
          const snapped = snapToWorldGrid(
            { x: newX, y: newY },
            currentPrefs.grid.spacing,
          );
          newX = snapped.x;
          newY = snapped.y;
        }

        updates.push({ id, x: newX, y: newY });
      }

      onDragEndRef.current?.(updates);

      dragStartMousePos.current = null;
      isDraggingRef.current = false;
      dragStore.setState(EMPTY_DRAG_STATE);
    },
    [handleMouseMove],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [handleMouseMove, handleMouseUp]);

  // Subscribe to drag state for return value only (not for triggering effects)
  const dragState = useDragState();

  return {
    dragState,
    handleMouseDown,
  };
}
