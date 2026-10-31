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

  // On the x axis, at x = 3.5, away from the curve: the path runs along x, then up y.
  await clickAlong(page, "e1", 0.25);
  await expect(page.getByText(/Selecionados: 1 par de eixos/)).toBeVisible();
  const xTo = page.getByRole("textbox", { name: "x de: até" });
  await xTo.fill("8");
  await xTo.press("Enter");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem(`geosimples-figure:${JSON.parse(localStorage.getItem("geosimples-library")!).activeId}`)))
    .toMatch(/"domain":\[-3,8\]/);
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

test("typing a domain end keystroke by keystroke keeps the roots the half-typed value would lose", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("y=x^2-9");
  await input.press("Enter");
  await toolbarButton(page, "Gráficos").click();
  await page.getByRole("menuitem", { name: /Raízes/ }).click();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 2 });
  await clickAlong(page, "f1", 0.85);
  await expect(page.getByText(/Selecionados: 1 gráfico/)).toBeVisible();
  // "1" on the way to "10" would cut the domain to [-5; 1], past the root at 3.
  const to = page.getByRole("textbox", { name: "x de: até" });
  await to.click();
  await to.press("ControlOrMeta+a");
  await page.keyboard.type("10", { delay: 120 });
  await to.press("Enter");
  await page.waitForTimeout(1500);
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 2 });
  await expect(page.getByText(/foram apagados|foi apagado/)).toHaveCount(0);
});

test("undo and redo right after typing keep only settled figures in the history", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("y=x^2-9");
  await input.press("Enter");
  await toolbarButton(page, "Gráficos").click();
  await page.getByRole("menuitem", { name: /Raízes/ }).click();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 2 });
  await clickAlong(page, "f1", 0.85);
  const to = page.getByRole("textbox", { name: "x de: até" });
  await to.click();
  await to.press("ControlOrMeta+a");
  // [-5; 1] loses the root at 3, and Desfazer comes before the typing's settle would.
  await page.keyboard.type("1");
  await toolbarButton(page, "Desfazer").click();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 2 });
  await toolbarButton(page, "Refazer").click();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 1 });
  await page.waitForTimeout(1500);
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 1 });
});

test("the same mark deleted again after an undo is reported again", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("y=x^2-9");
  await input.press("Enter");
  await toolbarButton(page, "Gráficos").click();
  await page.getByRole("menuitem", { name: /Raízes/ }).click();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 2 });
  await clickAlong(page, "f1", 0.85);
  const to = page.getByRole("textbox", { name: "x de: até" });
  const cut = async () => {
    await to.click();
    await to.press("ControlOrMeta+a");
    await page.keyboard.type("1");
    await expect(page.getByText("x₂ foi apagado: o que marcava deixou de existir.")).toBeVisible();
    await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 1 });
  };
  await cut();
  await toolbarButton(page, "Desfazer").click();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 2 });
  await expect(page.getByText("x₂ foi apagado: o que marcava deixou de existir.")).toHaveCount(0, { timeout: 10_000 });
  await cut();
});

test("slow typing in a field and a quick switch to another keep each mark's single report", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("y=x^2-9");
  await input.press("Enter");
  await toolbarButton(page, "Gráficos").click();
  await page.getByRole("menuitem", { name: /Raízes/ }).click();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 2 });
  await clickAlong(page, "f1", 0.85);
  const to = page.getByRole("textbox", { name: "x de: até" });
  // A pause between keys longer than the 300 ms autosave: "1" on the way to "10" still keeps x₂.
  await to.click();
  await to.press("ControlOrMeta+a");
  await page.keyboard.type("10", { delay: 450 });
  await page.waitForTimeout(1500);
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 2 });

  // "2" cuts the root at 3; going straight to another field settles it once, without bringing x₂ back.
  await to.press("ControlOrMeta+a");
  await page.keyboard.type("2");
  // The y cut is another field (another undo key): typing there settles the domain edit first.
  const top = page.getByRole("textbox", { name: "Cortar y de: até" });
  await top.click();
  await top.press("ControlOrMeta+a");
  await page.keyboard.type("6");
  await page.waitForTimeout(1500);
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 1 });
  // Counted once, not waited on: the first toast fading would hide a second one.
  expect(await page.getByText("x₂ foi apagado: o que marcava deixou de existir.").count()).toBe(1);
});

test("a crossing dragged away hides while the drag lasts, and is deleted only if it's still gone at the drop", async ({ page }) => {
  const input = pointInput(page);
  for (const text of ["y=x^2", "A=(-2;1)--B=(2;1)"]) {
    await input.fill(text);
    await input.press("Enter");
  }
  await leaveInput(page);
  await clickAlong(page, "f1", 0.9);
  await page.keyboard.down("Shift");
  await clickAlong(page, "s1", 0.1);
  await page.keyboard.up("Shift");
  await toolbarButton(page, "Construções").click();
  await page.getByRole("menuitem", { name: /Interseção/ }).click();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 4, segment: 1, extension: 2 });
  const crossings = page.locator('[data-owner="p3"], [data-owner="p4"]');
  await expect(crossings).not.toHaveCount(0);

  // Both ends move together: the segment slides down, 4 units long.
  await page.locator('[data-owner="p1"]').first().click();
  await page.keyboard.down("Shift");
  await page.locator('[data-owner="p2"]').first().click();
  await page.keyboard.up("Shift");
  await page.keyboard.press("M");
  const a = (await page.locator('[data-owner="p1"]').first().boundingBox())!;
  const b = (await page.locator('[data-owner="p2"]').first().boundingBox())!;
  const unit = (b.x - a.x) / 4;
  const from = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // Below the vertex, y = -1: no crossing, so none is drawn, not even where it was.
  await page.mouse.move(from.x + 0.2 * unit, from.y + 2 * unit, { steps: 8 });
  await expect(crossings).toHaveCount(0);
  // Back above it, they come back.
  await page.mouse.move(from.x + 0.2 * unit, from.y + 0.5 * unit, { steps: 8 });
  await expect(crossings).not.toHaveCount(0);
  await page.mouse.move(from.x + 0.2 * unit, from.y + 2 * unit, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText(/foram apagados: o que marcavam deixou de existir/)).toBeVisible();
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 2, segment: 1 });
});

test("a segment slid past a crossing reaches it with a dashed extension that can be styled", async ({ page }) => {
  const input = pointInput(page);
  for (const text of ["y=x^2", "A=(-2;1)--B=(2;1)"]) {
    await input.fill(text);
    await input.press("Enter");
  }
  await leaveInput(page);
  await clickAlong(page, "f1", 0.9);
  await page.keyboard.down("Shift");
  await clickAlong(page, "s1", 0.1);
  await page.keyboard.up("Shift");
  await toolbarButton(page, "Construções").click();
  await page.getByRole("menuitem", { name: /Interseção/ }).click();
  // Over the segment, the crossings need no extension.
  await expect(page.locator('[data-owner^="x"]')).toHaveCount(0);

  await page.locator('[data-owner="p1"]').first().click();
  await page.keyboard.down("Shift");
  await page.locator('[data-owner="p2"]').first().click();
  await page.keyboard.up("Shift");
  await page.keyboard.press("M");
  const a = (await page.locator('[data-owner="p1"]').first().boundingBox())!;
  const b = (await page.locator('[data-owner="p2"]').first().boundingBox())!;
  const unit = (b.x - a.x) / 4;
  const from = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 2 * unit, from.y, { steps: 8 });
  await page.mouse.up();
  // A is now at x = 0, right of the crossing at x = -1: the line reaches it, dashed.
  await expect.poll(() => counts(page)).toEqual({ axes: 1, function: 1, point: 4, segment: 1, extension: 2 });
  const extension = page.locator('[data-owner="x1"]');
  await expect(extension).not.toHaveCount(0);

  await page.keyboard.press("V");
  await clickAlong(page, "x1", 0.5);
  await expect(page.getByText(/^Prolongamento de AB até /).first()).toBeVisible();
  await expect(page.getByText("Traço do prolongamento")).toBeVisible();
});

test("axes come in without a graph, fit the figure as it grows, and stop when their window is set", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("A=(1;1)--B=(7;1)--C=(1;4)--");
  await input.press("Enter");
  await toolbarButton(page, "Gráficos").click();
  await page.getByRole("menuitem", { name: /^Eixos/ }).click();
  const axes = async () => (await savedFigure(page))?.elements.find((e) => e.type === "axes") as unknown as { x: number[]; y: number[]; fit?: boolean };
  await expect.poll(async () => (await axes())?.x).toEqual([-1, 8]);
  expect((await axes()).y).toEqual([-1, 5]);

  await toolbarButton(page, "Gráficos").click();
  await page.getByRole("menuitem", { name: /Malha quadriculada/ }).click();
  await expect.poll(() => counts(page)).toMatchObject({ axes: 1, grid: 1 });

  // A point further right: the axes reach it.
  await input.fill("D=(10;1)");
  await input.press("Enter");
  await expect.poll(async () => (await axes())?.x).toEqual([-1, 11]);

  await leaveInput(page);
  await clickAlong(page, "e1", 0.05);
  await expect(page.getByText(/Selecionados: 1 par de eixos/)).toBeVisible();
  await expect(page.getByRole("switch", { name: "Ajustar à figura" })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Malha quadriculada" })).toBeChecked();
  const xTo = page.getByRole("textbox", { name: "x de: até" });
  await xTo.fill("14");
  await xTo.press("Enter");
  await expect.poll(async () => (await axes())?.fit).toBe(false);
  expect((await axes()).x).toEqual([-1, 14]);
  await expect(page.getByRole("switch", { name: "Ajustar à figura" })).not.toBeChecked();
});

test("Mover drags the ends of the axes and whole segments", async ({ page }) => {
  const input = pointInput(page);
  for (const text of ["y=x", "A=(1;1)--B=(3;1)"]) {
    await input.fill(text);
    await input.press("Enter");
  }
  await leaveInput(page);
  await page.keyboard.press("M");
  const saved = async () => (await savedFigure(page))?.elements as unknown as { id: string; x: number | number[]; y: number | number[]; fit?: boolean; domain?: number[] }[];
  // A tap on a handle selects the axes and leaves them fitting.
  await page.locator('[data-handle="e1:x1"]').click();
  await expect(page.getByText(/Selecionados: 1 par de eixos/)).toBeVisible();
  await expect.poll(async () => (await saved())?.find((e) => e.id === "e1")?.fit).toBe(true);
  const x0 = (await page.locator('[data-handle="e1:x0"]').boundingBox())!;
  const x1 = (await page.locator('[data-handle="e1:x1"]').boundingBox())!;
  const win = (await saved()).find((e) => e.id === "e1")!.x as number[];
  const unit = (x1.x - x0.x) / (win[1] - win[0]);
  await page.mouse.move(x1.x + x1.width / 2, x1.y + x1.height / 2);
  await page.mouse.down();
  await page.mouse.move(x1.x + x1.width / 2 + 2.2 * unit, x1.y + x1.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await saved()).find((e) => e.id === "e1")?.x).toEqual([win[0], win[1] + 2]);
  expect((await saved()).find((e) => e.id === "e1")?.fit).toBe(false);
  expect((await saved()).find((e) => e.id === "f1")?.domain).toEqual([win[0], win[1] + 2]);

  // A press on the segment drags both its ends.
  const at = await page.locator('[data-owner="s1"] path').last().evaluate((el) => {
    const path = el as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() / 2);
    const m = path.getScreenCTM()!;
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
  });
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x, at.y - unit, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await saved()).filter((e) => e.id === "p1" || e.id === "p2").map((p) => [p.x, p.y])).toEqual([
    [1, 2],
    [3, 2],
  ]);
});

test("a smaller scale in y fits a steep graph whole", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("y=x^2");
  await input.press("Enter");
  await leaveInput(page);
  await clickAlong(page, "e1", 0.05);
  await expect(page.getByText(/Selecionados: 1 par de eixos/)).toBeVisible();
  const yUnit = page.getByRole("textbox", { name: "Centímetros por unidade em y" });
  await yUnit.fill("0,2");
  await yUnit.press("Enter");
  const axes = async () => (await savedFigure(page))?.elements.find((e) => e.type === "axes") as unknown as { y: number[]; unit?: number[]; yStep?: number };
  await expect.poll(async () => (await axes())?.unit).toEqual([1, 0.2]);
  expect(await axes()).toMatchObject({ y: [-5, 15], yStep: 5 });
});

test("graph ends follow the pointer in Mover, and land on a tick near one with Encaixar na grade", async ({ page }) => {
  const input = pointInput(page);
  await input.fill("y=x");
  await input.press("Enter");
  await leaveInput(page);
  await page.keyboard.press("M");
  const snap = page.getByRole("button", { name: "Encaixar na grade" });
  await expect(snap).toHaveAttribute("aria-pressed", "true");
  await clickAlong(page, "f1", 0.5);
  await expect(page.getByText(/Selecionados: 1 gráfico/)).toBeVisible();
  const handle = (end: string) => page.locator(`[data-handle="f1:${end}"]`);
  const domain = async () => ((await saved(page, "f1")) as { domain: number[] } | null)?.domain;
  // Where the handles are now: the axes and the view refit after each drop.
  const drag = async (end: string, by: number) => {
    const [a, z] = (await domain())!;
    const unit = ((await handle("x1").boundingBox())!.x - (await handle("x0").boundingBox())!.x) / (z - a);
    const b = (await handle(end).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + by * unit, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
  };

  // Off: the end stays where it's let go, between ticks.
  await snap.click();
  await expect(snap).toHaveAttribute("aria-pressed", "false");
  await drag("x0", 2.3);
  await expect.poll(async () => (await domain())?.[0]).toBeCloseTo(-0.7, 1);
  // On: an end let go close to a tick goes to it.
  await page.keyboard.press("Shift+S");
  await expect(snap).toHaveAttribute("aria-pressed", "true");
  await drag("x1", -1.04);
  await expect.poll(async () => (await domain())?.[1]).toBe(2);
});
