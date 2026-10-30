import { expect, test, type Locator, type Page } from "@playwright/test";
import { counts, leaveInput, pointInput, TRIANGLE } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(pointInput(page)).toBeVisible();
  await page.getByRole("button", { name: "Layout profissional" }).click();
  await expect(page.getByRole("toolbar", { name: "Ferramentas" })).toBeVisible();
});

type Box = { x: number; y: number; width: number; height: number };

const tab = (page: Page, title: string) => page.getByRole("tab", { name: title, exact: true });
const panel = (page: Page, id: string) => page.locator(`[data-panel="${id}"]`);
/** The group a panel's tab sits in: its tab strip and body, as one box. */
const group = (page: Page, title: string) => tab(page, title).locator("xpath=ancestor::*[contains(@class,'dv-groupview')][1]");
const box = async (l: Locator) => (await l.boundingBox())!;

/** Presses on `from` and moves to `to` in small steps, like a hand; `beforeDrop` looks at the page before letting go. */
async function drag(page: Page, from: Locator, to: { x: number; y: number }, beforeDrop?: () => Promise<void>) {
  const b = await box(from);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 12, b.y + b.height / 2 + 12, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 16 });
  await beforeDrop?.();
  await page.mouse.up();
}

/** A point inside `b`, as fractions of its width and height. */
const at = (b: Box, fx: number, fy: number) => ({ x: b.x + b.width * fx, y: b.y + b.height * fy });

test("pro layout: hidden point input and the right-click menu", async ({ page }) => {
  const viewport = page.viewportSize()!;
  // Toolbars down the left, panels down the right.
  expect((await box(page.getByRole("toolbar", { name: "Ferramentas" }))).x).toBeLessThan(10);
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
  await page.getByRole("menuitem", { name: "Apagar selecionados" }).click();
  await expect.poll(async () => (await counts(page)).point).toBe(2);
});

test("pro layout: a panel docks above or below another, and the overlay shows exactly where", async ({ page }) => {
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
  await drag(page, tab(page, "Rótulos e textos"), spot, async () => {
    await expect(page.locator("[data-float-here]")).toBeVisible();
  });
  await expect(page.locator(".dv-resize-container").getByRole("tab", { name: "Rótulos e textos" })).toBeVisible();
  const floating = await box(panel(page, "labels"));
  expect(Math.abs(floating.x - (spot.x - 40))).toBeLessThan(60);
  // Formatação stayed where it was.
  expect((await box(panel(page, "formatting"))).x).toBeGreaterThan(preview.x + preview.width - 10);
  // Minimized, a floating panel keeps only its tab strip.
  await group(page, "Rótulos e textos").getByRole("button", { name: "Minimizar" }).click();
  await expect.poll(async () => (await box(group(page, "Rótulos e textos"))).height).toBeLessThan(40);
  await group(page, "Rótulos e textos").getByRole("button", { name: "Expandir" }).click();
  await expect.poll(async () => (await box(group(page, "Rótulos e textos"))).height).toBeGreaterThan(200);

  // Back into the column, under Propriedades: the first thing one tries.
  await drag(page, tab(page, "Rótulos e textos"), at(await box(group(page, "Propriedades")), 0.5, 0.9));
  await expect(page.locator(".dv-resize-container")).toHaveCount(0);
  const labels = await box(panel(page, "labels"));
  const props = await box(panel(page, "properties"));
  expect(Math.abs(labels.x - props.x)).toBeLessThanOrEqual(1);
  expect(labels.y).toBeGreaterThan(props.y);

  // Onto another panel's tabs it joins them.
  await drag(page, tab(page, "Rótulos e textos"), at(await box(tab(page, "Figura")), 1.6, 0.5));
  expect(await group(page, "Rótulos e textos").evaluate((g, other) => g === other, await group(page, "Figura").elementHandle()));
});

test("pro layout: a toolbar docks across the top, and the arrangement survives a reload", async ({ page }) => {
  const tools = page.getByRole("toolbar", { name: "Ferramentas" });
  await expect(tools).toHaveAttribute("aria-orientation", "vertical");
  const preview = await box(page.getByRole("region", { name: "Prévia da figura" }));
  await drag(page, page.getByLabel("Arrastar Ferramentas"), { x: preview.x + preview.width / 2, y: preview.y + 6 });
  await expect(tools).toHaveAttribute("aria-orientation", "horizontal");
  const across = await box(tools);
  expect(across.width).toBeGreaterThan(across.height * 4);
  expect(across.y).toBeLessThan(20);
  // Its menus open below it now.
  await tools.getByRole("button", { name: "Construções" }).click();
  const menu = await box(page.getByRole("menu"));
  expect(menu.y).toBeGreaterThanOrEqual(across.y + across.height - 4);
  await page.keyboard.press("Escape");

  await page.reload();
  await expect(tools).toHaveAttribute("aria-orientation", "horizontal");
  expect((await box(tools)).y).toBeLessThan(20);
});

test("pro layout: panels close, come back from Janelas, and the layout resets", async ({ page }) => {
  await tab(page, "Formatação").hover();
  await page.getByRole("button", { name: "Fechar Formatação" }).click();
  await expect(panel(page, "formatting")).toHaveCount(0);
  await page.getByRole("button", { name: "Janelas" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Formatação" }).click();
  await page.keyboard.press("Escape");
  await expect(panel(page, "formatting")).toBeVisible();

  // The group's own menu docks it too.
  await group(page, "Propriedades").getByRole("button", { name: "Opções da janela" }).click();
  await page.getByRole("menuitem", { name: "Encaixar à esquerda" }).click();
  expect((await box(panel(page, "properties"))).x).toBeLessThan(10);

  await page.getByRole("button", { name: "Janelas" }).click();
  await page.getByRole("menuitem", { name: "Restaurar janelas" }).click();
  expect((await box(panel(page, "properties"))).x).toBeGreaterThan(page.viewportSize()!.width / 2);

  // Dark theme; the preview stays white.
  await page.getByRole("button", { name: "Tema escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const paper = await page
    .getByRole("region", { name: "Prévia da figura" })
    .locator("svg.bg-white")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(paper).toBe("rgb(255, 255, 255)");

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
  await expect.poll(() => slack("Ferramentas")).toBeLessThanOrEqual(2);

  // Arquivo e histórico floats away: Ferramentas, now first in the column, still fits its buttons.
  const preview = await box(page.getByRole("region", { name: "Prévia da figura" }));
  await drag(page, page.getByLabel("Arrastar Arquivo e histórico"), at(preview, 0.5, 0.5));
  await expect(page.locator(".dv-resize-container").getByRole("toolbar", { name: "Arquivo e histórico" })).toBeVisible();
  await expect.poll(() => slack("Ferramentas")).toBeLessThanOrEqual(2);

  // Back under Ferramentas: Ferramentas and Arquivo fit, Janelas e ajuda takes the rest.
  const tools = await box(page.getByRole("toolbar", { name: "Ferramentas", exact: true }).locator("xpath=ancestor::*[contains(@class,'dv-groupview')][1]"));
  await drag(page, page.getByLabel("Arrastar Arquivo e histórico"), at(tools, 0.5, 0.95));
  await expect(page.locator(".dv-resize-container")).toHaveCount(0);
  await expect.poll(() => slack("Ferramentas")).toBeLessThanOrEqual(2);
  await expect.poll(() => slack("Arquivo e histórico")).toBeLessThanOrEqual(2);
  const file = await box(page.getByRole("toolbar", { name: "Arquivo e histórico" }));
  expect(file.x).toBeLessThan(10);
  expect(file.y).toBeGreaterThan(tools.y);
});
