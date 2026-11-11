import { expect, test, type Locator, type Page } from "@playwright/test";
import { addTriangle, boxSelectAll, counts, pointInput, toolbarButton } from "./helpers";

/* The phone layout: the preview pinned on top, and the tools as tiles below it. */

const PHONES = [
  { name: "390x844", viewport: { width: 390, height: 844 } },
  { name: "412x915", viewport: { width: 412, height: 915 } },
];

const TOOLS = ["Ligar pontos", "Marcar ângulo", "Polígono e preenchimento", "Circunferência", "Construções", "Gráficos", "Vetores", "Conjuntos"];
const MODES = ["Selecionar", "Mover a vista", "Mover", "Adicionar pontos", "Seleção múltipla"];
const REST = ["Desfazer", "Refazer", "Enquadrar automaticamente", "Encaixar na grade", "Exportar"];

const preview = (page: Page) => page.getByRole("region", { name: "Prévia da figura" });
const insertButton = (page: Page) => page.getByRole("button", { name: "Inserir", exact: true });
const catalog = (page: Page) => page.getByRole("dialog", { name: "Inserir" });

async function center(target: Locator) {
  const box = (await target.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A finger's tap, which the page gets as touch events and then a click. */
async function tap(page: Page, target: Locator) {
  const at = await center(target);
  await page.touchscreen.tap(at.x, at.y);
}

/** A finger dragged up the screen from `target`, sent as the touch events a phone sends. */
async function swipeUpFrom(page: Page, target: Locator, distance: number) {
  const at = await center(target);
  const client = await page.context().newCDPSession(page);
  const steps = 10;
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at] });
  for (let i = 1; i <= steps; i++) {
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: at.x, y: at.y - (distance * i) / steps }] });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await client.detach();
}

for (const phone of PHONES) {
  test.describe(`phone ${phone.name}`, () => {
    test.use({ viewport: phone.viewport, hasTouch: true, isMobile: true });

    test.beforeEach(async ({ page }) => {
      await page.goto("/");
    });

    test("the preview is flush with the screen and every tool is in view", async ({ page }) => {
      await addTriangle(page);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

      const box = (await preview(page).boundingBox())!;
      expect(box.x).toBe(0);
      expect(box.y).toBe(0);
      expect(box.width).toBe(phone.viewport.width);

      await expect(insertButton(page)).toBeInViewport({ ratio: 1 });
      await expect(pointInput(page)).toBeInViewport({ ratio: 1 });
      for (const name of [...MODES, ...TOOLS, ...REST]) {
        await expect(toolbarButton(page, name), name).toBeInViewport({ ratio: 1 });
      }

      // Nothing to scroll sideways: not the page, and no strip of tools inside it.
      const sideways = await page.evaluate(() => {
        const wide = (el: Element) => el.scrollWidth > el.clientWidth + 1;
        const strips = [...document.querySelectorAll('[role="toolbar"], [role="toolbar"] *')].filter(
          (el) => wide(el) && getComputedStyle(el).overflowX !== "visible" && getComputedStyle(el).overflowX !== "hidden",
        );
        return { page: wide(document.documentElement), strips: strips.length };
      });
      expect(sideways).toEqual({ page: false, strips: 0 });
    });

    test("a swipe that starts on a tool scrolls the page and taps nothing", async ({ page }) => {
      await addTriangle(page);
      // With a selection the page is longer than the screen: the card that edits it is below the tools.
      await boxSelectAll(page);
      await expect(page.getByRole("region", { name: "Editar seleção" })).toBeVisible();
      await swipeUpFrom(page, toolbarButton(page, "Construções"), 260);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
      await expect(page.getByRole("menu")).toHaveCount(0);

      // The modes and the plain buttons too.
      await page.evaluate(() => window.scrollTo(0, 0));
      await swipeUpFrom(page, toolbarButton(page, "Adicionar pontos"), 260);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
      await expect(toolbarButton(page, "Selecionar")).toHaveAttribute("aria-pressed", "true");
      await expect(toolbarButton(page, "Adicionar pontos")).toHaveAttribute("aria-pressed", "false");

      // The preview stays where it was, over the page that moved.
      expect((await preview(page).boundingBox())!.y).toBe(0);
    });

    test("a tap on a tool with a menu opens it, and its items run", async ({ page }) => {
      await addTriangle(page);
      await boxSelectAll(page);
      await tap(page, toolbarButton(page, "Construções"));
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      await tap(page, menu.getByRole("menuitem", { name: /Mediana/ }));
      await expect(menu).toHaveCount(0);
      await expect.poll(async () => (await counts(page)).segment).toBeGreaterThan(3);
    });

    test("Inserir opens over the whole screen, without the keyboard", async ({ page }) => {
      await tap(page, insertButton(page));
      const dialog = catalog(page);
      await expect(dialog).toBeVisible();
      await expect.poll(async () => (await dialog.boundingBox())!.height).toBe(phone.viewport.height);
      const box = (await dialog.boundingBox())!;
      expect([box.x, box.y, box.width]).toEqual([0, 0, phone.viewport.width]);

      // The search is there, but nothing that takes typing has the focus: no keyboard comes up.
      const search = dialog.getByRole("textbox", { name: "Buscar no Inserir" });
      await expect(search).toBeVisible();
      await expect(search).not.toBeFocused();
      expect(await page.evaluate(() => ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? ""))).toBe(false);

      // Most of the screen is options.
      const items = dialog.locator("[data-catalog-item]");
      const inView = await items.evaluateAll(
        (els) => els.filter((el) => el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().bottom <= window.innerHeight).length,
      );
      expect(inView).toBeGreaterThanOrEqual(9);

      // The search still works once tapped.
      await tap(page, search);
      await expect(search).toBeFocused();
      await search.fill("venn");
      await expect(dialog.getByRole("button", { name: /Diagrama com 2 conjuntos/ })).toBeVisible();
      await expect(dialog.getByRole("button", { name: /Nova função/ })).toHaveCount(0);
    });

    test("an item of Inserir that is typed goes on in the input bar", async ({ page }) => {
      await tap(page, insertButton(page));
      await tap(page, catalog(page).getByRole("button", { name: /Nova função/ }));
      await expect(catalog(page)).toHaveCount(0);
      await expect(pointInput(page)).toHaveValue("y = ");
      await expect(pointInput(page)).toBeFocused();
      await expect(pointInput(page)).toBeInViewport({ ratio: 1 });
    });

    test("the selection is edited in a card below the tools, with the figure in view", async ({ page }) => {
      await addTriangle(page);
      await boxSelectAll(page);
      const card = page.getByRole("region", { name: "Editar seleção" });
      await expect(card).toBeVisible();
      await expect(card.getByRole("button", { name: "Propriedades" })).toBeVisible();
      // In the page, not floating over the tools.
      await expect(card).toHaveCSS("position", "static");

      await card.getByRole("button", { name: "Formatação" }).scrollIntoViewIfNeeded();
      const top = (await preview(page).boundingBox())!;
      expect(top.y).toBe(0);
      // What scrolled into view is below the pinned preview, not under it.
      expect((await card.getByRole("button", { name: "Formatação" }).boundingBox())!.y).toBeGreaterThan(top.height - 1);
    });
  });
}

test("with a mouse, Inserir still opens beside its button with the search focused", async ({ page }) => {
  await page.goto("/");
  await toolbarButton(page, "Inserir").click();
  const dialog = catalog(page);
  await expect(dialog.getByRole("textbox", { name: "Buscar no Inserir" })).toBeFocused();
  expect((await dialog.boundingBox())!.height).toBeLessThan(page.viewportSize()!.height);
});

test("on a touch screen wide enough for the toolbar, Inserir opens without the keyboard", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/");
  await tap(page, toolbarButton(page, "Inserir"));
  const dialog = catalog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Buscar no Inserir" })).not.toBeFocused();
  await context.close();
});
