import { useCallback, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCommand } from "@/lib/commands";
import { useFigureStore } from "@/store/figureStore";
import { LazyExportDialog, LazyHelpDialog, LazySettingsDialog } from "./lazy";
import { MountOnFirstOpen } from "./MountOnFirstOpen";

/**
 * The app's dialogs, opened by commands, so any toolbar, menu or shortcut in
 * either layout can open them.
 */
export function AppDialogs() {
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  useCommand(
    "export",
    useCallback(() => {
      if (useFigureStore.getState().doc.elements.length > 0) setExportOpen(true);
    }, []),
  );
  useCommand("help", useCallback(() => setHelpOpen(true), []));
  useCommand("settings", useCallback(() => setSettingsOpen(true), []));
  useCommand(
    "confirmClear",
    useCallback(() => {
      if (useFigureStore.getState().doc.elements.length > 0) setConfirmClear(true);
    }, []),
  );

  return (
    <>
      <MountOnFirstOpen open={exportOpen}>
        <LazyExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      </MountOnFirstOpen>
      <MountOnFirstOpen open={helpOpen}>
        <LazyHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      </MountOnFirstOpen>
      <MountOnFirstOpen open={settingsOpen}>
        <LazySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </MountOnFirstOpen>
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar a figura inteira?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os pontos, segmentos e formas serão apagados. Dá para recuperar com Desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => useFigureStore.getState().clear()}>Apagar tudo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
