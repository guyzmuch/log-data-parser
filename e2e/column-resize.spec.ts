import { expect, test, type Page } from "@playwright/test";
import { headerCell, loadWithProfile, type WizardChoices } from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

async function widthOf(page: Page, columnIndex: number) {
  return Math.round((await headerCell(page, columnIndex).boundingBox())!.width);
}

async function dragHandle(page: Page, columnIndex: number, dx: number) {
  const box = (await headerCell(page, columnIndex).getByRole("separator").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y);
  await page.mouse.move(x + dx, y);
  await page.mouse.up();
}

test("dragging a header edge resizes the column, and long values end in an ellipsis", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
  const before = await widthOf(page, 2); // payload: long JSON values
  const neighbour = await widthOf(page, 1);

  await dragHandle(page, 2, -120);
  expect(await widthOf(page, 2)).toBeLessThan(before - 100);
  expect(await widthOf(page, 1)).toBe(neighbour);

  // The cut-off cells are ellipsised and keep their full value as a tooltip.
  const cell = page.locator("main table tbody tr:not([data-spacer]) td").nth(3);
  expect(await cell.evaluate((el) => getComputedStyle(el).textOverflow)).toBe("ellipsis");
  expect(await cell.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect(cell).toHaveAttribute("title", /./);

  await dragHandle(page, 2, 400);
  expect(await widthOf(page, 2)).toBeGreaterThan(before);
});

test("the column can't be dragged narrower than its minimum, and double-click resets it", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
  const before = await widthOf(page, 2);

  await dragHandle(page, 2, -2000);
  const narrowest = await widthOf(page, 2);
  expect(narrowest).toBe(80);

  await headerCell(page, 2).getByRole("separator").dblclick();
  expect(await widthOf(page, 2)).toBe(before);
});

test("widths are saved with the profile", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
  await dragHandle(page, 2, -150);
  const resized = await widthOf(page, 2);

  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem("log-data-parser:profiles"));
  const widths = JSON.parse(stored!).profiles[0].display.columnWidths;
  expect(Object.values(widths)).toEqual([expect.any(Number)]);
  expect(Math.abs((Object.values(widths)[0] as number) - resized)).toBeLessThanOrEqual(1);
});
