import { expect, test, type Page } from "@playwright/test";
import { leaveInput, pointInput, savedFigure } from "./helpers";

interface SavedAxis {
  points: { id: string; label: string; divider: boolean; drop: number }[];
  intervals: string[];
  sketches: { id: string; up?: boolean }[];
}

/** The line of the saved study, with what is on it. */
const studyOf = async (page: Page) => ((await savedFigure(page))?.elements.find((e) => e.type === "study") as { axis: SavedAxis } | undefined)?.axis;

const trail = (page: Page) => page.getByRole("navigation", { name: "Onde está a seleção" });

async function addStudy(page: Page, text: string) {
  const input = pointInput(page);
  await input.fill(text);
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await expect.poll(() => studyOf(page)).toBeTruthy();
  await leaveInput(page);
}

/** Selects the study with a click on it: only then do its pieces take clicks. */
async function selectStudy(page: Page) {
  const id = (await savedFigure(page))!.elements.find((e) => e.type === "study")!.id;
  const b = (await page.locator(`[data-owner="${id}"]`).first().boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect(trail(page)).toBeVisible();
}

/** The middle of a piece of the study in the preview, by its path. */
async function pieceAt(page: Page, path: string) {
  const b = (await page.locator(`[data-part="${path}"]`).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}


test("a blank study is filled in place: double click goes inside, a second one types over the piece", async ({ page }) => {
  await page.goto("/");
  await addStudy(page, "estudo ?; ?; ?");
  expect((await studyOf(page))!.points.map((p) => p.label)).toEqual(["", "", ""]);
  await selectStudy(page);

  // The first double click goes inside, to the point under the pointer.
  const p1 = await pieceAt(page, "point:p1");
  await page.mouse.dblclick(p1.x, p1.y);
  await expect(trail(page)).toContainText("Ponto 1");

  // Inside, a double click on a piece types over it.
  await page.mouse.dblclick(p1.x, p1.y);
  const field = page.getByRole("textbox", { name: "Texto da parte" });
  await expect(field).toBeFocused();
  await field.fill("1");
  // Tab keeps it and goes on to the next piece with a text.
  await field.press("Tab");
  await expect(page.getByRole("textbox", { name: "Texto da parte" })).toBeFocused();
  await page.getByRole("textbox", { name: "Texto da parte" }).fill("1<=x<2");
  await page.getByRole("textbox", { name: "Texto da parte" }).press("Enter");
  await expect.poll(async () => (await studyOf(page))!.points[0].label).toBe("1");
  await expect.poll(async () => (await studyOf(page))!.intervals[1]).toBe("1<=x<2");

  await page.screenshot({ path: "test-results/study-filled.png" });

  // Esc goes up a level at a time: to the study, out of it, then lets go.
  await page.keyboard.press("Escape");
  await expect(trail(page)).not.toContainText("Intervalo");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(trail(page)).toHaveCount(0);
});

test("inside a study, Delete takes the piece, + puts a point in, and a divider's end drags", async ({ page }) => {
  await page.goto("/");
  await addStudy(page, "estudo a; b");
  await selectStudy(page);
  const a = await pieceAt(page, "point:p1");
  await page.mouse.dblclick(a.x, a.y);
  await expect(trail(page)).toContainText("Ponto 1 (a)");
  await page.keyboard.press("Delete");
  await expect.poll(async () => (await studyOf(page))!.points.map((p) => p.label)).toEqual(["b"]);
  // The study stays: only its piece went.
  await expect(trail(page)).toBeVisible();

  await page.getByRole("button", { name: "Novo ponto no trecho 2" }).click();
  await expect.poll(async () => (await studyOf(page))!.points.map((p) => p.label)).toEqual(["b", ""]);
  await expect(trail(page)).toContainText("Ponto 2");

  // Dividers from the panel, then the end of one dragged down.
  await page.getByRole("switch", { name: "Divisória" }).click();
  await expect.poll(async () => (await studyOf(page))!.points[1].divider).toBe(true);
  const end = page.locator('[data-study-handle^="drop:"]').first();
  const box = (await end.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 80, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await studyOf(page))!.points[1].drop).toBeGreaterThan(10);
});

test("estudo with curves puts their zeros on the line and sketches them; Ctrl+click picks a sketch", async ({ page }) => {
  await page.goto("/");
  await addStudy(page, "estudo x-2; x²-5x+4");
  const s = (await studyOf(page))!;
  expect(s.points.map((p) => p.label)).toEqual(["1", "2", "4"]);
  expect(s.sketches).toHaveLength(2);
  await page.screenshot({ path: "test-results/study-curves.png" });
  await selectStudy(page);

  const label = page.locator('[data-part="sketch:s1"]').last();
  const b = (await label.boundingBox())!;
  await page.keyboard.down("Control");
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.keyboard.up("Control");
  await expect(trail(page)).toContainText("Esboço da reta");
  await page.getByRole("radio", { name: /Decrescente/ }).click();
  await expect.poll(async () => (await studyOf(page))!.sketches[0].up).toBe(false);
});
