import { expect, test, type Page } from "@playwright/test";
import { counts, insertItem, pointInput, savedFigure, toolbarButton } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(pointInput(page)).toBeVisible();
});

const circuitOf = async (page: Page) => (await savedFigure(page))?.elements.find((e) => e.type === "circuit");
const piece = async (page: Page, id: string) => (await savedFigure(page))?.elements.find((e) => e.id === id);

test("a ready-made circuit is switched on from its menu, with the current's direction", async ({ page }) => {
  const bar = page.getByRole("toolbar", { name: "Ações da figura" });
  await expect(bar.getByRole("button", { name: "Circuito", exact: true })).toHaveCount(0);
  await insertItem(page, /Circuito em série/);
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

test("a piece goes between two points, and its value changes in Propriedades", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("A=(0;0) B=(4;0)");
  await input.press("Enter");
  await insertItem(page, /Resistor entre pontos/);
  await expect.poll(() => counts(page)).toMatchObject({ component: 1, circuit: 1 });

  // The new piece is selected, so Propriedades shows it.
  const value = page.getByRole("textbox", { name: "Resistência", exact: true });
  await value.fill("47");
  await expect.poll(() => piece(page, "k1")).toMatchObject({ value: 47, label: { text: "R₁ = 47 Ω" } });
});

test("an impossible circuit says why instead of switching on", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("A=(0;0) B=(0;3)");
  await input.press("Enter");
  await insertItem(page, /Gerador entre pontos/);
  // A wire straight across the source's poles.
  await input.fill("A--B");
  await input.press("Enter");
  await toolbarButton(page, "Circuito").click();
  const on = page.getByRole("menuitem", { name: /Ligar circuito/ });
  await expect(on).toBeDisabled();
  await expect(on).toContainText("curto-circuito");
});
