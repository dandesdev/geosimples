import { useEffect } from 'react';
import { Header } from '@/components/header';
import { Toolbar } from '@/components/toolbar';
import { UtilityToolbar } from '@/components/toolbar/UtilityToolbar';
import { PropertiesPanel } from '@/components/properties';
import { GeometryCanvas, PaperBackground } from '@/components/canvas';
import { useKeyboardShortcuts } from '@/hooks';
import { useEditorStore } from '@/store/useEditorStore';
import { Toaster } from '@/components/ui/sonner';

function App() {
  const preferences = useEditorStore((state) => state.preferences);
  useKeyboardShortcuts();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', preferences.theme === 'dark');
  }, [preferences.theme]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <PaperBackground />
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Toolbar />
        <GeometryCanvas />
        <UtilityToolbar />
        <PropertiesPanel />
      </div>
      <Toaster />
    </div>
  );
}

export default App;
