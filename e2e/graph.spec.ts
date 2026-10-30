import { expect, test } from "@playwright/test";
import { boxSelectAll, clickAlong, counts, leaveInput, pointInput, savedFigure, toolbarButton } from "./helpers";

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

  // The Gráficos menu starts another one, over the same axes.
  await toolbarButton(page, "Gráficos").click();
  await page.getByRole("menuitem", { name: /Nova função/ }).click();
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

test("a half-typed expression stays with its graph when another one is selected", async ({ page }) => {
  for (const f of ["y=x", "y=-x"]) {
    await pointInput(page).fill(f);
    await pointInput(page).press("Enter");
  }
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 2 });
  // Each line crosses its box corner to corner: y = x up to the right, y = -x up to the left.
  const clickOn = async (id: string, fx: number) => {
    const line = page.locator(`[data-owner="${id}"]`).first();
    const box = (await line.boundingBox())!;
    await line.click({ position: { x: box.width * fx, y: box.height * 0.25 } });
  };
  await clickOn("f1", 0.75);
  const expr = page.getByRole("textbox", { name: "Expressão da função" });
  await expect(expr).toHaveValue("x");
  await expr.fill("x +");
  await clickOn("f2", 0.25);
  await expect(page.getByText(/Selecionados: 1 gráfico/)).toBeVisible();
  await expect(expr).toHaveValue("-x");
});

/** The saved element with this id, with whatever fields it has. */
async function saved(page: import("@playwright/test").Page, id: string) {
  const doc = await savedFigure(page);
  return (doc?.elements.find((e) => e.id === id) ?? null) as Record<string, unknown> | null;
}

test("vertical lines and points on graphs are typed in the input bar", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("y=x");
  await input.press("Enter");
  await input.fill("x = 2");
  await expect(page.getByText("Reta vertical. Enter para adicionar.")).toBeVisible();
  await input.press("Enter");
  await input.fill("P = f(1)");
  await expect(page.getByText("Ponto sobre o gráfico. Enter para adicionar.")).toBeVisible();
  await input.press("Enter");
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, vline: 1, point: 1 });
  await expect.poll(() => saved(page, "p1")).toMatchObject({ x: 1, y: 1, construction: { kind: "onGraph", graph: "f1", x: 1 } });

  // The point follows the graph when its expression changes.
  await page.locator('[data-owner="p1"]').click();
  await expect(page.getByText(/Selecionados: 1 ponto/)).toBeVisible();
  await expect(page.getByText(/No gráfico de f/)).toBeVisible();
  // y = x crosses its box corner to corner.
  const curve = page.locator('[data-owner="f1"]').first();
  const box = (await curve.boundingBox())!;
  await curve.click({ position: { x: box.width * 0.75, y: box.height * 0.25 } });
  await expect(page.getByText(/Selecionados: 1 gráfico/)).toBeVisible();
  const expr = page.getByRole("textbox", { name: "Expressão da função" });
  await expr.fill("x + 1");
  await expr.press("Enter");
  await expect.poll(() => saved(page, "p1")).toMatchObject({ x: 1, y: 2 });
});

test("the Gráficos menu puts a point on the selected graph, with lines to the axes", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("y=x");
  await input.press("Enter");
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1 });
  // Without a graph selected, the item says what it needs.
  await leaveInput(page);
  await page.keyboard.press("Escape");
  await toolbarButton(page, "Gráficos").click();
  await expect(page.getByRole("menuitem", { name: /Ponto sobre o gráfico/ })).toBeDisabled();
  await page.keyboard.press("Escape");

  const line = page.locator('[data-owner="f1"]').first();
  const box = (await line.boundingBox())!;
  await line.click({ position: { x: box.width * 0.75, y: box.height * 0.25 } });
  await expect(page.getByText(/Selecionados: 1 gráfico/)).toBeVisible();
  await toolbarButton(page, "Gráficos").click();
  await page.getByRole("menuitem", { name: /Ponto sobre o gráfico/ }).click();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 1 });

  // The new point is selected: its x moves it along the graph.
  const x = page.getByRole("textbox", { name: "x do ponto no gráfico" });
  await x.fill("3");
  await x.press("Enter");
  await expect.poll(() => saved(page, "p1")).toMatchObject({ x: 3, y: 3 });

  await toolbarButton(page, "Gráficos").click();
  await page.getByRole("menuitem", { name: /Linhas até os eixos/ }).click();
  await expect.poll(() => saved(page, "p1")).toMatchObject({ guides: { dash: "dashed" } });
  await expect(page.getByRole("switch", { name: "Linhas até os eixos" })).toBeChecked();
});

test("in Adicionar pontos, a click on a curve puts the point on the graph", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("y=x");
  await input.press("Enter");
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1 });
  await leaveInput(page);
  await toolbarButton(page, "Adicionar pontos").click();
  const line = page.locator('[data-owner="f1"]').first();
  const box = (await line.boundingBox())!;
  await line.click({ position: { x: box.width * 0.75, y: box.height * 0.25 } });
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 1 });
  const point = (await saved(page, "p1"))!;
  expect(point.construction).toMatchObject({ kind: "onGraph", graph: "f1" });
  expect(point.y).toBeCloseTo(point.x as number, 6);
});

test("axes count x in π, and graph ends get open or closed dots", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("y=sen(x)");
  await input.press("Enter");
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1 });

  // sen x crosses the middle of its box at the origin.
  const curve = page.locator('[data-owner="f1"]').first();
  const curveBox = (await curve.boundingBox())!;
  await curve.click({ position: { x: curveBox.width * 0.5, y: curveBox.height * 0.5 } });
  await expect(page.getByText(/Selecionados: 1 gráfico/)).toBeVisible();
  await page.getByRole("group", { name: "No início" }).getByRole("radio", { name: "Bolinha aberta" }).click();
  await expect.poll(() => saved(page, "f1")).toMatchObject({ ends: ["open", "none"] });

  const axes = page.locator('[data-owner="e1"]').first();
  const box = (await axes.boundingBox())!;
  await axes.click({ position: { x: box.width * 0.9, y: box.height / 2 } });
  await expect(page.getByText(/Selecionados: 1 par de eixos/)).toBeVisible();
  await page.getByRole("radio", { name: "Múltiplos de π" }).click();
  await expect.poll(() => saved(page, "e1")).toMatchObject({ xPi: 0.5 });

  await toolbarButton(page, "Exportar").click();
  const tikz = page.getByRole("dialog", { name: "Exportar figura" }).getByRole("textbox", { name: "Código TikZ" });
  await expect(tikz).toHaveValue(/\{\$\\pi \/2\$\}/);
  await expect(tikz).toHaveValue(/fill=white/);
});

test("Escape leaves the input bar and drops an untouched y = ", async ({ page }) => {
  const input = pointInput(page);
  await toolbarButton(page, "Gráficos").click();
  await page.getByRole("menuitem", { name: /Nova função/ }).click();
  await expect(input).toHaveValue("y = ");
  await input.press("Escape");
  await expect(input).not.toBeFocused();
  await expect(input).toHaveValue("");

  // Typed text stays.
  await input.fill("A=(1;1)");
  await input.press("Escape");
  await expect(input).not.toBeFocused();
  await expect(input).toHaveValue("A=(1;1)");
});

test("roots follow the formula, and go away with a way back when it has none", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("y=x^2-1");
  await input.press("Enter");
  // The new graph comes in selected.
  await toolbarButton(page, "Gráficos").click();
  await page.getByRole("menuitem", { name: /Raízes/ }).click();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 2 });

  await clickAlong(page, "f1", 0.85);
  await expect(page.getByText(/Selecionados: 1 gráfico/)).toBeVisible();
  const expr = page.getByRole("textbox", { name: "Expressão da função" });
  await expr.fill("x^2-4");
  await expr.press("Enter");
  await expect.poll(async () => (await saved(page, "p1"))?.x).toBe(-2);

  await expr.fill("x^2+1");
  await expr.press("Enter");
  await expect(page.getByText("x₁ e x₂ foram apagados: o que marcavam deixou de existir.")).toBeVisible();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1 });
  await page.getByRole("button", { name: "Desfazer" }).last().click();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 2 });
});

test("two graphs cross through Construções › Interseção", async ({ page }) => {
  const input = pointInput(page);
  for (const f of ["y=x", "y=2-x"]) {
    await input.fill(f);
    await input.press("Enter");
  }
  await leaveInput(page);
  await boxSelectAll(page);
  await toolbarButton(page, "Construções").click();
  await page.getByRole("menuitem", { name: /Interseção/ }).click();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 2, point: 1 });
  const doc = (await savedFigure(page))!;
  expect(doc.elements.find((e) => e.type === "point")).toMatchObject({ x: 1, y: 1 });
});

test("a number line takes intervals typed in the input bar", async ({ page }) => {
  const input = pointInput(page);
  await toolbarButton(page, "Gráficos").click();
  await page.getByRole("menuitem", { name: /Reta numérica/ }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("[");
  await page.keyboard.type("-2; 3[");
  await expect(page.getByText("Intervalo na reta numérica. Enter para adicionar.")).toBeVisible();
  await input.press("Enter");
  await expect.poll(() => counts(page)).toEqual({ numberline: 1, segment: 1, point: 2 });
  const doc = (await savedFigure(page))!;
  const shapes = (doc.elements as unknown as { type: string; shape?: string }[]).filter((e) => e.type === "point").map((e) => e.shape);
  expect(shapes).toEqual(["dot", "ring"]);
});

test("a square turns into four functions", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("A=(0;0)--B=(1;0)--C=(1;1)--D=(0;1)--");
  await input.press("Enter");
  await expect.poll(() => counts(page)).toEqual({ point: 4, segment: 4 });
  await leaveInput(page);
  await boxSelectAll(page);
  await toolbarButton(page, "Gráficos").click();
  await page.getByRole("menuitem", { name: /Transformar em funções/ }).click();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, point: 4, function: 2, vline: 2 });
  const doc = (await savedFigure(page))!;
  const exprs = (doc.elements as unknown as { type: string; expr?: string; x?: number }[])
    .filter((e) => e.type === "function" || e.type === "vline")
    .map((e) => e.expr ?? `x = ${e.x}`);
  expect(exprs).toEqual(["0", "x = 1", "1", "x = 0"]);
});
