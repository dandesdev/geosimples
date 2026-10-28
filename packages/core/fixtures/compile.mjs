// Compiles the fixtures written by `npm run fixtures` with a real LaTeX engine.
//
//   node fixtures/compile.mjs [--engine=pdflatex] [--png] [--compare] [name ...]
//
// --engine   pdflatex (default, or $LATEX), lualatex, xelatex, or tectonic (a path works too)
// --png      renders each PDF to <name>-pdf.png at 300 dpi (needs pdftoppm)
// --compare  also renders each SVG with headless Chrome, the way the PNG export
//            does (as an <img>), and writes <name>-svg.png and <name>-overlay.png
//            (needs Chrome and ImageMagick). Set CHROME if Chrome isn't found.
// name ...   only these fixtures (without .tex); all of them by default.
// Open out/compare.html to see the SVG, the PDF and the overlay side by side.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const OUT = join(import.meta.dirname, "out");
const DPI = 300;
const args = process.argv.slice(2);
const engine = args.find((a) => a.startsWith("--engine="))?.slice(9) ?? process.env.LATEX ?? "pdflatex";
const wantPng = args.includes("--png") || args.includes("--compare");
const wantCompare = args.includes("--compare");
const only = args.filter((a) => !a.startsWith("--"));

if (!existsSync(OUT)) {
  console.error("fixtures/out is missing: run `npm run fixtures` first.");
  process.exit(1);
}

const run = (cmd, cmdArgs) =>
  spawnSync(cmd, cmdArgs, {
    cwd: OUT,
    encoding: "utf8",
    maxBuffer: 1 << 26,
    // MiKTeX can wait forever on stdin when it wants to install a package.
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 600_000,
  });

const engineArgs = (file) =>
  basename(engine).startsWith("tectonic")
    ? ["-X", "compile", "--keep-logs", file]
    : ["-interaction=nonstopmode", "-halt-on-error", file];

/** Log lines that mean the figure doesn't look as exported, even if LaTeX finished. */
const BAD_LOG = [/^! /m, /Missing character/, /Package pgf(keys)? Error/, /Undefined control sequence/];

const texFiles = readdirSync(OUT).filter((f) => f.endsWith(".tex") && (!only.length || only.includes(f.slice(0, -4))));
let failed = 0;
for (const file of texFiles) {
  const name = file.slice(0, -4);
  rmSync(join(OUT, `${name}.log`), { force: true });
  const r = run(engine, engineArgs(file));
  const log = existsSync(join(OUT, `${name}.log`)) ? readFileSync(join(OUT, `${name}.log`), "latin1") : "";
  const problems = BAD_LOG.filter((re) => re.test(log));
  if (r.error || r.status !== 0 || problems.length) {
    failed++;
    console.error(`FAIL ${file} (${engine})`);
    if (r.error) console.error(`  ${r.error.message}`);
    if (!log) console.error((r.stderr || r.stdout || "").trim().split("\n").slice(-8).join("\n"));
    const lines = log.split("\n");
    for (const re of problems) {
      const i = lines.findIndex((l) => re.test(l));
      if (i >= 0) console.error(lines.slice(i, i + 4).map((l) => `  ${l}`).join("\n"));
    }
    continue;
  }
  console.log(`ok   ${file}`);
  if (wantPng && name !== "all") {
    const p = run("pdftoppm", ["-png", "-r", String(DPI), "-singlefile", `${name}.pdf`, `${name}-pdf`]);
    if (p.error || p.status !== 0) console.error(`  pdftoppm failed for ${name}: ${p.error?.message ?? p.stderr}`);
    else if (wantCompare) compare(name);
  }
}

function chromeBinary() {
  const candidates = [
    process.env.CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  return candidates.find((c) => c && existsSync(c));
}

/** Renders the SVG the way the PNG export does (as an <img>) and overlays it on the PDF. */
function compare(name) {
  const chrome = chromeBinary();
  if (!chrome) return console.error("  no Chrome found for --compare; set CHROME");
  const svg = readFileSync(join(OUT, `${name}.svg`), "utf8");
  const w = Number(/width="([\d.]+)pt"/.exec(svg)[1]);
  const h = Number(/height="([\d.]+)pt"/.exec(svg)[1]);
  const html = join(OUT, `${name}-svg.html`);
  writeFileSync(
    html,
    `<!doctype html><style>html,body{margin:0;background:#fff}img{display:block;width:${w}pt;height:${h}pt}</style><img src="${name}.svg">`,
  );
  const cssW = Math.ceil((w * 96) / 72);
  const cssH = Math.ceil((h * 96) / 72);
  const c = run(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--force-device-scale-factor=${DPI / 96}`,
    `--window-size=${cssW},${cssH}`,
    `--screenshot=${join(OUT, `${name}-svg.png`)}`,
    pathToFileURL(html).href,
  ]);
  if (c.status !== 0) return console.error(`  chrome failed for ${name}: ${c.stderr}`);
  // R = SVG, B = PDF, G = both: ink only in the PDF shows red, only in the SVG blue.
  const [pw, ph] = readPngSize(`${name}-pdf.png`);
  const m = run("magick", [
    "(", `${name}-svg.png`, "-background", "white", "-flatten", "-colorspace", "gray", "-extent", `${pw}x${ph}`, ")",
    "(", `${name}-pdf.png`, "-background", "white", "-flatten", "-colorspace", "gray", ")",
    "(", "-clone", "0,1", "-evaluate-sequence", "min", ")",
    "(", "-clone", "0", ")", "(", "-clone", "2", ")", "(", "-clone", "1", ")",
    "-delete", "0-2",
    "-combine",
    `${name}-overlay.png`,
  ]);
  if (m.status !== 0) console.error(`  magick failed for ${name}: ${m.stderr}`);
}

function readPngSize(file) {
  const buf = readFileSync(join(OUT, file));
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

if (failed) {
  console.error(`${failed} of ${texFiles.length} files failed with ${engine}.`);
  process.exit(1);
}
console.log(`All ${texFiles.length} files compiled with ${engine}.`);
