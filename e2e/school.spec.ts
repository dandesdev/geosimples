import { expect, test } from "@playwright/test";
import { boxSelectAll, counts, pointInput, savedFigure, toolbarButton } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(pointInput(page)).toBeVisible();
});

test("a division typed in the bar is worked out, and can be blanked for a test", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("1234÷5");
  await expect(page.getByText(/já calculado/)).toBeVisible();
  await input.press("Enter");
  await expect.poll(() => counts(page)).toEqual({ board: 1 });

  await page.locator('[data-owner="b1"]').click();
  await page.getByRole("radio", { name: /enunciado armado/ }).click();
  await expect.poll(async () => (await savedFigure(page))?.elements[0]).toMatchObject({ show: "blank" });
});

test("the Contas menu starts an MMC in the input bar", async ({ page }) => {
  await toolbarButton(page, "Contas e quadros").click();
  await page.getByRole("menuitem", { name: /^MMC/ }).click();
  const input = pointInput(page);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("mmc(");
  await page.keyboard.type("12;18)");
  await input.press("Enter");
  await expect.poll(() => counts(page)).toEqual({ board: 1 });
});

test("a mistake in a board is explained instead of drawn", async ({ page }) => {
  await pointInput(page).fill("5÷0");
  await expect(page.getByText("Não existe divisão por zero.")).toBeVisible();
});

test("vectors typed in the bar add up by the parallelogram rule from the menu", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("vetor u=(4;1)");
  await input.press("Enter");
  await input.fill("vetor v=(1;3)");
  await input.press("Enter");
  await expect.poll(async () => (await counts(page)).vector).toBe(2);

  await boxSelectAll(page);
  await toolbarButton(page, "Vetores").click();
  await page.getByRole("menuitem", { name: /Soma \(paralelogramo\)/ }).click();
  await expect.poll(async () => (await counts(page)).vector).toBe(3);
  await expect.poll(async () => (await counts(page)).segment).toBe(2);
});

test("a Venn diagram takes its elements and a shaded region", async ({ page }) => {
  await toolbarButton(page, "Conjuntos").click();
  await page.getByRole("menuitem", { name: /Diagrama com 2 conjuntos/ }).click();
  await expect.poll(async () => (await counts(page)).circle).toBe(2);

  const input = pointInput(page);
  await input.fill("A={1,2,3}");
  await input.press("Enter");
  await expect.poll(async () => (await counts(page)).vennitems).toBe(1);

  await input.fill("região A∩B");
  await input.press("Enter");
  await expect.poll(async () => (await counts(page)).region).toBe(1);
});
