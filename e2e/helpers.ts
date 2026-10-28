import { expect, type Page } from "@playwright/test";

/**
 * The open figure as the app saves it: the library index ("geosimples-library")
 * names the active figure, whose doc is under "geosimples-figure:<id>".
 * Saving is debounced, so read it through expect.poll.
 */
interface SavedFigure {
  elements: { id: string; type: string }[];
}

export const TRIANGLE = "A=(0;0)--B=(4;0)--C=(0;3)--";

export async function savedFigure(page: Page): Promise<SavedFigure | null> {
  return page.evaluate(() => {
    const index = localStorage.getItem("geosimples-library");
    const id = index ? JSON.parse(index).activeId : null;
    const raw = id ? localStorage.getItem(`geosimples-figure:${id}`) : null;
    return raw ? JSON.parse(raw) : null;
  });
}

/** How many saved elements there are of each type, e.g. { point: 3, segment: 3 }. */
export async function counts(page: Page): Promise<Record<string, number>> {
  const doc = await savedFigure(page);
  const out: Record<string, number> = {};
  for (const el of doc?.elements ?? []) out[el.type] = (out[el.type] ?? 0) + 1;
  return out;
}

export function pointInput(page: Page) {
  return page.getByRole("textbox", { name: "Adicionar pontos" });
}

export function toolbarButton(page: Page, name: string) {
  return page.getByRole("toolbar", { name: "Ações da figura" }).getByRole("button", { name, exact: true });
}

export async function addTriangle(page: Page) {
  const input = pointInput(page);
  await input.fill(TRIANGLE);
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await expect.poll(() => counts(page)).toMatchObject({ point: 3, segment: 3 });
}

/** Moves focus off the point input so single-key shortcuts reach the app. */
export async function leaveInput(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** The drawing surface: the largest svg inside the preview region. */
async function canvasBox(page: Page) {
  const region = page.getByRole("region", { name: "Prévia da figura" });
  await expect(region).toBeVisible();
  const box = await region.evaluate((el) => {
    let best: DOMRect | null = null;
    for (const svg of el.querySelectorAll("svg")) {
      const r = svg.getBoundingClientRect();
      if (!best || r.width * r.height > best.width * best.height) best = r;
    }
    return best && { x: best.x, y: best.y, width: best.width, height: best.height };
  });
  if (!box) throw new Error("Preview svg not found");
  return box;
}

/** Drags a selection box over the whole drawing surface. The figure is auto-fitted inside it. */
export async function boxSelectAll(page: Page) {
  const b = await canvasBox(page);
  await page.mouse.move(b.x + 12, b.y + 12);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
  await page.mouse.move(b.x + b.width - 12, b.y + b.height - 12, { steps: 5 });
  await page.mouse.up();
}

/** Clicks an empty corner of the drawing surface, which clears the selection. */
export async function clickEmptyCanvas(page: Page) {
  const b = await canvasBox(page);
  await page.mouse.click(b.x + 12, b.y + 12);
}

/** Clicks the drawing surface at a fraction of its width and height. */
export async function clickCanvasAt(page: Page, fx: number, fy: number) {
  const b = await canvasBox(page);
  await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
}
