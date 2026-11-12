import { expect, test, type Locator, type Page } from "@playwright/test";
import { counts, leaveInput, lowestAlong, pointInput, savedFigure, TRIANGLE } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(pointInput(page)).toBeVisible();
  await page.getByRole("button", { name: "Layout profissional" }).click();
  await expect(page.getByRole("toolbar", { name: "Modo" })).toBeVisible();
});

type Box = { x: number; y: number; width: number; height: number };

const tab = (page: Page, title: string) => page.getByRole("tab", { name: title, exact: true });
const panel = (page: Page, id: string) => page.locator(`[data-panel="${id}"]`);
/** The group a panel's tab sits in: its tab strip and body, as one box. */
const group = (page: Page, title: string) => tab(page, title).locator("xpath=ancestor::*[contains(@class,'dv-groupview')][1]");
const box = async (l: Locator) => (await l.boundingBox())!;

/**
 * Presses on `from` (its middle, or `grabX` px from its left: a tab cut short by
 * the tab strip shows only its start) and moves to `to` in small steps, like a
 * hand; `beforeDrop` looks at the page before letting go.
 */
async function drag(
  page: Page,
  from: Locator,
  to: { x: number; y: number },
  beforeDrop?: () => Promise<void>,
  grabX?: number,
) {
  const b = await box(from);
  await page.mouse.move(b.x + (grabX ?? b.width / 2), b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 12, b.y + b.height / 2 + 12, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 16 });
  await beforeDrop?.();
  await page.mouse.up();
}

/** Closes a panel from the Janelas menu, which works whatever its header looks like (Ferramentas as a bar has a grip). */
async function closeFromWindows(page: Page, title: string) {
  await page.getByRole("button", { name: "Janelas" }).click();
  await page.getByRole("menuitemcheckbox", { name: title }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none");
}

/** A point inside `b`, as fractions of its width and height. */
const at = (b: Box, fx: number, fy: number) => ({ x: b.x + b.width * fx, y: b.y + b.height * fy });

test("pro layout: hidden point input and the right-click menu", async ({ page }) => {
  const viewport = page.viewportSize()!;
  // Toolbars down the left, panels down the right.
  expect((await box(page.getByRole("toolbar", { name: "Modo" }))).x).toBeLessThan(10);
  expect((await box(panel(page, "properties"))).x).toBeGreaterThan(viewport.width / 2);

  // The input hides until / is pressed.
  const dock = page.getByTestId("point-input-dock");
  await expect(dock).toHaveAttribute("data-shown", "false");
  await leaveInput(page);
  await page.keyboard.press("/");
  await expect(pointInput(page)).toBeFocused();
  await expect(dock).toHaveAttribute("data-shown", "true");
  await pointInput(page).fill(TRIANGLE);
  await pointInput(page).press("Enter");
  await expect.poll(() => counts(page)).toMatchObject({ point: 3, segment: 3 });
  await pointInput(page).press("Escape");
  await expect(dock).toHaveAttribute("data-shown", "false");

  // A right click on a point outside the selection selects just it, and the menu acts on it.
  await page.keyboard.press("Escape");
  await expect(page.getByText(/^Selecionados:/)).toHaveCount(0);
  await page.locator('[data-owner="p1"]').click({ button: "right" });
  await expect(page.getByText("Selecionados: 1 ponto", { exact: false })).toBeVisible();
  // Only what applies to the point: no undo, export or theme in here.
  await expect(page.getByRole("menuitem", { name: "Exportar…" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /Desfazer/ })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Apagar selecionados" }).click();
  await expect.poll(async () => (await counts(page)).point).toBe(2);

  // An empty spot offers a point there and the view.
  await page.keyboard.press("Escape");
  await page.getByRole("region", { name: "Prévia da figura" }).locator("svg.touch-none").click({ button: "right", position: { x: 30, y: 30 } });
  await expect(page.getByRole("menuitem", { name: /Adicionar ponto aqui/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Vista" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Apagar selecionados" })).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("pro layout: Ponto sobre o gráfico from a right click on a curve puts the point there", async ({ page }) => {
  await leaveInput(page);
  await page.keyboard.press("/");
  await pointInput(page).fill("y=x");
  await pointInput(page).press("Enter");
  await expect.poll(() => counts(page)).toMatchObject({ function: 1 });
  await pointInput(page).press("Escape");
  // Without snapping, the point goes exactly where the click was, not to the nearest grid crossing.
  await page.getByRole("button", { name: "Encaixar na grade" }).click();
  // The line runs from x = −3 to 3: 72% along it is x = 1.32.
  const spot = await page.locator('[data-owner="f1"] path').last().evaluate((el) => {
    const path = el as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() * 0.72);
    const m = path.getScreenCTM()!;
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
  });
  await page.mouse.click(spot.x, spot.y, { button: "right" });
  await page.getByRole("menuitem", { name: "Ponto sobre o gráfico" }).click();
  await expect.poll(() => counts(page)).toMatchObject({ function: 1, point: 1 });
  const point = (await savedFigure(page))!.elements.find((e) => e.type === "point") as unknown as { x: number; y: number };
  expect(point.x).toBeCloseTo(1.32, 1);
  expect(point.y).toBeCloseTo(point.x, 6);
});

test("pro layout: Reta tangente from a right click on a curve adds the point and its tangent", async ({ page }) => {
  await leaveInput(page);
  await page.keyboard.press("/");
  await pointInput(page).fill("y=x^2");
  await pointInput(page).press("Enter");
  await expect.poll(() => counts(page)).toMatchObject({ function: 1 });
  await pointInput(page).press("Escape");
  const spot = await page.locator('[data-owner="f1"] path').last().evaluate((el) => {
    const path = el as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() * 0.6);
    const m = path.getScreenCTM()!;
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
  });
  await page.mouse.click(spot.x, spot.y, { button: "right" });
  await page.getByRole("menuitem", { name: "Reta tangente" }).click();
  // The point and the two hidden ends of the tangent, joined by a segment.
  await expect.poll(() => counts(page)).toMatchObject({ function: 1, point: 3, segment: 1 });
  const doc = (await savedFigure(page))!;
  const ends = doc.elements.filter((e) => (e as { construction?: { kind: string } }).construction?.kind === "tangent");
  expect(ends).toHaveLength(2);
  // Selected on its own, it shows its equation.
  await page.keyboard.press("Escape");
  const segment = (doc.elements.find((e) => e.type === "segment") as { id: string }).id;
  // Near one end, away from the point it touches.
  const on = await page.locator(`[data-owner="${segment}"] path`).last().evaluate((el) => {
    const path = el as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() * 0.15);
    const m = path.getScreenCTM()!;
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
  });
  await page.mouse.click(on.x, on.y);
  await expect(page.getByText(/^Reta tangente/).first()).toBeVisible();
  await expect(page.getByText(/^y = /)).toBeVisible();
});

test("pro layout: a right click near a turning point offers to add it", async ({ page }) => {
  await leaveInput(page);
  await page.keyboard.press("/");
  await pointInput(page).fill("y=x^2-1");
  await pointInput(page).press("Enter");
  await expect.poll(() => counts(page)).toMatchObject({ function: 1 });
  await pointInput(page).press("Escape");
  const vertex = await lowestAlong(page, "f1");
  await page.mouse.move(vertex.x, vertex.y - 4);
  await expect(page.getByTestId("spot-ghost")).toContainText("Mínimo");
  await page.mouse.click(vertex.x, vertex.y - 4, { button: "right" });
  await page.getByRole("menuitem", { name: "Inserir ponto de mínimo" }).click();
  await expect.poll(() => counts(page)).toMatchObject({ function: 1, point: 1 });
  const p = (await savedFigure(page))!.elements.find((e) => e.type === "point") as unknown as Record<string, unknown>;
  expect(p).toMatchObject({ x: 0, y: -1, construction: { kind: "notable", feature: "extremum" } });
});

test("pro layout: a tangent's ends drag along it in Mover, and it can fill the axes' window", async ({ page }) => {
  await leaveInput(page);
  await page.keyboard.press("/");
  await pointInput(page).fill("y=x^2");
  await pointInput(page).press("Enter");
  await expect.poll(() => counts(page)).toMatchObject({ function: 1 });
  await pointInput(page).press("Escape");
  const spot = await page.locator('[data-owner="f1"] path').last().evaluate((el) => {
    const path = el as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() * 0.6);
    const m = path.getScreenCTM()!;
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
  });
  await page.mouse.click(spot.x, spot.y, { button: "right" });
  await page.getByRole("menuitem", { name: "Reta tangente" }).click();
  await expect.poll(() => counts(page)).toMatchObject({ point: 3, segment: 1 });
  type End = { id: string; construction: { kind: string; along: number; fill?: boolean } };
  const ends = async () =>
    ((await savedFigure(page))!.elements as unknown as End[]).filter((e) => e.construction?.kind === "tangent");
  const segment = ((await savedFigure(page))!.elements.find((e) => e.type === "segment") as { id: string }).id;
  await page.keyboard.press("Escape");
  await page.keyboard.press("M");
  const on = await page.locator(`[data-owner="${segment}"] path`).last().evaluate((el) => {
    const path = el as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() * 0.15);
    const m = path.getScreenCTM()!;
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
  });
  await page.mouse.click(on.x, on.y);
  await expect(page.getByText(/^Reta tangente/).first()).toBeVisible();
  // Its far end, pulled on along the line, makes that side longer; the other stays.
  const h0 = (await page.locator(`[data-handle="${segment}:x0"]`).boundingBox())!;
  const h1 = (await page.locator(`[data-handle="${segment}:x1"]`).boundingBox())!;
  const [x0, y0, x1, y1] = [h0.x + h0.width / 2, h0.y + h0.height / 2, h1.x + h1.width / 2, h1.y + h1.height / 2];
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x1 + (x1 - x0) * 0.25, y1 + (y1 - y0) * 0.25, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Math.max(...(await ends()).map((e) => e.construction.along))).toBeGreaterThan(2.3);
  expect(Math.min(...(await ends()).map((e) => e.construction.along))).toBe(-2);
  // Filling the window: both ends go to its edges and follow it.
  await page.getByRole("switch", { name: "Preencher a janela" }).click();
  await expect.poll(async () => (await ends()).map((e) => e.construction.fill)).toEqual([true, true]);
});

test("pro layout: / brings the point input without moving the preview", async ({ page }) => {
  await leaveInput(page);
  const preview = page.getByRole("region", { name: "Prévia da figura" });
  const before = await box(preview);
  // Every scroll on the page, of any element, while the input slides in.
  await page.evaluate(() => {
    const w = window as unknown as { scrolled: string[] };
    w.scrolled = [];
    document.addEventListener("scroll", (e) => w.scrolled.push(String((e.target as Element).className)), true);
  });
  await page.keyboard.press("/");
  await expect(pointInput(page)).toBeFocused();
  await expect(page.getByTestId("point-input-dock")).toHaveAttribute("data-shown", "true");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { scrolled: string[] }).scrolled)).toEqual([]);
  expect(await box(preview)).toEqual(before);
});

test("pro layout: Escape sends the input away even with text in it, and / brings the text back", async ({ page }) => {
  const dock = page.getByTestId("point-input-dock");
  await leaveInput(page);
  await page.keyboard.press("/");
  await pointInput(page).fill("A=(1;1)");
  await pointInput(page).press("Escape");
  await expect(dock).toHaveAttribute("data-shown", "false");
  await page.keyboard.press("/");
  await expect(dock).toHaveAttribute("data-shown", "true");
  await expect(pointInput(page)).toHaveValue("A=(1;1)");
});

test("dark theme: the preview paper turns gray, and exports stay white unless asked", async ({ page }) => {
  await pointInput(page).fill(TRIANGLE);
  await pointInput(page).press("Enter");
  const paper = () => page.locator('section[aria-label="Prévia da figura"] svg').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await paper()).toBe("rgb(255, 255, 255)");
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("geosimples-workspace")!);
    saved.state.theme = "dark";
    localStorage.setItem("geosimples-workspace", JSON.stringify(saved));
  });
  await page.reload();
  expect(await paper()).toBe("rgb(48, 48, 48)");
  // Black ink shows light on the gray paper.
  await expect(page.locator('section[aria-label="Prévia da figura"] path[stroke="#000000"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Exportar", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Exportar figura" });
  await dialog.getByRole("tab", { name: /SVG/ }).click();
  const exported = () => dialog.getByRole("img", { name: "Prévia da exportação" }).getAttribute("src").then((src) => decodeURIComponent(src!));
  expect(await exported()).toContain('fill="#ffffff"');
  expect(await exported()).toContain('stroke="#000000"');
  await dialog.getByRole("radio", { name: "Como no tema" }).click();
  expect(await exported()).toContain('fill="#303030"');
  expect(await exported()).not.toContain('stroke="#000000"');
});

test("pro layout: a panel docks above or below another, and the overlay shows exactly where", async ({ page }) => {
  // Room for two groups in the column: a group's upper drop zone is a fifth of it, and must reach below its tabs.
  await closeFromWindows(page, "Figura");
  const target = await box(group(page, "Formatação"));
  // Over the lower part of Formatação, the overlay is its lower half: no inset, no margin.
  await drag(page, tab(page, "Propriedades"), at(target, 0.5, 0.92), async () => {
    const overlay = page.locator(".dv-drop-target-anchor.dv-drop-target-bottom");
    await expect(overlay).toBeVisible();
    // It slides into place.
    await page.waitForTimeout(300);
    const o = await box(overlay);
    expect(Math.abs(o.x - target.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(o.width - target.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(o.y + o.height - (target.y + target.height))).toBeLessThanOrEqual(1);
    expect(Math.abs(o.height - target.height / 2)).toBeLessThanOrEqual(2);
  });
  const props = await box(panel(page, "properties"));
  const formatting = await box(group(page, "Formatação"));
  expect(Math.abs(props.x - formatting.x)).toBeLessThanOrEqual(1);
  expect(props.y).toBeGreaterThan(formatting.y);

  // Over the upper part of Formatação it goes above it.
  await drag(page, tab(page, "Propriedades"), at(await box(group(page, "Formatação")), 0.5, 0.15));
  const above = await box(panel(page, "properties"));
  expect(Math.abs(above.x - formatting.x)).toBeLessThanOrEqual(1);
  expect(above.y).toBeLessThan((await box(group(page, "Formatação"))).y);
});

test("pro layout: dropped on the preview a panel floats there, and docks back beside another", async ({ page }) => {
  const preview = await box(page.getByRole("region", { name: "Prévia da figura" }));
  const spot = at(preview, 0.4, 0.4);
  await drag(page, tab(page, "Rótulos"), spot, async () => {
    await expect(page.locator("[data-float-here]")).toBeVisible();
  });
  await expect(page.locator(".dv-resize-container").getByRole("tab", { name: "Rótulos" })).toBeVisible();
  const floating = await box(panel(page, "labels"));
  expect(Math.abs(floating.x - (spot.x - 40))).toBeLessThan(60);
  // Formatação stayed where it was.
  expect((await box(tab(page, "Formatação"))).x).toBeGreaterThan(preview.x + preview.width - 10);
  // Minimized, a floating panel keeps only its tab strip.
  await group(page, "Rótulos").getByRole("button", { name: "Minimizar" }).click();
  await expect.poll(async () => (await box(group(page, "Rótulos"))).height).toBeLessThan(40);
  await group(page, "Rótulos").getByRole("button", { name: "Expandir" }).click();
  await expect.poll(async () => (await box(group(page, "Rótulos"))).height).toBeGreaterThan(200);

  // Back into the column, under Propriedades: the first thing one tries.
  await drag(page, tab(page, "Rótulos"), at(await box(group(page, "Propriedades")), 0.5, 0.96));
  await expect(page.locator(".dv-resize-container")).toHaveCount(0);
  const labels = await box(panel(page, "labels"));
  // Formatação took the front of the group Rótulos left: the group's box, whichever tab is open.
  const props = await box(group(page, "Propriedades"));
  expect(Math.abs(labels.x - props.x)).toBeLessThanOrEqual(1);
  expect(labels.y).toBeGreaterThan(props.y);

  // Onto another panel's tabs it joins them.
  await drag(page, tab(page, "Rótulos"), at(await box(tab(page, "Figura")), 1.6, 0.5));
  expect(await group(page, "Rótulos").evaluate((g, other) => g === other, await group(page, "Figura").elementHandle()));
});

test("pro layout: a toolbar docks across the top, and the arrangement survives a reload", async ({ page }) => {
  const tools = page.getByRole("toolbar", { name: "Janelas e ajuda" });
  await expect(tools).toHaveAttribute("aria-orientation", "vertical");
  const preview = await box(page.getByRole("region", { name: "Prévia da figura" }));
  await drag(page, page.getByLabel("Arrastar Janelas e ajuda"), { x: preview.x + preview.width / 2, y: preview.y + 6 });
  await expect(tools).toHaveAttribute("aria-orientation", "horizontal");
  const across = await box(tools);
  expect(across.width).toBeGreaterThan(across.height * 3);
  expect(across.y).toBeLessThan(20);
  // Its menus open below it now.
  await tools.getByRole("button", { name: "Janelas" }).click();
  const menu = await box(page.getByRole("menu"));
  expect(menu.y).toBeGreaterThanOrEqual(across.y + across.height - 4);
  await page.keyboard.press("Escape");

  await page.reload();
  await expect(tools).toHaveAttribute("aria-orientation", "horizontal");
  expect((await box(tools)).y).toBeLessThan(20);
});

test("pro layout: panels close, come back from Janelas, and the layout resets", async ({ page }) => {
  await tab(page, "Formatação").click();
  await page.getByRole("button", { name: "Fechar Formatação" }).click();
  await expect(panel(page, "formatting")).toHaveCount(0);
  await page.getByRole("button", { name: "Janelas" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Formatação" }).click();
  await page.keyboard.press("Escape");
  await expect(panel(page, "formatting")).toBeVisible();

  // The group's own menu docks it too.
  await group(page, "Propriedades").getByRole("button", { name: "Opções da janela" }).click();
  await page.getByRole("menuitem", { name: "Encaixar à esquerda" }).click();
  expect((await box(group(page, "Propriedades"))).x).toBeLessThan(10);

  await page.getByRole("button", { name: "Janelas" }).click();
  await page.getByRole("menuitem", { name: "Restaurar janelas" }).click();
  expect((await box(panel(page, "properties"))).x).toBeGreaterThan(page.viewportSize()!.width / 2);

  // Dark theme; the preview's paper turns gray with it.
  await page.getByRole("button", { name: "Tema escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const paper = await page
    .getByRole("region", { name: "Prévia da figura" })
    .locator("svg.touch-none")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(paper).toBe("rgb(48, 48, 48)");

  // Back to the classic page, which keeps the browser's own right-click menu.
  await page.getByRole("button", { name: "Janelas" }).click();
  await page.getByRole("menuitem", { name: "Voltar ao layout clássico" }).click();
  await expect(page.getByRole("complementary", { name: "Painel" })).toBeVisible();
  await page.getByRole("region", { name: "Prévia da figura" }).locator("svg.touch-none").click({ button: "right", position: { x: 20, y: 20 } });
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("pro layout: toolbars sharing a column fit their buttons when one leaves or comes back", async ({ page }) => {
  /** How far a toolbar's group is from its buttons' length (grip included); the last in a column takes the rest. */
  const slack = (title: string) =>
    page.getByRole("toolbar", { name: title, exact: true }).evaluate((bar) => {
      const groupEl = bar.closest(".dv-groupview")!;
      return Math.abs(groupEl.getBoundingClientRect().height - (bar.scrollHeight + 12));
    });
  await expect.poll(() => slack("Arquivo e histórico")).toBeLessThanOrEqual(2);
  await expect.poll(() => slack("Modo")).toBeLessThanOrEqual(2);

  // Arquivo e histórico floats away: Ferramentas, now first in the column, still fits its buttons.
  const preview = await box(page.getByRole("region", { name: "Prévia da figura" }));
  await drag(page, page.getByLabel("Arrastar Arquivo e histórico"), at(preview, 0.5, 0.5));
  await expect(page.locator(".dv-resize-container").getByRole("toolbar", { name: "Arquivo e histórico" })).toBeVisible();
  await expect.poll(() => slack("Modo")).toBeLessThanOrEqual(2);

  // Back under Ferramentas: Ferramentas and Arquivo fit, Modo takes the rest.
  const tools = await box(page.getByRole("toolbar", { name: "Modo", exact: true }).locator("xpath=ancestor::*[contains(@class,'dv-groupview')][1]"));
  await drag(page, page.getByLabel("Arrastar Arquivo e histórico"), at(tools, 0.5, 0.95));
  await expect(page.locator(".dv-resize-container")).toHaveCount(0);
  await expect.poll(() => slack("Modo")).toBeLessThanOrEqual(2);
  await expect.poll(() => slack("Arquivo e histórico")).toBeLessThanOrEqual(2);
  const file = await box(page.getByRole("toolbar", { name: "Arquivo e histórico" }));
  expect(file.x).toBeLessThan(10);
  expect(file.y).toBeGreaterThan(tools.y);
});

/** Toolbar buttons outside their toolbar's window, or outside the page. */
const hiddenButtons = (page: Page) =>
  page.locator("[data-toolbar] button").evaluateAll((buttons) =>
    buttons
      .filter((b) => {
        const r = b.getBoundingClientRect();
        const g = b.closest(".dv-groupview")!.getBoundingClientRect();
        const inside = (o: DOMRect) => r.left >= o.left - 1 && r.right <= o.right + 1 && r.top >= o.top - 1 && r.bottom <= o.bottom + 1;
        return !inside(g) || r.right > window.innerWidth || r.bottom > window.innerHeight;
      })
      .map((b) => b.getAttribute("aria-label")),
  );

/** Drags the splitter that ends at `edge` of `bar`'s window (its bottom, or its right when across) by `by` px. */
async function dragSplitter(page: Page, bar: Locator, edge: "bottom" | "right", by: number) {
  const g = await box(bar.locator("xpath=ancestor::*[contains(@class,'dv-groupview')][1]"));
  const x = edge === "right" ? g.x + g.width : g.x + g.width / 2;
  const y = edge === "right" ? g.y + g.height / 2 : g.y + g.height;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(edge === "right" ? x + by : x, edge === "right" ? y : y + by, { steps: 8 });
  await page.mouse.up();
}

test("pro layout: toolbars keep every button in view, the app buttons at the bottom and Inserir over the preview", async ({ page }) => {
  // Three toolbars, each one kind of button: no dividers inside.
  await expect(page.locator("[data-toolbar]")).toHaveCount(3);
  await expect(page.locator("[data-toolbar] .bg-border")).toHaveCount(0);
  // Janelas, theme, settings and help at the bottom of the left column; Inserir floats at the preview's top right.
  const preview = await box(page.getByRole("region", { name: "Prévia da figura" }));
  const app = await box(page.getByRole("toolbar", { name: "Janelas e ajuda" }));
  expect(app.x).toBeLessThan(10);
  expect(app.y + app.height).toBeGreaterThan(page.viewportSize()!.height - 20);
  const insert = await box(page.getByRole("button", { name: "Inserir", exact: true }));
  expect(insert.x + insert.width).toBeGreaterThan(preview.x + preview.width - 30);
  expect(insert.y).toBeLessThan(preview.y + 30);

  // Splitters between toolbars in a column move nothing: no toolbar shrinks below its buttons or grows over the others.
  const file = page.getByRole("toolbar", { name: "Arquivo e histórico" });
  const tools = page.getByRole("toolbar", { name: "Modo" });
  const before = await box(tools);
  for (const [bar, by] of [[file, -80], [file, 120], [tools, -100], [tools, 200]] as const) {
    await dragSplitter(page, bar, "bottom", by);
    expect(await hiddenButtons(page)).toEqual([]);
  }
  expect((await box(tools)).y).toBeCloseTo(before.y, 0);

  // Across the top, side by side: the splitter between them can't hide buttons either.
  await drag(page, page.getByLabel("Arrastar Modo"), at(preview, 0.5, 0.01));
  await expect(tools).toHaveAttribute("aria-orientation", "horizontal");
  const across = await box(tools);
  // Its group spans the whole row, so this spot stays in the group's left drop zone however many buttons it has.
  await drag(page, page.getByLabel("Arrastar Arquivo e histórico"), { x: across.x + 120, y: across.y + across.height / 2 });
  await expect(file).toHaveAttribute("aria-orientation", "horizontal");
  for (const by of [-200, 600]) {
    await dragSplitter(page, tools, "right", by);
    expect(await hiddenButtons(page)).toEqual([]);
  }

  // Floating, a toolbar has no handles to shrink it, and grows when a button comes (Figura rápida).
  await drag(page, page.getByLabel("Arrastar Modo"), at(await box(page.getByRole("region", { name: "Prévia da figura" })), 0.4, 0.4));
  const floating = page.locator(".dv-resize-container").filter({ has: page.getByRole("toolbar", { name: "Modo" }) });
  await expect(floating).toBeVisible();
  await expect(floating.locator("[class^='dv-resize-handle-']").first()).toBeHidden();
  const short = (await box(floating)).height;
  // Holding Adicionar pontos switches to Figura rápida, which shows its button.
  const add = await box(page.getByRole("button", { name: "Adicionar pontos" }));
  await page.mouse.move(add.x + add.width / 2, add.y + add.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Figura rápida" })).toBeVisible();
  await expect.poll(async () => (await box(floating)).height).toBeGreaterThan(short + 30);
  expect(await hiddenButtons(page)).toEqual([]);
});

test("pro layout: the right panels keep their width when toolbars move, and only their splitter changes it", async ({ page }) => {
  const width = async () => Math.round((await box(panel(page, "properties"))).width);
  const start = await width();
  const preview = () => box(page.getByRole("region", { name: "Prévia da figura" }));
  // Toolbars moved around: onto the preview's left part, across its top, to the window's left edge,
  // floating, and along the bottom. The dock used to hand the freed width to the right panels.
  let p = await preview();
  await drag(page, page.getByLabel("Arrastar Modo"), at(p, 0.03, 0.5));
  p = await preview();
  await drag(page, page.getByLabel("Arrastar Arquivo e histórico"), at(p, 0.5, 0.02));
  await drag(page, page.getByLabel("Arrastar Modo"), { x: 3, y: 400 });
  p = await preview();
  await drag(page, page.getByLabel("Arrastar Arquivo e histórico"), at(p, 0.5, 0.5));
  await drag(page, page.getByLabel("Arrastar Arquivo e histórico"), { x: 600, y: page.viewportSize()!.height - 3 });
  await expect.poll(width).toBe(start);

  // The splitter between the preview and the panels does change it, and the new width stays.
  const right = await box(group(page, "Propriedades"));
  const sash = await page.locator(".dv-sash").evaluateAll(
    (els, x) =>
      els
        .map((el) => el.getBoundingClientRect())
        .filter((r) => Math.abs(r.left + r.width / 2 - x) < 6 && r.height > 300)
        .map((r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 }))[0],
    right.x,
  );
  await page.mouse.move(sash.x, sash.y);
  await page.mouse.down();
  await page.mouse.move(sash.x - 100, sash.y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(width).toBeGreaterThan(start + 90);
  const wider = await width();
  await drag(page, page.getByLabel("Arrastar Modo"), { x: 3, y: 300 });
  await expect.poll(width).toBe(wider);

  // A narrower window takes the room from the preview, not from the panels.
  await page.setViewportSize({ width: 1200, height: 820 });
  await expect.poll(width).toBe(wider);
});

test("pro layout: panels never split a column side by side, and drop overlays don't animate", async ({ page }) => {
  const props = await box(group(page, "Propriedades"));
  // Over the left part of Propriedades, stacked in the right column: no overlay, nothing happens.
  await drag(page, tab(page, "Figura"), at(props, 0.08, 0.6), async () => {
    await page.waitForTimeout(200);
    await expect(page.locator(".dv-drop-target-anchor.dv-drop-target-left, .dv-drop-target-anchor.dv-drop-target-right")).toHaveCount(0);
  });
  const figure = await box(panel(page, "figure"));
  const after = await box(panel(page, "properties"));
  expect(Math.abs(figure.x - after.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(figure.width - after.width)).toBeLessThanOrEqual(1);
  // Still below it, as it starts out.
  expect(figure.y).toBeGreaterThan(after.y);

  // Below Formatação it still goes, and its overlay shows up at its final size at once.
  const target = await box(group(page, "Formatação"));
  await drag(page, tab(page, "Figura"), at(target, 0.5, 0.92), async () => {
    const overlay = page.locator(".dv-drop-target-anchor.dv-drop-target-bottom");
    await expect(overlay).toBeVisible();
    const durations = await overlay.evaluate((el) => getComputedStyle(el).transitionDuration.split(",").map((d) => parseFloat(d)));
    expect(durations.every((d) => d === 0)).toBe(true);
  });
  expect((await box(panel(page, "figure"))).y).toBeGreaterThan((await box(group(page, "Formatação"))).y);
});

test("pro layout: a panel alone in its column takes others above and below, and leaving it doesn't widen the right panels", async ({ page }) => {
  // Propriedades' group: it stays visible when another tab joins it.
  const width = async () => Math.round((await box(group(page, "Propriedades"))).width);
  /** The empty end of Propriedades' tab strip: dropped there, a panel joins it as a tab. */
  const strip = async () => {
    const g = await box(group(page, "Propriedades"));
    return { x: g.x + g.width * 0.6, y: g.y + 15 };
  };
  const start = await width();
  // Formatação on the window's left edge: a column of its own, full height.
  await drag(page, tab(page, "Formatação"), { x: 3, y: 400 });
  const alone = await box(panel(page, "formatting"));
  expect(alone.x).toBeLessThan(10);
  // Figura goes below it: the column stacks, it doesn't refuse.
  await drag(page, tab(page, "Figura"), at(await box(group(page, "Formatação")), 0.5, 0.92));
  const figure = await box(panel(page, "figure"));
  expect(Math.abs(figure.x - alone.x)).toBeLessThanOrEqual(1);
  expect(figure.y).toBeGreaterThan(alone.y);
  await expect.poll(width).toBe(start);

  // Both back into the right column, as tabs of Propriedades: its width stays.
  await drag(page, tab(page, "Figura"), await strip());
  await drag(page, tab(page, "Formatação"), await strip());
  expect((await box(panel(page, "formatting"))).x).toBeGreaterThan(page.viewportSize()!.width / 2);
  await expect.poll(width).toBe(start);
});

test("pro layout: with a toolbar along the bottom, a lone panel group still takes panels above and below", async ({ page }) => {
  await drag(page, page.getByLabel("Arrastar Arquivo e histórico"), { x: 600, y: page.viewportSize()!.height - 3 });
  // Propriedades, Formatação and Rótulos start as one group, not as tall as the window, beside the preview.
  // Rótulos out of it, below it.
  await drag(page, tab(page, "Rótulos"), at(await box(group(page, "Propriedades")), 0.5, 0.92));
  const lone = await box(group(page, "Propriedades"));
  const labels = await box(panel(page, "labels"));
  expect(Math.abs(labels.x - lone.x)).toBeLessThanOrEqual(1);
  expect(labels.y).toBeGreaterThan(lone.y + lone.height - 5);
});

test("pro layout: two full-height panel columns on both sides of the preview still take panels above and below", async ({ page }) => {
  // Everything but Propriedades and Formatação closed: the right column is one group, as tall as the window.
  await closeFromWindows(page, "Ferramentas");
  for (const title of ["Figura", "Prontos", "Rótulos"]) {
    await tab(page, title).click();
    await page.getByRole("button", { name: `Fechar ${title}` }).click();
  }
  const g = await box(group(page, "Propriedades"));
  await drag(page, tab(page, "Formatação"), { x: g.x + g.width * 0.6, y: g.y + 15 });
  // Formatação to the window's left edge: a second full-height column, across the preview.
  await drag(page, tab(page, "Formatação"), { x: 3, y: 400 });
  expect((await box(panel(page, "formatting"))).x).toBeLessThan(10);
  const props = await box(group(page, "Propriedades"));
  expect(props.height).toBeGreaterThan(page.viewportSize()!.height - 5);

  // Rótulos back (it opens beside Formatação), then below Propriedades: it stacks.
  await page.getByRole("button", { name: "Janelas" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Rótulos" }).click();
  await page.keyboard.press("Escape");
  // The closing menu blocks the pointer until it is gone.
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none");
  // Its tab may be cut short in Formatação's narrow strip: grab its start.
  await drag(page, tab(page, "Rótulos"), at(props, 0.5, 0.92), undefined, 20);
  const after = await box(group(page, "Propriedades"));
  const labels = await box(panel(page, "labels"));
  expect(Math.abs(labels.x - after.x)).toBeLessThanOrEqual(1);
  expect(labels.y).toBeGreaterThan(after.y + after.height - 5);
});

test("pro layout: a toolbar between the preview and the panels doesn't widen the panels at each reload", async ({ page }) => {
  const width = async () => Math.round((await box(panel(page, "properties"))).width);
  const p = await box(page.getByRole("region", { name: "Prévia da figura" }));
  await drag(page, page.getByLabel("Arrastar Modo"), at(p, 0.98, 0.5));
  await expect(page.getByRole("toolbar", { name: "Modo" })).toHaveAttribute("aria-orientation", "vertical");
  const start = await width();
  for (let i = 0; i < 2; i++) {
    await page.reload();
    await expect(page.getByRole("toolbar", { name: "Modo" })).toBeVisible();
    await expect.poll(width).toBe(start);
  }
  expect(Math.round((await box(page.getByRole("toolbar", { name: "Modo" }))).width)).toBeLessThanOrEqual(48);
});

test("pro layout: back from the classic layout, toolbars are one button wide again", async ({ page }) => {
  const widths = () => page.locator("[data-toolbar]").evaluateAll((els) => els.map((el) => Math.round(el.closest(".dv-groupview")!.getBoundingClientRect().width)));
  await expect.poll(widths).toEqual([48, 48, 48]);
  await page.getByRole("button", { name: "Janelas" }).click();
  await page.getByRole("menuitem", { name: /layout clássico/ }).click();
  await page.getByRole("button", { name: "Layout profissional" }).click();
  await expect(page.getByRole("toolbar", { name: "Modo" })).toBeVisible();
  await expect.poll(widths).toEqual([48, 48, 48]);
});

test("pro layout: Ferramentas starts as a bar of folder tabs between the preview and the panels, and turns into a panel and back", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  const tools = panel(page, "tools");
  // A column of its own, between the preview and the panels, with Propriedades above Figura.
  await expect.poll(async () => Math.round((await box(tools)).width)).toBe(86);
  // The preview follows the new window size a moment later.
  const previewEnd = async () => {
    const p = await box(page.getByRole("region", { name: "Prévia da figura" }));
    return p.x + p.width;
  };
  await expect.poll(async () => (await box(tools)).x - (await previewEnd())).toBeGreaterThanOrEqual(-1);
  const props = await box(panel(page, "properties"));
  const bar = await box(tools);
  expect(bar.x + bar.width).toBeLessThanOrEqual(props.x + 1);
  expect(bar.height).toBeGreaterThan(500);
  expect(props.y).toBeLessThan((await box(panel(page, "figure"))).y);

  // The areas are tabs; the open area's tools are icons named by their tooltips.
  await tools.getByRole("tab", { name: "Gráficos" }).click();
  await expect(tools.getByRole("button", { name: "Gráfico de função" })).toBeVisible();
  await tools.getByRole("tab", { name: "Geometria" }).click();
  // Not all of them fit: an arrow scrolls to the rest, and then one scrolls back.
  await tools.getByRole("button", { name: "Rolar para baixo" }).click();
  await expect(tools.getByRole("button", { name: "Rolar para cima" })).toBeVisible();

  // Its grip's menu turns it into the panel, on top of the panels' column.
  await page.getByLabel("Arrastar Ferramentas").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Mostrar como painel" }).click();
  await expect.poll(async () => (await box(panel(page, "tools"))).width).toBeGreaterThan(200);
  await expect(tab(page, "Ferramentas")).toBeVisible();
  const back = await box(panel(page, "tools"));
  expect(Math.abs(back.x - (await box(panel(page, "properties"))).x)).toBeLessThanOrEqual(1);
  expect(back.y).toBeLessThan((await box(panel(page, "properties"))).y);

  // It stays a panel after a reload, and its menu makes it the bar again.
  await page.reload();
  await expect(tab(page, "Ferramentas")).toBeVisible();
  await group(page, "Ferramentas").getByRole("button", { name: "Opções da janela" }).click();
  await page.getByRole("menuitem", { name: "Mostrar como barra" }).click();
  await expect.poll(async () => Math.round((await box(panel(page, "tools"))).width)).toBe(86);
});

test("pro layout: Inserir is a round + that spells out its name when the pointer rests on it", async ({ page }) => {
  const insert = page.getByRole("button", { name: "Inserir", exact: true });
  const round = await box(insert);
  expect(Math.abs(round.width - round.height)).toBeLessThan(1);
  await insert.hover();
  await expect.poll(async () => (await box(insert)).width).toBeGreaterThan(round.width + 30);
  // It grows from the corner: its right edge stays put.
  const wide = await box(insert);
  expect(Math.abs(wide.x + wide.width - (round.x + round.width))).toBeLessThan(1);
  await page.mouse.move(400, 400);
  await expect.poll(async () => (await box(insert)).width).toBeLessThan(round.width + 1);
});

test("pro layout: switching between Figura and Prontos doesn't move the panels below", async ({ page }) => {
  const below = tab(page, "Propriedades");
  const before = await box(below);
  for (const name of ["Prontos", "Figura"]) {
    await tab(page, name).click();
    await page.waitForTimeout(150);
    expect((await box(below)).y).toBe(before.y);
  }
});
