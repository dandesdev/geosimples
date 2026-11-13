import { expect, test, type Locator, type Page } from "@playwright/test";
import { addTriangle, boxSelectAll, counts, pointInput, toolbarButton } from "./helpers";

/* The phone layout: one screen with the preview on top, the input and modes pinned, and the tools by kind of figure scrolling. */

const PHONES = [
  { name: "390x844", viewport: { width: 390, height: 844 } },
  { name: "412x915", viewport: { width: 412, height: 915 } },
];

const AREAS = ["Geometria", "Gráficos", "Vetores", "Conjuntos", "Circuitos", "Contas"];
const MODES = ["Selecionar", "Mover a vista", "Mover", "Adicionar pontos", "Seleção múltipla"];
const REST = ["Desfazer", "Refazer", "Enquadrar automaticamente", "Encaixar na grade", "Exportar"];

const preview = (page: Page) => page.getByRole("region", { name: "Prévia da figura" });
const insertButton = (page: Page) => page.getByRole("button", { name: "Inserir", exact: true });
const catalog = (page: Page) => page.getByRole("dialog", { name: "Inserir" });
const areaTab = (page: Page, name: string) => page.getByRole("tablist", { name: "Ferramentas por área" }).getByRole("tab", { name, exact: true });
/** A tile of the tools' open tab, by its full name. */
const tile = (page: Page, name: string) => page.locator("[data-area-scroll]").getByRole("button", { name, exact: true });

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

    test("one screen: the preview flush with it, and the input, modes, tabs and corner buttons in view", async ({ page }) => {
      await addTriangle(page);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

      const box = (await preview(page).boundingBox())!;
      expect(box.x).toBe(0);
      expect(box.y).toBe(0);
      expect(box.width).toBe(phone.viewport.width);

      await expect(insertButton(page)).toBeInViewport({ ratio: 1 });
      await expect(pointInput(page)).toBeInViewport({ ratio: 1 });
      for (const name of [...MODES, ...REST]) {
        await expect(toolbarButton(page, name), name).toBeInViewport({ ratio: 1 });
      }
      for (const name of AREAS) await expect(areaTab(page, name), name).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("button", { name: "Menu" })).toBeInViewport({ ratio: 1 });

      // The page itself doesn't scroll, and nothing scrolls sideways.
      const sideways = await page.evaluate(() => {
        const wide = (el: Element) => el.scrollWidth > el.clientWidth + 1;
        const strips = [...document.querySelectorAll('[role="toolbar"], [role="toolbar"] *, [role="tablist"]')].filter(
          (el) => wide(el) && getComputedStyle(el).overflowX !== "visible" && getComputedStyle(el).overflowX !== "hidden",
        );
        return {
          page: wide(document.documentElement),
          tall: document.documentElement.scrollHeight > window.innerHeight + 1,
          strips: strips.length,
        };
      });
      expect(sideways).toEqual({ page: false, tall: false, strips: 0 });
    });

    test("the modes and Vários are squares of one size, with the round hint switch closing the row", async ({ page }) => {
      // An empty figure shows no starting card: the short preview has no room for it.
      await expect(page.getByRole("heading", { name: "Comece pelos pontos" })).toHaveCount(0);
      const boxes = await Promise.all(MODES.map(async (name) => (await toolbarButton(page, name).boundingBox())!));
      for (const box of boxes) {
        expect(Math.abs(box.width - boxes[0].width)).toBeLessThan(0.5);
        expect(Math.abs(box.height - boxes[0].height)).toBeLessThan(0.5);
      }
      const hints = (await page.getByRole("button", { name: "Dicas" }).boundingBox())!;
      // Nothing is left over at the row's end: the switch sits at the page's padding.
      expect(Math.abs(hints.x + hints.width - (phone.viewport.width - 8))).toBeLessThan(1);
    });

    test("only the tools scroll: a swipe that starts on a tile taps nothing, and the rest stays put", async ({ page }) => {
      await addTriangle(page);
      await boxSelectAll(page);
      await tap(page, areaTab(page, "Geometria"));
      const input = (await pointInput(page).boundingBox())!;
      await swipeUpFrom(page, tile(page, "Mediana"), 260);
      await expect.poll(() => page.locator("[data-area-scroll]").evaluate((el) => el.scrollTop)).toBeGreaterThan(50);
      await expect(page.getByRole("menu")).toHaveCount(0);
      expect((await counts(page)).segment).toBe(3);
      // The preview, the input and the modes didn't move.
      expect((await preview(page).boundingBox())!.y).toBe(0);
      expect((await pointInput(page).boundingBox())!.y).toBe(input.y);
      await expect(toolbarButton(page, "Selecionar")).toBeInViewport({ ratio: 1 });
    });

    test("a tile runs its tool, and the circuit pieces are a tab of their own", async ({ page }) => {
      await addTriangle(page);
      await boxSelectAll(page);
      await tap(page, areaTab(page, "Geometria"));
      await tap(page, tile(page, "Mediana"));
      await expect.poll(async () => (await counts(page)).segment).toBeGreaterThan(3);
      await tap(page, areaTab(page, "Circuitos"));
      await tap(page, tile(page, "Resistor"));
      await expect.poll(async () => (await counts(page)).component).toBe(1);
    });

    test("a tool that is typed puts the focus in the input with a balloon saying what to type", async ({ page }) => {
      await tap(page, areaTab(page, "Gráficos"));
      await tap(page, tile(page, "Gráfico de função"));
      await expect(pointInput(page)).toBeFocused();
      await expect(pointInput(page)).toHaveValue("y = ");
      const balloon = page.getByRole("status").filter({ hasText: "y = f(x)" });
      await expect(balloon).toBeInViewport({ ratio: 1 });
      // No error before anything is typed.
      await expect(page.locator("#point-input-message")).toHaveText("");
    });

    test("the preview's bottom edge resizes it, down to a tenth of the screen", async ({ page }) => {
      const edge = page.getByRole("separator", { name: "Altura da prévia" });
      const drag = async (y: number) => {
        const b = (await edge.boundingBox())!;
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, y, { steps: 6 });
        await page.mouse.up();
      };
      await drag(5);
      expect(Math.abs((await preview(page).boundingBox())!.height - phone.viewport.height * 0.1)).toBeLessThan(2);
      await drag(phone.viewport.height * 0.6);
      expect(Math.abs((await preview(page).boundingBox())!.height - phone.viewport.height * 0.6)).toBeLessThan(3);
      // It stays as dragged.
      await page.reload();
      await expect(preview(page)).toBeVisible();
      expect(Math.abs((await preview(page).boundingBox())!.height - phone.viewport.height * 0.6)).toBeLessThan(3);
    });

    test("the hint folds away and the tools move up, and comes back", async ({ page }) => {
      await addTriangle(page);
      const tabs = page.getByRole("tablist", { name: "Ferramentas por área" });
      const hint = page.locator("p[aria-live=polite]").filter({ hasText: /Toque/ });
      await expect(hint).toBeVisible();
      const before = (await tabs.boundingBox())!.y;
      const toggle = page.getByRole("button", { name: "Dicas" });
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await tap(page, toggle);
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await expect(hint).toHaveCount(0);
      expect((await tabs.boundingBox())!.y).toBeLessThan(before - 8);
      await tap(page, toggle);
      await expect(hint).toBeVisible();
      expect(Math.abs((await tabs.boundingBox())!.y - before)).toBeLessThan(2);
    });

    test("the menu over the corner holds the title, theme, settings, help, the figure and Prontos", async ({ page }) => {
      await tap(page, page.getByRole("button", { name: "Menu" }));
      const menu = page.getByRole("dialog", { name: "Menu" });
      await expect(menu.getByRole("heading", { name: "GeoSimples" })).toBeVisible();
      for (const name of ["Tema escuro", "Configurações", "Como usar"]) await expect(menu.getByRole("button", { name }), name).toBeVisible();
      // The title and its buttons sit at the left, clear of the X that closes the menu, and on the sheet itself, not on a card.
      // Measured once the sheet has slid in: on its way it is further right.
      await expect.poll(async () => (await menu.boundingBox())!.x).toBe(0);
      const close = (await page.getByTitle("Fechar o menu").boundingBox())!;
      const help = (await menu.getByRole("button", { name: "Como usar" }).boundingBox())!;
      expect(help.x + help.width).toBeLessThan(close.x - 4);
      expect(await menu.getByRole("complementary", { name: "Painel" }).evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("0px");
      await tap(page, menu.getByRole("tab", { name: "Prontos" }));
      await tap(page, menu.getByRole("button", { name: /Circuito em série/ }));
      await expect.poll(async () => (await counts(page)).component).toBe(3);
      // The sheet gets out of the way, so the new figure shows in the preview.
      await expect(menu).toHaveCount(0);
    });

    test("Configurações fills the screen and goes back with an arrow", async ({ page }) => {
      await tap(page, page.getByRole("button", { name: "Menu" }));
      const menu = page.getByRole("dialog", { name: "Menu" });
      // The sheet slides in: tap once it is still.
      await expect.poll(async () => (await menu.boundingBox())!.x).toBe(0);
      await tap(page, menu.getByRole("button", { name: "Configurações" }));
      const settings = page.getByRole("dialog", { name: "Configurações" });
      await expect(settings).toBeVisible();
      await expect(settings.getByRole("button", { name: "Fechar" })).toBeHidden();
      await tap(page, settings.getByRole("button", { name: "Voltar" }));
      await expect(settings).toHaveCount(0);
      await expect(menu).toBeVisible();
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
      expect(inView).toBeGreaterThanOrEqual(8);

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

    test("the selection is edited in a card after the tiles, with the figure in view", async ({ page }) => {
      await addTriangle(page);
      await boxSelectAll(page);
      const card = page.getByRole("region", { name: "Editar seleção" });
      await expect(card).toBeAttached();
      const formatting = card.getByRole("tab", { name: "Formatação" });
      await formatting.scrollIntoViewIfNeeded();
      await expect(formatting).toBeInViewport({ ratio: 1 });
      expect((await preview(page).boundingBox())!.y).toBe(0);
      // It scrolled into view below the pinned tabs, not under them.
      const tabs = (await page.getByRole("tablist", { name: "Ferramentas por área" }).boundingBox())!;
      expect((await formatting.boundingBox())!.y).toBeGreaterThan(tabs.y + tabs.height - 1);
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
