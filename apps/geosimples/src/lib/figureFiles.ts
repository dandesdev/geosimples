import { toast } from "sonner";
import {
  encodeShareToken,
  FIGURE_FILE_EXTENSION,
  figureFileName,
  figureFileText,
  nameFromFileName,
  parseFigureFile,
  shareTokenFromHash,
  shareUrl,
  type FigureFile,
  type ParsedFigure,
} from "@geosimples/core/figure";
import { downloadBlob } from "@/lib/exporting";
import { useFigureStore } from "@/store/figureStore";

/** Bigger files are not figures this editor made. */
const MAX_FILE_BYTES = 5_000_000;

export function downloadFigureFile(file: FigureFile) {
  downloadBlob(new Blob([figureFileText(file)], { type: "application/json" }), figureFileName(file.name));
}

/** The open figure with its name. */
export function currentFigureFile(): FigureFile {
  const { doc, figures, figureId } = useFigureStore.getState();
  return { doc, name: figures.find((f) => f.id === figureId)?.name ?? "Figura" };
}

/** Adds a parsed figure to the library, opens it and says what happened. */
export function openParsedFigure(parsed: ParsedFigure, source: string) {
  if (!parsed.ok) {
    toast.error(`Não foi possível abrir ${source}.`, { description: parsed.error });
    return;
  }
  useFigureStore.getState().importFigure(parsed.file);
  const name = useFigureStore.getState().figures.find((f) => f.id === useFigureStore.getState().figureId)?.name;
  const dropped = parsed.dropped > 0 ? ` ${parsed.dropped} elemento(s) inválido(s) ficaram de fora.` : "";
  toast.success(`Figura “${name ?? parsed.file.name}” adicionada às suas figuras.${dropped}`);
}

export const isFigureFile = (file: File) => /\.json$/i.test(file.name) || file.type === "application/json";

/** Opens figure files, each as a new figure in the library. */
export async function openFigureFiles(files: File[]) {
  for (const file of files) {
    const source = `“${file.name}”`;
    if (!isFigureFile(file)) {
      toast.error(`Não foi possível abrir ${source}.`, {
        description: `Abra um arquivo ${FIGURE_FILE_EXTENSION} salvo pelo GeoSimples.`,
      });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`Não foi possível abrir ${source}.`, { description: "O arquivo é grande demais." });
      continue;
    }
    openParsedFigure(parseFigureFile(await file.text(), nameFromFileName(file.name)), source);
  }
}

/** Shows the system file picker for figure files. */
export function pickFigureFiles() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = `${FIGURE_FILE_EXTENSION},.json,application/json`;
  input.multiple = true;
  input.addEventListener("change", () => void openFigureFiles([...(input.files ?? [])]));
  input.click();
}

export async function figureShareUrl(file: FigureFile): Promise<string> {
  return shareUrl(window.location.href, await encodeShareToken(file));
}

/** Share links need CompressionStream: every current browser, but not very old ones. */
export const canShareLinks = () => typeof CompressionStream !== "undefined";

/** The share token in the address, removed so a reload doesn't ask again. */
export function takeSharedToken(): string | null {
  const token = shareTokenFromHash(window.location.hash);
  if (token) history.replaceState(history.state, "", window.location.pathname + window.location.search);
  return token;
}
