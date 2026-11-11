import { expect, test, type Page } from "@playwright/test";
import { clickAlong, counts, pointInput, savedFigure, toolbarButton } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(pointInput(page)).toBeVisible();
});

type Piece = { id: string; type: string; a?: string; b?: string; value?: number; label?: { text: string } };
const circuitOf = async (page: Page) => (await savedFigure(page))?.elements.find((e) => e.type === "circuit");
const piece = async (page: Page, id: string) => (await savedFigure(page))?.elements.find((e) => e.id === id) as Piece | undefined;

/** A tile of the Circuitos tab in the tools panel. */
async function circuitTile(page: Page, name: string) {
  const tools = page.getByRole("region", { name: "Ferramentas" });
  await tools.getByRole("tab", { name: "Circuitos" }).click();
  return tools.getByRole("button", { name, exact: true });
}

/** The middle of an element drawn in the preview, by its id. */
async function centerOf(page: Page, id: string) {
  const b = (await page.locator(`[data-owner="${id}"]`).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test("a ready-made circuit comes from Prontos and is switched on from its menu, with the current's direction", async ({ page }) => {
  const bar = page.getByRole("toolbar", { name: "Ações da figura" });
  await expect(bar.getByRole("button", { name: "Circuito", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Prontos" }).click();
  await page.getByRole("button", { name: /Circuito em série/ }).click();
  await expect.poll(() => counts(page)).toMatchObject({ component: 3, circuit: 1 });

  await toolbarButton(page, "Circuito").click();
  await page.getByRole("menuitem", { name: /Ligar circuito/ }).click();
  await expect.poll(() => circuitOf(page)).toMatchObject({ on: true });
  // The values are in the preview: U = 8 V across R₁ = 4 Ω, with 2 A from 12 V.
  await expect(page.getByRole("region", { name: "Prévia da figura" }).locator("text").filter({ hasText: "= 8" }).first()).toBeVisible();

  await toolbarButton(page, "Circuito").click();
  await page.getByRole("menuitem", { name: /Indicar sentido da corrente/ }).click();
  await page.getByRole("menuitem", { name: /Sentido real/ }).click();
  await expect.poll(() => circuitOf(page)).toMatchObject({ current: "real" });
});

test("pieces go in on their own, join end to end when dragged, and their value changes in Propriedades", async ({ page }) => {
  await (await circuitTile(page, "Gerador")).click();
  await (await circuitTile(page, "Resistor")).click();
  await expect.poll(() => counts(page)).toMatchObject({ component: 2, circuit: 1, point: 4 });
  // The new piece is selected, and Mover is on to drag it.
  await expect(toolbarButton(page, "Mover")).toHaveAttribute("aria-pressed", "true");
  const value = page.getByRole("textbox", { name: "Resistência", exact: true });
  await value.fill("47");
  await expect.poll(() => piece(page, "k2")).toMatchObject({ value: 47, label: { text: "R₁ = 47 Ω" } });

  // The resistor's ends dropped on the source's: one loop, with no point left over.
  const resistor = (await piece(page, "k2"))!;
  const source = (await piece(page, "k1"))!;
  for (const [end, onto] of [
    [resistor.a!, source.a!],
    [resistor.b!, source.b!],
  ]) {
    const from = await centerOf(page, end);
    const to = await centerOf(page, onto);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x + 4, to.y - 3, { steps: 10 });
    await page.mouse.up();
  }
  await expect.poll(() => counts(page)).toMatchObject({ component: 2, point: 2 });
  await expect.poll(async () => new Set([(await piece(page, "k2"))?.a, (await piece(page, "k2"))?.b])).toEqual(new Set([source.a, source.b]));
});

test("an impossible circuit says why instead of switching on", async ({ page }) => {
  await (await circuitTile(page, "Gerador")).click();
  await expect.poll(() => counts(page)).toMatchObject({ component: 1 });
  const source = (await piece(page, "k1"))!;
  // A wire straight across the source's poles.
  await page.locator(`[data-owner="${source.a}"]`).first().click();
  await page.keyboard.down("Shift");
  await page.locator(`[data-owner="${source.b}"]`).first().click();
  await page.keyboard.up("Shift");
  await page.getByRole("region", { name: "Ferramentas" }).getByRole("tab", { name: "Geometria" }).click();
  await page.getByRole("region", { name: "Ferramentas" }).getByRole("button", { name: "Ligar em sequência", exact: true }).click();
  await expect.poll(() => counts(page)).toMatchObject({ segment: 1 });
  await toolbarButton(page, "Circuito").click();
  const on = page.getByRole("menuitem", { name: /Ligar circuito/ });
  await expect(on).toBeDisabled();
  await expect(on).toContainText("curto-circuito");
});

test("filling between shapes: two circles selected, their intersection from Propriedades", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("O=(0;0) P=(1;0)");
  await input.press("Enter");
  await page.locator('[data-owner="p1"]').first().click();
  const tools = page.getByRole("region", { name: "Ferramentas" });
  await tools.getByRole("button", { name: "Circunferência: centro e raio 1", exact: true }).click();
  await page.locator('[data-owner="p2"]').first().click();
  await tools.getByRole("button", { name: "Circunferência: centro e raio 1", exact: true }).click();
  await expect.poll(() => counts(page)).toMatchObject({ circle: 2 });
  // Each by a part of its outline away from the other circle and the points.
  await clickAlong(page, "c1", 0.3);
  await page.keyboard.down("Shift");
  await clickAlong(page, "c2", 0.2);
  await page.keyboard.up("Shift");
  await page.getByRole("tab", { name: "Propriedades" }).click();
  await page.getByRole("tabpanel", { name: "Propriedades" }).getByRole("button", { name: "Preencher a interseção", exact: true }).click();
  await expect.poll(() => counts(page)).toMatchObject({ region: 1, circle: 2 });
  // The fill is selected now: its operation changes in Propriedades.
  await page.getByRole("radio", { name: "União" }).click();
  await expect.poll(async () => ((await savedFigure(page))?.elements.find((e) => e.type === "region") as { expr?: string })?.expr).toBe("S₁∪S₂");
});

test("free text comes from Inserir and is typed after texto:", async ({ page }) => {
  await toolbarButton(page, "Inserir").click();
  await page.getByRole("dialog", { name: "Inserir" }).getByRole("button", { name: /Texto livre/ }).click();
  const input = pointInput(page);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("texto: ");
  await expect(page.getByRole("status").filter({ hasText: "texto: Figura 1" })).toBeVisible();
  await input.pressSequentially("Figura 1");
  await input.press("Enter");
  await expect.poll(() => counts(page)).toMatchObject({ text: 1 });
});
