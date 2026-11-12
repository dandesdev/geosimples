import { expect, test } from "@playwright/test";
import { boxSelectAll, counts, insertItem, leaveInput, pointInput, savedFigure, toolbarButton } from "./helpers";

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
  await insertItem(page, /^MMC/);
  const input = pointInput(page);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("mmc(");
  await page.keyboard.type("12;18)");
  await input.press("Enter");
  await expect.poll(() => counts(page)).toEqual({ board: 1 });
});

test("Inserir opens with I, finds an item by search, and Enter starts it", async ({ page }) => {
  await leaveInput(page);
  await page.keyboard.press("i");
  const catalog = page.getByRole("dialog", { name: "Inserir" });
  await expect(catalog).toBeVisible();
  await page.keyboard.type("minimo multiplo");
  await expect(catalog.getByRole("button")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(catalog).toBeHidden();
  const input = pointInput(page);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("mmc(");
});

test("menus for vectors and sets show only when the selection can use them", async ({ page }) => {
  const bar = page.getByRole("toolbar", { name: "Ações da figura" });
  await expect(bar.getByRole("button", { name: "Vetores", exact: true })).toHaveCount(0);
  await expect(bar.getByRole("button", { name: "Conjuntos", exact: true })).toHaveCount(0);
  await insertItem(page, /Diagrama com 2 conjuntos/);
  await expect(toolbarButton(page, "Conjuntos")).toBeVisible();

  const input = pointInput(page);
  await input.fill("vetor u=(4;1)");
  await input.press("Enter");
  await boxSelectAll(page);
  await expect(toolbarButton(page, "Vetores")).toBeVisible();
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
  await insertItem(page, /Diagrama com 2 conjuntos/);
  await expect.poll(async () => (await counts(page)).circle).toBe(2);

  const input = pointInput(page);
  await input.fill("A={1,2,3}");
  await input.press("Enter");
  await expect.poll(async () => (await counts(page)).vennitems).toBe(1);

  await input.fill("região A∩B");
  await input.press("Enter");
  await expect.poll(async () => (await counts(page)).region).toBe(1);
});

test("set operations are buttons, and letters stand in for the symbols when typing", async ({ page }) => {
  await insertItem(page, /Diagrama com 2 conjuntos/);
  await toolbarButton(page, "Conjuntos").click();
  await page.getByRole("menuitem", { name: /^Interseção/ }).click();
  await expect.poll(async () => (await counts(page)).region).toBe(1);

  const input = pointInput(page);
  await input.fill("região A U B");
  await expect(page.getByRole("button", { name: /União/ })).toBeVisible();
  await input.press("Enter");
  await expect.poll(async () => (await counts(page)).region).toBe(2);
});

test("the symbol buttons type where the caret is", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("região A B");
  await input.press("ArrowLeft");
  await page.getByRole("button", { name: /Interseção \(ou digite n\)/ }).click();
  await expect(input).toHaveValue("região A ∩B");
});

test("the guide says what wasn't typed: what was there before, and what is done after by tapping", async ({ page }) => {
  await page.goto("/guia.html");
  const point = page.getByRole("figure").filter({ hasText: "Um ponto com nome" });
  await expect(point.getByText("Antes de digitar:")).toBeVisible();
  await expect(point).toContainText("Inserir › Eixos");
  const intersection = page.getByRole("figure").filter({ hasText: "A interseção, escrita com a letra n" });
  await expect(intersection.getByText("Depois, no editor:")).toBeVisible();
  await expect(intersection).toContainText("Uma linha de cada vez");
});

test("the starting example closes for the visit, or for good", async ({ page }) => {
  const card = page.getByRole("heading", { name: "Comece pelos pontos" });
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(card).toBeHidden();
  await page.reload();
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "Não mostrar mais" }).click();
  await expect(card).toBeHidden();
  await page.reload();
  await expect(pointInput(page)).toBeVisible();
  await expect(card).toBeHidden();
});

test("the guide's examples run as they are edited, and explain mistakes", async ({ page }) => {
  await page.goto("/guia.html");
  const line = page.getByRole("textbox", { name: /Uma parábola/ });
  await expect(line).toHaveValue("f(x)=x^2-1");
  const figure = page.getByRole("figure").filter({ has: line }).getByTestId("guide-figure");
  const before = await figure.innerHTML();
  await line.fill("f(x)=2x+1");
  await expect.poll(() => figure.innerHTML()).not.toBe(before);
  await line.fill("f(x)=2 +");
  await expect(page.getByText(/termina antes da hora/)).toBeVisible();
  await page.getByRole("figure").filter({ has: line }).getByRole("button", { name: "Voltar ao exemplo" }).click();
  await expect(line).toHaveValue("f(x)=x^2-1");
});

test("every example in the guide draws without a mistake", async ({ page }) => {
  await page.goto("/guia.html");
  await expect(page.getByRole("heading", { name: "Guia da barra de entrada" })).toBeVisible();
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
});

test("the input help links to the guide", async ({ page }) => {
  await page.getByRole("button", { name: "Como digitar" }).click();
  await expect(page.getByRole("tooltip").getByRole("link", { name: /Mais explicações/ })).toHaveAttribute("href", "/guia.html");
});

test("gaps are picked by clicking the numbers, and can hold a text", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("1234÷5");
  await input.press("Enter");
  await page.locator('[data-owner="b1"]').click();
  await page.getByRole("radio", { name: /completar/ }).click();
  await page.getByRole("button", { name: "Nenhuma", exact: true }).click();
  await expect.poll(async () => (await savedFigure(page))?.elements[0]).toMatchObject({ show: "gaps", gaps: [] });
  // The statement's digits can be gaps too, as in exercises that give the result.
  await page.getByRole("button", { name: "Parte 1: virar lacuna" }).click();
  await page.getByRole("button", { name: "Parte 3: virar lacuna" }).click();
  await expect.poll(async () => (await savedFigure(page))?.elements[0]).toMatchObject({ gaps: [0, 2] });
  await page.getByRole("button", { name: "Lacuna 1: mostrar de novo" }).click();
  await expect.poll(async () => (await savedFigure(page))?.elements[0]).toMatchObject({ gaps: [2] });
  await page.getByRole("radio", { name: /texto no lugar/ }).click();
  await page.getByRole("textbox", { name: "Texto da lacuna" }).fill("?");
  await expect.poll(async () => (await savedFigure(page))?.elements[0]).toMatchObject({ gapStyle: "text", gapText: "?" });
});

test("the sign of a column operation goes to the right, and >= becomes ≥ as it is typed", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("58+67");
  await input.press("Enter");
  await page.locator('[data-owner="b1"]').click();
  await page.getByRole("radio", { name: /depois dos números/ }).click();
  await expect.poll(async () => (await savedFigure(page))?.elements[0]).toMatchObject({ signSide: "right" });

  await input.click();
  await input.fill("");
  await page.keyboard.type("sinal x^2-4 >= 0");
  await expect(input).toHaveValue("sinal x^2-4 ≥ 0");
  await input.press("Enter");
  await expect.poll(async () => (await counts(page)).board).toBe(2);
});
