import { paperColor, toSvg, toTikz, type FigureDoc, type Paper } from "@geosimples/core/figure";

export interface ExportSettings {
  scale: number;
  dpi: number;
  /** "white" is the paper's color: gray when the export keeps the dark theme's colors. */
  background: "white" | "transparent";
  paper: Paper;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function svgText(doc: FigureDoc, { scale, background, paper }: Omit<ExportSettings, "dpi">): string {
  return toSvg(doc, { scale, paper, background: background === "white" ? paperColor(paper) : null });
}

export function tikzText(doc: FigureDoc, scale: number): string {
  return toTikz(doc, { scale });
}

/** Size of the SVG in pt, read from its width and height attributes. */
function svgSizePt(svg: string): { w: number; h: number } {
  const w = Number(/width="([\d.]+)pt"/.exec(svg)?.[1] ?? 100);
  const h = Number(/height="([\d.]+)pt"/.exec(svg)?.[1] ?? 100);
  return { w, h };
}

/** Largest side of a PNG, so a huge figure can't exhaust the browser's memory. */
const MAX_PNG_SIDE = 8000;

/** Renders the SVG to a PNG at the given resolution. */
export async function pngBlob(doc: FigureDoc, s: ExportSettings): Promise<Blob> {
  const svg = svgText(doc, s);
  const { w, h } = svgSizePt(svg);
  let factor = s.dpi / 72;
  factor = Math.min(factor, MAX_PNG_SIDE / Math.max(w, h, 1));
  const width = Math.max(1, Math.round(w * factor));
  const height = Math.max(1, Math.round(h * factor));
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar PNG"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function canCopyImage(): boolean {
  return typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;
}

/** Copies the figure as an image, ready to paste into Word or Google Docs. */
export async function copyPng(doc: FigureDoc, s: ExportSettings): Promise<void> {
  // Passing a promise keeps Safari's user-gesture requirement satisfied.
  await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob(doc, s) })]);
}
