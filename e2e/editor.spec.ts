import { expect, test } from "@playwright/test";
import {
  addTriangle,
  boxSelectAll,
  clickEmptyCanvas,
  counts,
  leaveInput,
  pointInput,
  savedFigure,
  toolbarButton,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(pointInput(page)).toBeVisible();
});

test("typing points creates points and segments", async ({ page }) => {
  await addTriangle(page);
  expect(await counts(page)).toEqual({ point: 3, segment: 3 });
  await expect(toolbarButton(page, "Exportar")).toBeEnabled();
});

test("box selection, polygon and angles", async ({ page }) => {
  await addTriangle(page);

  await boxSelectAll(page);
  await expect(page.getByText(/Selecionados: 3 pontos, 3 segmentos/)).toBeVisible();

  await toolbarButton(page, "Polígono e preenchimento").click();
  await expect.poll(() => counts(page)).toMatchObject({ polygon: 1 });

  // A fresh box takes the polygon too, which marks all its angles.
  await clickEmptyCanvas(page);
  await boxSelectAll(page);
  await expect(page.getByText(/Selecionados:.*polígono/)).toBeVisible();
  await toolbarButton(page, "Marcar ângulo").click();
  await expect.poll(async () => (await counts(page)).angle ?? 0).toBe(3);
});

test("an unavailable action explains why instead of acting", async ({ page }) => {
  await addTriangle(page);
  await clickEmptyCanvas(page);
  await expect(page.getByText(/^Selecionados:/)).toHaveCount(0);

  const angle = toolbarButton(page, "Marcar ângulo");
  await expect(angle).toHaveAttribute("aria-disabled", "true");
  // aria-disabled keeps the button clickable on purpose; Playwright would wait for it to be enabled.
  await angle.click({ force: true });
  await expect(page.getByRole("tooltip")).toContainText("Selecione três pontos");
  expect((await counts(page)).angle ?? 0).toBe(0);
});

test("undo and redo, with buttons and shortcuts", async ({ page }) => {
  await addTriangle(page);
  await boxSelectAll(page);
  await toolbarButton(page, "Polígono e preenchimento").click();
  await expect.poll(() => counts(page)).toMatchObject({ polygon: 1 });

  const undo = toolbarButton(page, "Desfazer");
  const redo = toolbarButton(page, "Refazer");
  await expect(redo).toBeDisabled();

  await undo.click();
  await expect.poll(async () => (await counts(page)).polygon ?? 0).toBe(0);
  await redo.click();
  await expect.poll(async () => (await counts(page)).polygon ?? 0).toBe(1);

  await leaveInput(page);
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await counts(page)).polygon ?? 0).toBe(0);
  await page.keyboard.press("Control+y");
  await expect.poll(async () => (await counts(page)).polygon ?? 0).toBe(1);

  // Undo all the way back to the empty figure.
  await undo.click();
  await undo.click();
  await expect.poll(async () => (await savedFigure(page))?.elements.length ?? 0).toBe(0);
  await expect(undo).toBeDisabled();
});

test("export dialog shows TikZ code", async ({ page }) => {
  await addTriangle(page);
  await toolbarButton(page, "Exportar").click();

  const dialog = page.getByRole("dialog", { name: "Exportar figura" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Código TikZ" })).toHaveValue(/\\coordinate/);
  await expect(dialog.getByRole("tab", { name: "Imagem PNG" })).toBeVisible();

  await page.keyboard.press("Escape");
  // Shortcuts are ignored while any dialog is in the DOM, including its close animation.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The shortcut opens it again.
  await leaveInput(page);
  await page.keyboard.press("e");
  await expect(dialog).toBeVisible();
});

test("settings dialog opens from the button and the shortcut", async ({ page }) => {
  await page.getByRole("button", { name: "Configurações" }).click();
  const dialog = page.getByRole("dialog", { name: "Configurações" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  // Shortcuts are ignored while any dialog is in the DOM, including its close animation.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await leaveInput(page);
  await page.keyboard.press("Control+,");
  await expect(dialog).toBeVisible();
});

test("settings: a changed default can be saved as a new profile, with help behind ?", async ({ page }) => {
  await page.getByRole("button", { name: "Configurações" }).click();
  const dialog = page.getByRole("dialog", { name: "Configurações" });
  await dialog.getByRole("radio", { name: "Vazado" }).click();

  // Escape closes the help popover first, and only then the dialog.
  await dialog.getByRole("button", { name: "Sobre as alterações não salvas" }).click();
  await expect(page.getByText("já valem para objetos novos")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("já valem para objetos novos")).toHaveCount(0);
  await expect(dialog).toBeVisible();

  await dialog.getByRole("textbox", { name: "Nome da nova configuração" }).fill("Prova");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  const profile = dialog.getByRole("combobox", { name: "Configuração em uso" });
  await expect(profile).toHaveText("Prova");

  await profile.click();
  await page.getByRole("option", { name: "Padrão" }).click();
  await expect(profile).toHaveText("Padrão");
});

test("help dialog opens from the button and the shortcut", async ({ page }) => {
  await page.getByRole("button", { name: "Como usar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Como usar o GeoSimples" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  // Shortcuts are ignored while any dialog is in the DOM, including its close animation.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await leaveInput(page);
  await page.keyboard.press("?");
  await expect(dialog).toBeVisible();
});

test("reload keeps the figure", async ({ page }) => {
  await addTriangle(page);
  await boxSelectAll(page);
  await toolbarButton(page, "Polígono e preenchimento").click();
  await expect.poll(() => counts(page)).toMatchObject({ polygon: 1 });
  const before = await savedFigure(page);

  await page.reload();
  await expect(pointInput(page)).toBeVisible();
  expect(await savedFigure(page)).toEqual(before);
  await expect(toolbarButton(page, "Exportar")).toBeEnabled();
  // The loaded figure is where the undo history starts.
  await expect(toolbarButton(page, "Desfazer")).toBeDisabled();

  await toolbarButton(page, "Exportar").click();
  await expect(page.getByRole("textbox", { name: "Código TikZ" })).toHaveValue(/\\coordinate/);
});
