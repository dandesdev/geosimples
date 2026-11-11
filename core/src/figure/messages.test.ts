import { describe, expect, it } from "vitest";
import constructions from "./constructions.ts?raw";
import file from "./file.ts?raw";
import graphOps from "./graphOps.ts?raw";
import { addPoints, connectPoints, LIMIT_ERROR, makeIntersection } from "./index";
import { hasTranslation, translate } from "./messages";
import normalize from "./normalize.ts?raw";
import ops from "./ops.ts?raw";
import parse from "./parse.ts?raw";
import vectorOps from "./vectorOps.ts?raw";
import sets from "./sets.ts?raw";
import setOps from "./setOps.ts?raw";
import boardOps from "./boardOps.ts?raw";
import boardIndex from "./board/index.ts?raw";
import boardArithmetic from "./board/arithmetic.ts?raw";
import boardLine from "./board/number-line.ts?raw";
import boardRelation from "./board/relation.ts?raw";
import circuit from "./circuit.ts?raw";
import circuitOps from "./circuitOps.ts?raw";
import { emptyDoc } from "./defaults";

/** Sentences in quotes: the messages the user or an agent reads. */
function messages(source: string): string[] {
  return [...source.matchAll(/"([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^"\n]*[.!?])"/g)].map((m) => m[1]);
}

describe("English messages", () => {
  const sources = { ops, constructions, graphOps, parse, file, normalize, vectorOps, sets, setOps, boardOps, boardIndex, boardArithmetic, boardLine, boardRelation, circuit, circuitOps };

  it("has every message of the operations, the input bar and files", () => {
    expect(messages(ops).length).toBeGreaterThan(30);
    const missing = Object.entries(sources).flatMap(([name, source]) =>
      messages(source)
        .filter((m) => !hasTranslation(m))
        .map((m) => `${name}: ${m}`),
    );
    expect(missing).toEqual([]);
  });

  it("translates messages with values in them", () => {
    expect(translate(LIMIT_ERROR, "en")).toMatch(/^The figure reached its limit of \d+ elements\.$/);
    expect(translate("f não está definida em x = 0,5.", "en")).toBe("f is not defined at x = 0,5.");
    expect(translate('Não há ponto chamado "Q". Para criar, use Q=(x;y).', "en")).toBe(
      'There is no point named "Q". To create it, use Q=(x;y).',
    );
  });

  it("returns an operation's error in either language", () => {
    const { doc, created } = addPoints(emptyDoc(), [{ x: 0, y: 0 }]);
    const r = connectPoints(doc, created, false);
    expect(r.error).toBe("Selecione ao menos dois pontos para ligar.");
    expect(translate(r.error!, "en")).toBe("Select at least two points to connect.");
    expect(translate(r.error!, "pt-BR")).toBe(r.error);
    expect(translate(makeIntersection(doc, []).error!, "en")).toMatch(/^Select two objects that cross/);
  });

  it("leaves unknown text alone", () => {
    expect(translate("Algo novo.", "en")).toBe("Algo novo.");
  });
});
