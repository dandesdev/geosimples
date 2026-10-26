import { useEffect } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import type { ToolType } from '@/geometry/types';

const toolShortcuts: Record<string, ToolType> = {
  'v': 'select',
  'p': 'point',
  'l': 'line',
  'c': 'circle',
  'a': 'arc',
  'g': 'polygon',
};

export function useKeyboardShortcuts() {
  const {
    tool,
    setTool,
    toggleMultiSelect,
    undo,
    redo,
    selection,
    removeElements,
    resetView,
    zoom,
  } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      if (isMod) {
        if (e.key === 'z' && !isShift) {
          e.preventDefault();
          undo();
          return;
        }
        if ((e.key === 'z' && isShift) || e.key === 'y') {
          e.preventDefault();
          redo();
          return;
        }
        if (e.key === 's') {
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.type !== 'none') {
          e.preventDefault();
          removeElements(selection.ids);
        }
        return;
      }

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        zoom(1.2, centerX, centerY);
        return;
      }

      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        zoom(0.8, centerX, centerY);
        return;
      }

      if (e.key === '0') {
        e.preventDefault();
        resetView();
        return;
      }

      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMultiSelect();
        return;
      }

      const toolShortcut = toolShortcuts[e.key.toLowerCase()];
      if (toolShortcut && tool !== toolShortcut) {
        e.preventDefault();
        setTool(toolShortcut);
        return;
      }

      if (e.key === 'Escape') {
        useEditorStore.getState().clearSelection();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tool, toggleMultiSelect, selection, undo, redo, removeElements, setTool, zoom, resetView]);
}
