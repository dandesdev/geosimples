import { expect, test } from "@playwright/test";
import { counts, pointInput, toolbarButton } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(pointInput(page)).toBeVisible();
});

test("a function typed in the point input draws its graph with axes, and exports to TikZ", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("f(x)=x^2-1");
  await expect(page.getByText("Gráfico da função. Enter para adicionar.")).toBeVisible();
  await input.press("Enter");
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1 });

  // The toolbar button starts another one, over the same axes.
  await toolbarButton(page, "Gráfico de função").click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("y = ");
  await page.keyboard.type("2sen(x)");
  await input.press("Enter");
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 2 });

  // A mistake is explained instead of drawn.
  await input.fill("y = 2 +");
  await expect(page.getByText(/termina antes da hora/)).toBeVisible();

  await input.fill("");
  await toolbarButton(page, "Exportar").click();
  const tikz = page.getByRole("dialog", { name: "Exportar figura" }).getByRole("textbox", { name: "Código TikZ" });
  await expect(tikz).toHaveValue(/plot coordinates/);
  await expect(tikz).toHaveValue(/\{\$g\$\}/);
});

test("selecting a graph lets its expression and the axes window change", async ({ page }) => {
  await pointInput(page).fill("y=x");
  await pointInput(page).press("Enter");
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1 });
  await page.locator('[data-owner="f1"]').first().click();
  await expect(page.getByText(/Selecionados: 1 gráfico/)).toBeVisible();

  const expr = page.getByRole("textbox", { name: "Expressão da função" });
  await expr.fill("x^2");
  await expr.press("Enter");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem(`geosimples-figure:${JSON.parse(localStorage.getItem("geosimples-library")!).activeId}`)))
    .toContain('"expr":"x^2"');

  // On the x axis, near its arrow, away from the curve.
  const axes = page.locator('[data-owner="e1"]').first();
  const box = (await axes.boundingBox())!;
  await axes.click({ position: { x: box.width * 0.9, y: box.height / 2 } });
  await expect(page.getByText(/Selecionados: 1 par de eixos/)).toBeVisible();
  const xTo = page.getByRole("textbox", { name: "x de: até" });
  await xTo.fill("8");
  await xTo.press("Enter");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem(`geosimples-figure:${JSON.parse(localStorage.getItem("geosimples-library")!).activeId}`)))
    .toMatch(/"domain":\[-5,8\]/);
});
