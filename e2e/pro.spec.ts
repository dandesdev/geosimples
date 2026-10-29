import { expect, test, type Page } from "@playwright/test";
import { counts, leaveInput, pointInput, TRIANGLE } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(pointInput(page)).toBeVisible();
  await page.getByRole("button", { name: "Layout profissional" }).click();
  await expect(page.getByRole("navigation", { name: "Ferramentas" })).toBeVisible();
});

/** Drags a window by its title bar to a point of the page, in small steps like a hand would. */
async function dragWindow(page: Page, title: string, to: { x: number; y: number }) {
  const header = page.getByRole("heading", { name: title, exact: true });
  const box = (await header.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

const windowBox = async (page: Page, title: string) =>
  (await page.getByRole("region", { name: title, exact: true }).boundingBox())!;

test("pro layout: hidden point input, right-click menu, windows that float and dock", async ({ page }) => {
  const viewport = page.viewportSize()!;
  // Windows start docked on the right.
  expect((await windowBox(page, "Propriedades")).x).toBeGreaterThan(viewport.width / 2);

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

  // Dropped over the preview, a window floats; dropped at the left edge, it docks there.
  await dragWindow(page, "Propriedades", { x: viewport.width * 0.4, y: viewport.height * 0.4 });
  const floating = await windowBox(page, "Propriedades");
  expect(floating.x).toBeGreaterThan(100);
  expect(floating.x).toBeLessThan(viewport.width / 2);
  await dragWindow(page, "Propriedades", { x: 60, y: viewport.height / 2 });
  const docked = await windowBox(page, "Propriedades");
  expect(docked.x).toBeLessThan(60);
  expect(docked.height).toBeGreaterThan(viewport.height - 10);

  // Dark theme and the layout survive a reload; the preview stays white.
  await page.getByRole("button", { name: "Tema escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("navigation", { name: "Ferramentas" })).toBeVisible();
  expect((await windowBox(page, "Propriedades")).x).toBeLessThan(60);
  const paper = await page
    .getByRole("region", { name: "Prévia da figura" })
    .locator("svg.bg-white")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(paper).toBe("rgb(255, 255, 255)");
});

test("pro layout: a window minimizes, closes and comes back from Janelas", async ({ page }) => {
  const region = page.getByRole("region", { name: "Formatação", exact: true });
  await region.getByRole("button", { name: "Minimizar" }).click();
  await expect(region.getByRole("button", { name: "Expandir" })).toBeVisible();
  await region.getByRole("button", { name: "Fechar" }).click();
  await expect(region).toHaveCount(0);
  await page.getByRole("button", { name: "Janelas" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Formatação" }).click();
  await page.keyboard.press("Escape");
  await expect(region).toBeVisible();

  // Back to the classic page.
  await page.getByRole("button", { name: "Layout clássico" }).click();
  await expect(page.getByRole("complementary", { name: "Painel" })).toBeVisible();
});
