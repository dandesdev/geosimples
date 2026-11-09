import { boardError, MAX_BOARD_SOURCE } from "./board";
import { DEFAULT_STYLES, LIMITS } from "./defaults";
import { idMaker, LIMIT_ERROR, roomFor, withElements, type OpOptions, type OpResult } from "./ops";
import { buildScene } from "./render";
import type { Board, FigureDoc } from "./types";

/** Space in cm between a new board and what is above it. */
const GAP = 1;

/** Where a new board goes: under everything drawn, at the left edge of it. */
function spotBelow(doc: FigureDoc): { x: number; y: number } {
  const { box, kx, ky } = buildScene(doc);
  if (!box) return { x: 0, y: 0 };
  const round = (v: number) => Math.round(v * 100) / 100;
  return { x: round(box.minX / kx), y: round(-box.maxY / ky - GAP) };
}

/** Adds a worked layout from its text, like 1234÷5, mmc(12;18) or varal [1;3] ∩ ]2;5[. */
export function addBoard(doc: FigureDoc, source: string, opts: OpOptions = {}, at?: { x: number; y: number }): OpResult {
  const text = source.trim();
  const fail = (error: string): OpResult => ({ doc, created: [], error });
  if (text === "") return fail("Escreva a conta ou a tabela.");
  if (text.length > MAX_BOARD_SOURCE) return fail(`Use até ${MAX_BOARD_SOURCE} caracteres.`);
  const error = boardError(text, doc.locale);
  if (error) return fail(error);
  if (!roomFor(doc, 1)) return fail(LIMIT_ERROR);
  const styles = opts.styles ?? DEFAULT_STYLES;
  const spot = at ?? spotBelow(doc);
  if (Math.abs(spot.x) > LIMITS.coordinate || Math.abs(spot.y) > LIMITS.coordinate) return fail("A figura chegou ao limite de espaço.");
  const board: Board = {
    id: idMaker(doc)("board"),
    type: "board",
    x: spot.x,
    y: spot.y,
    source: text,
    show: "full",
    seed: 0,
    method: "long",
    places: 0,
    marks: true,
    size: 12,
    color: styles.label.color,
    width: 0.8,
    font: styles.label.font,
  };
  return { doc: withElements(doc, [...doc.elements, board]), created: [board.id] };
}
