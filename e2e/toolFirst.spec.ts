import { expect, test, type Page } from "@playwright/test";
import { addTriangle, counts, leaveInput } from "./helpers";

/* Tools chosen before what they work on: they wait for clicks in the preview, then run. */

/** A tile of the Ferramentas panel (the classic toolbar has some of the same buttons). */
const tile = (page: Page, name: string) => page.getByRole("region", { name: "Ferramentas" }).getByRole("button", { name, exact: true });
const preview = (page: Page) => page.getByRole("region", { name: "Prévia da figura" });
const finish = (page: Page) => page.getByRole("button", { name: "Concluir" });
/** The center of the figure's object `id` on the screen. */
async function centerOf(page: Page, id: string) {
  const b = (await page.locator(`[data-owner="${id}"]`).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
/** A spot in the preview, as fractions of its size. */
async function spot(page: Page, fx: number, fy: number) {
  const b = (await preview(page).boundingBox())!;
  return { x: b.x + b.width * fx, y: b.y + b.height * fy };
}
async function clickAt(page: Page, at: { x: number; y: number }) {
  await page.mouse.move(at.x, at.y);
  await page.mouse.click(at.x, at.y);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
});

test("Ligar chosen first draws a path: empty spots become points, the first point closes it, Esc ends the tool", async ({ page }) => {
  await tile(page, "Ligar em sequência").click();
  await expect(tile(page, "Ligar em sequência")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Ligar em sequência:.*Esc termina/)).toBeVisible();

  const spots = [await spot(page, 0.3, 0.7), await spot(page, 0.7, 0.7), await spot(page, 0.5, 0.3)];
  await clickAt(page, spots[0]);
  // From the first point on, the pointer drags a ghost of the next segment.
  await page.mouse.move(spots[1].x - 40, spots[1].y - 40);
  await expect(preview(page).locator('svg g[pointer-events="none"] path').first()).toBeAttached();
  await clickAt(page, spots[1]);
  await clickAt(page, spots[2]);
  await expect.poll(() => counts(page)).toMatchObject({ point: 3, segment: 2 });

  await clickAt(page, await centerOf(page, "p1"));
  await expect.poll(() => counts(page)).toMatchObject({ point: 3, segment: 3 });

  await page.keyboard.press("Escape");
  await expect(finish(page)).toHaveCount(0);
  await expect(tile(page, "Ligar em sequência")).not.toHaveAttribute("aria-pressed", "true");
});

test("a double click on an empty spot ends Ligar", async ({ page }) => {
  await tile(page, "Ligar em sequência").click();
  await clickAt(page, await spot(page, 0.3, 0.6));
  const end = await spot(page, 0.6, 0.6);
  await page.mouse.move(end.x, end.y);
  await page.mouse.dblclick(end.x, end.y);
  await expect(finish(page)).toHaveCount(0);
  await expect.poll(() => counts(page)).toMatchObject({ point: 2, segment: 1 });
});

test("constructions chosen first wait for their objects and run once they have them", async ({ page }) => {
  await addTriangle(page);
  await leaveInput(page);
  await page.keyboard.press("Escape");

  // Ponto médio: one click on a side is enough.
  await tile(page, "Ponto médio").click();
  await clickAt(page, await centerOf(page, "s1"));
  await expect.poll(() => counts(page)).toMatchObject({ point: 4 });
  // The tool stays on for another.
  await expect(finish(page)).toBeVisible();
  await finish(page).click();

  // Ângulo: three points, the vertex in the middle; nothing happens before the third.
  await tile(page, "Marcar ângulo").click();
  await clickAt(page, await centerOf(page, "p2"));
  await clickAt(page, await centerOf(page, "p1"));
  expect((await counts(page)).angle).toBeUndefined();
  await clickAt(page, await centerOf(page, "p3"));
  await expect.poll(() => counts(page)).toMatchObject({ angle: 1 });
});

test("a circle chosen first puts its center on an empty spot", async ({ page }) => {
  await tile(page, "Circunferência: centro e raio 1").click();
  await clickAt(page, await spot(page, 0.5, 0.5));
  await expect.poll(() => counts(page)).toMatchObject({ point: 1, circle: 1 });
});

test("with the objects already selected, a tool runs at once, as before", async ({ page }) => {
  await addTriangle(page);
  await leaveInput(page);
  await page.keyboard.press("Escape");
  await clickAt(page, await centerOf(page, "s1"));
  await tile(page, "Ponto médio").click();
  await expect.poll(() => counts(page)).toMatchObject({ point: 4 });
  await expect(finish(page)).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a tool chosen first takes taps, and Concluir ends it", async ({ page }) => {
    await tile(page, "Ligar em sequência").tap();
    await expect(finish(page)).toBeVisible();
    for (const [fx, fy] of [[0.3, 0.6], [0.7, 0.6]]) {
      const at = await spot(page, fx, fy);
      await page.touchscreen.tap(at.x, at.y);
      // Two taps on one spot would be a double tap: wait them apart.
      await page.waitForTimeout(400);
    }
    await expect.poll(() => counts(page)).toMatchObject({ point: 2, segment: 1 });
    await finish(page).tap();
    await expect(finish(page)).toHaveCount(0);
  });
});

test("in the pro layout's tools bar, a tool chosen first waits for its objects too", async ({ page }) => {
  await page.getByRole("button", { name: "Layout profissional" }).click();
  const tools = page.locator('[data-panel="tools"]');
  await tools.locator("xpath=ancestor::*[contains(@class,'dv-groupview')][1]").getByRole("button", { name: "Opções da janela" }).click();
  await page.getByRole("menuitem", { name: "Mostrar como barra" }).click();
  await tools.getByRole("button", { name: "Ligar em sequência", exact: true }).click();
  await expect(tools.getByRole("button", { name: "Ligar em sequência", exact: true })).toHaveAttribute("aria-pressed", "true");
  await clickAt(page, await spot(page, 0.3, 0.6));
  await page.waitForTimeout(400);
  await clickAt(page, await spot(page, 0.6, 0.6));
  await expect.poll(() => counts(page)).toMatchObject({ point: 2, segment: 1 });
});
