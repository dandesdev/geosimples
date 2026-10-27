import { toSvg, type FigureDoc } from "@geosimples/core/figure";
import { loadFigureDoc } from "@/store/figureStore";

/** A data URL of the figure on white, or null for an empty figure. Made on the fly, never stored. */
export function thumbnailUrl(doc: FigureDoc): string | null {
  if (doc.elements.length === 0) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toSvg(doc, { background: "#ffffff" }))}`;
}

const cache = new Map<string, string | null>();

/** Thumbnail of a stored figure, cached until it is edited again. */
export function storedThumbnail(id: string, updatedAt: number): string | null {
  const key = `${id}@${updatedAt}`;
  if (!cache.has(key)) cache.set(key, thumbnailUrl(loadFigureDoc(id)));
  return cache.get(key) ?? null;
}

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** "há 5 minutos", "ontem", "12/10/2026". */
export function editedAgo(at: number, now: number): string {
  const minutes = Math.round((now - at) / 60000);
  if (minutes < 1) return "agora há pouco";
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 7) return relative.format(-days, "day");
  return new Date(at).toLocaleDateString("pt-BR");
}
