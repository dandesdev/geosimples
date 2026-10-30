/**
 * Writes every fixture to fixtures/out as TikZ, a standalone .tex and SVG.
 * Run with `npm run fixtures`, then `npm run fixtures:compile` to build the PDFs.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";
import { buildScene, paddedBox, toSvg, toTikz } from "../src/figure/index";
import { FIXTURES } from "./figures";

const OUT = join(import.meta.dirname, "out");
/** Same margin as the SVG export, so both files cover the same area. */
const MARGIN = 6;

const n = (x: number) => String(Math.round(x * 1000) / 1000);

/** The packages the export asks for in its preamble comment. */
function preambleOf(tikz: string): string[] {
  const line = tikz.split("\n").find((l) => l.startsWith("% Preâmbulo:")) ?? "";
  return line.match(/\\[a-z]+(\[[^\]]*\])?\{[^}]*\}/gi) ?? [];
}

it("writes the export fixtures", () => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const preamble = new Set<string>();

  for (const { name, doc, scale } of FIXTURES) {
    const tikz = toTikz(doc, { scale });
    writeFileSync(join(OUT, `${name}.tikz`), tikz);
    writeFileSync(join(OUT, `${name}.svg`), toSvg(doc, { scale, margin: MARGIN }));
    for (const p of preambleOf(tikz)) preamble.add(p);

    // Pin the PDF page to the SVG viewBox so the two renderings line up pixel for pixel.
    const b = paddedBox(buildScene(doc, { scale }).box, MARGIN);
    const bbox = `\\useasboundingbox (${n(b.minX)}pt,${n(-b.maxY)}pt) rectangle (${n(b.maxX)}pt,${n(-b.minY)}pt);`;
    const picture = tikz.replace(/(\\begin\{tikzpicture\}[^\n]*\n)/, `$1${bbox}\n`);
    const tex = [
      "\\documentclass[border=0pt]{standalone}",
      ...preambleOf(tikz),
      "\\begin{document}",
      picture.trimEnd(),
      "\\end{document}",
      "",
    ].join("\n");
    writeFileSync(join(OUT, `${name}.tex`), tex);
  }

  // Every figure as pasted into a typical Brazilian document, with the natural bounding box.
  const all = [
    "\\documentclass{article}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage[brazil]{babel}",
    "\\usepackage[a4paper, margin=1cm]{geometry}",
    ...preamble,
    "\\begin{document}",
    ...FIXTURES.flatMap(({ name }) => [`\\section*{${name}}`, `\\input{${name}.tikz}`, ""]),
    "\\end{document}",
    "",
  ].join("\n");
  writeFileSync(join(OUT, "all.tex"), all);

  const rows = FIXTURES.map(
    ({ name }) =>
      `<h2>${name}</h2><div class="row">` +
      `<figure><img src="${name}.svg"><figcaption>SVG</figcaption></figure>` +
      `<figure><img class="png" src="${name}-pdf.png"><figcaption>PDF (LaTeX)</figcaption></figure>` +
      `<figure><img class="png" src="${name}-overlay.png"><figcaption>Sobreposição: vermelho = só PDF, azul = só SVG</figcaption></figure>` +
      `</div>`,
  ).join("\n");
  writeFileSync(
    join(OUT, "compare.html"),
    `<!doctype html><meta charset="utf-8"><title>GeoSimples: SVG x TikZ</title>
<style>body{font-family:sans-serif;margin:16px}.row{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
figure{margin:0;outline:1px solid #ddd}figcaption{font-size:12px;color:#666}</style>
${rows}
<script>
// The PNGs are rendered at 300 dpi; show them at print size, like the SVG.
for (const img of document.querySelectorAll("img.png")) {
  img.onload = () => (img.style.width = (img.naturalWidth * 72) / 300 + "pt");
  img.onerror = () => img.closest("figure").remove();
}
</script>
`,
  );
});
