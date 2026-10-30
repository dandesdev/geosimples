import { normalizeDoc } from "./normalize";
import type { FigureDoc } from "./types";

/** A figure with its name, as saved to a file or carried by a share link. */
export interface FigureFile {
  name: string;
  doc: FigureDoc;
}

export type ParsedFigure =
  | { ok: true; file: FigureFile; /** Elements that were invalid and left out. */ dropped: number }
  | { ok: false; error: string };

export const FIGURE_FILE_KIND = "geosimples-figure";
export const FIGURE_FILE_EXTENSION = ".geosimples.json";
export const FIGURE_NAME_MAX = 80;
/** Hash parameter of share links: `#figura=<token>`. */
export const SHARE_HASH_PARAM = "figura";
/** Links longer than this get cut by some mail and chat apps. */
export const SHARE_LINK_WARN_LENGTH = 8000;

/** Limits for data from outside, so a crafted file or link can't freeze the page. */
const MAX_TOKEN_LENGTH = 1_000_000;
const MAX_INFLATED_BYTES = 8_000_000;

type Raw = Record<string, unknown>;
const isObj = (x: unknown): x is Raw => typeof x === "object" && x !== null && !Array.isArray(x);

/** One line, no control characters, at most FIGURE_NAME_MAX long. Empty names become `fallback`. */
export function cleanFigureName(name: unknown, fallback: string): string {
  if (typeof name !== "string") return fallback;
  // eslint-disable-next-line no-control-regex
  const clean = name.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, FIGURE_NAME_MAX).trim();
  return clean === "" ? fallback : clean;
}

function fileObject(file: FigureFile) {
  return { kind: FIGURE_FILE_KIND, version: 1, name: file.name, doc: file.doc };
}

/** The contents of a `.geosimples.json` file. */
export function figureFileText(file: FigureFile): string {
  return JSON.stringify(fileObject(file), null, 2) + "\n";
}

/**
 * Reads figure data from outside: a figure file or a bare FigureDoc. The doc
 * goes through normalizeDoc, so whatever opens is a valid figure.
 */
export function readFigureData(data: unknown, fallbackName: string): ParsedFigure {
  const wrapped = isObj(data) && data.kind === FIGURE_FILE_KIND;
  const raw = wrapped ? data.doc : data;
  if (!isObj(raw) || !Array.isArray(raw.elements)) {
    return { ok: false, error: "Não é uma figura do GeoSimples." };
  }
  const doc = normalizeDoc(raw);
  const name = cleanFigureName(wrapped ? data.name : undefined, fallbackName);
  return { ok: true, file: { name, doc }, dropped: Math.max(0, raw.elements.length - doc.elements.length) };
}

export function parseFigureFile(text: string, fallbackName: string): ParsedFigure {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "O arquivo não é uma figura do GeoSimples." };
  }
  return readFigureData(data, fallbackName);
}

/** A download name for the figure, without characters that file systems reject. */
export function figureFileName(name: string): string {
  const base = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 60)
    .trim();
  return (base === "" ? "figura" : base) + FIGURE_FILE_EXTENSION;
}

/** "Triângulo.geosimples.json" → "Triângulo". */
export function nameFromFileName(fileName: string): string {
  return fileName.replace(/\.geosimples\.json$/i, "").replace(/\.json$/i, "");
}

// --- Share links ---------------------------------------------------------

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const DECODE = new Map([...ALPHABET].map((c, i) => [c, i]));

/** Base64url without padding, safe in a URL hash as is. */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 4) / 3));
    for (let j = 0; j < chars; j++) out += ALPHABET[(n >> (18 - 6 * j)) & 63];
  }
  return out;
}

/** Null when the text has characters outside base64url or an impossible length. */
export function base64UrlToBytes(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    let n = 0;
    const chunk = text.slice(i, i + 4);
    for (let j = 0; j < 4; j++) {
      const v = j < chunk.length ? DECODE.get(chunk[j]) : 0;
      if (v === undefined) return null;
      n = (n << 6) | v;
    }
    for (let j = 0; j < chunk.length - 1; j++) out[o++] = (n >> (16 - 8 * j)) & 255;
  }
  return out;
}

interface StreamReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  cancel(): Promise<void>;
}
interface ByteTransform {
  readable: { getReader(): StreamReader };
  writable: { getWriter(): { write(chunk: Uint8Array): Promise<void>; close(): Promise<void> } };
}
/**
 * Web platform APIs that browsers and Node 18+ both have. Core has no DOM
 * types, so they are reached through globalThis with just the shape used here.
 */
interface WebApis {
  CompressionStream: new (format: "deflate-raw") => ByteTransform;
  DecompressionStream: new (format: "deflate-raw") => ByteTransform;
  TextEncoder: new () => { encode(text: string): Uint8Array };
  TextDecoder: new (label: string, options: { fatal: boolean }) => { decode(bytes: Uint8Array): string };
}
const web = () => globalThis as unknown as WebApis;

/** Runs bytes through a compression stream, stopping once the output passes `limit`. */
async function transform(stream: ByteTransform, input: Uint8Array, limit: number): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const writing = writer.write(input).then(() => writer.close());
  // A failure also shows up on the reading side, which reports it.
  writing.catch(() => {});
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.length;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      throw new Error("Output too large");
    }
    chunks.push(value);
  }
  await writing;
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** The part of a share link after `#figura=`: the figure file, deflated and in base64url. */
export async function encodeShareToken(file: FigureFile): Promise<string> {
  const { CompressionStream, TextEncoder } = web();
  const bytes = new TextEncoder().encode(JSON.stringify(fileObject(file)));
  return bytesToBase64Url(await transform(new CompressionStream("deflate-raw"), bytes, Infinity));
}

export async function decodeShareToken(token: string, fallbackName: string): Promise<ParsedFigure> {
  const broken = { ok: false, error: "O link está incompleto ou danificado." } as const;
  if (token.length > MAX_TOKEN_LENGTH) return broken;
  const bytes = base64UrlToBytes(token);
  if (!bytes || bytes.length === 0) return broken;
  const { DecompressionStream, TextDecoder } = web();
  let text: string;
  try {
    const inflated = await transform(new DecompressionStream("deflate-raw"), bytes, MAX_INFLATED_BYTES);
    text = new TextDecoder("utf-8", { fatal: true }).decode(inflated);
  } catch {
    return broken;
  }
  const parsed = parseFigureFile(text, fallbackName);
  return parsed.ok ? parsed : broken;
}

/** The share token in a URL hash like `#figura=…`, or null. */
export function shareTokenFromHash(hash: string): string | null {
  const prefix = `${SHARE_HASH_PARAM}=`;
  const part = hash
    .replace(/^#/, "")
    .split("&")
    .find((p) => p.startsWith(prefix));
  const token = part?.slice(prefix.length).trim();
  return token ? token : null;
}

/** `pageUrl` with its hash replaced by the share token. */
export function shareUrl(pageUrl: string, token: string): string {
  return `${pageUrl.replace(/#.*$/, "")}#${SHARE_HASH_PARAM}=${token}`;
}
