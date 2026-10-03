import { expect, test, type Page } from "@playwright/test";
import {
  clickColumnAction,
  configureWizard,
  loadWithProfile,
  mainHeaders,
  mainRows,
  openWizard,
  pasteDataset,
  saveWizard,
  uploadSample,
  type WizardChoices,
} from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const FILE = "json-cell-pipe.log";
const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

const extraLines = (page: Page) => page.locator("main tbody tr[data-extra]");
const mainRowEls = (page: Page) => page.locator("main tbody tr:not([data-spacer]):not([data-extra])");

async function setSecondLine(page: Page, column: string, on: boolean) {
  await page.getByRole("button", { name: /^Columns/ }).click();
  await page.getByRole("button", { name: `${on ? "Show on a second line" : "Show in the row"}: ${column}` }).click();
  await page.keyboard.press("Escape");
}

test("a column can move to its own full-width line under each row, and back", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  await clickColumnAction(page, 2, "Show on a second line"); // payload

  // Not a column any more: no header cell, no cell in the row.
  expect(await mainHeaders(page)).toEqual(["timestamp", "host", "level"]);
  expect((await mainRows(page))[0]).toEqual(["2026-01-15T12:30:00.000Z", "host-01", "error"]);

  // One extra line per record, carrying the label and the value, spanning the data columns.
  await expect(extraLines(page)).toHaveCount(8);
  await expect(extraLines(page).first()).toContainText("payload");
  await expect(extraLines(page).first()).toContainText('{"user":"alice","action":"login","count":3}');
  const rowBox = (await mainRowEls(page).first().boundingBox())!;
  const lineBox = (await extraLines(page).first().boundingBox())!;
  expect(lineBox.width).toBeCloseTo(rowBox.width, 0);
  // Directly under the row, and every record is the same height (row + one line) so windowing stays exact.
  expect(Math.round(lineBox.y - rowBox.y)).toBe(Math.round(rowBox.height));
  const next = (await mainRowEls(page).nth(1).boundingBox())!;
  expect(Math.round(next.y - rowBox.y)).toBe(36 + 68);

  await setSecondLine(page, "payload", false);
  expect(await mainHeaders(page)).toEqual(["timestamp", "host", "payload", "level"]);
  await expect(extraLines(page)).toHaveCount(0);
});

test("several columns can be on a second line; clicking one selects its record; search still finds them", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  await clickColumnAction(page, 2, "Show on a second line"); // payload
  await clickColumnAction(page, 1, "Show on a second line"); // host

  expect(await mainHeaders(page)).toEqual(["timestamp", "level"]);
  await expect(extraLines(page)).toHaveCount(16);

  await extraLines(page).nth(1).click();
  await expect(page.getByText("1 selected")).toBeVisible();

  await page.getByPlaceholder("Search visible columns…").fill("host-02");
  await page.getByRole("radio", { name: "Filter" }).click();
  await expect(mainRowEls(page)).toHaveCount(1);
  await expect(extraLines(page)).toHaveCount(2);
});

test("it is part of the view: saved with it, and other views are not affected", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  await clickColumnAction(page, 2, "Show on a second line");

  await page.getByRole("button", { name: /^View:/ }).click();
  await page.getByRole("menuitem", { name: "Save as new view…" }).click();
  await page.getByRole("textbox", { name: "View name" }).fill("Flat");
  await page.getByRole("button", { name: "Add view" }).click();
  await setSecondLine(page, "payload", false);
  await expect(extraLines(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

  await page.reload();
  await uploadSample(page, FILE);
  await page.getByRole("button", { name: "Untitled profile", exact: true }).click();
  await expect(page.getByRole("button", { name: "View: Flat" })).toBeVisible();
  await expect(extraLines(page)).toHaveCount(0);

  await page.getByRole("button", { name: /^View:/ }).click();
  await page.getByRole("menuitemradio", { name: "Default" }).click();
  await expect(extraLines(page)).toHaveCount(8);
  expect(await mainHeaders(page)).toEqual(["timestamp", "host", "level"]);
});

test("a long value wraps over at most three lines, and the full text is the tooltip", async ({ page }) => {
  const long = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
  await page.goto("/");
  await pasteDataset(page, `id|message\n1|${long}\n2|short`);
  await openWizard(page);
  await configureWizard(page, { delimiter: "Pipe", header: true, stripQuotes: true });
  await saveWizard(page);
  await clickColumnAction(page, 1, "Show on a second line");

  const cell = extraLines(page).first().locator("td").nth(1);
  await expect(cell).toHaveAttribute("title", long);
  const box = (await extraLines(page).first().boundingBox())!;
  expect(Math.round(box.height)).toBe(68);
  // The text is cut off: it needs more room than the three lines it gets.
  const clamp = cell.locator("div");
  expect(await clamp.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  // A short value takes the same height, so rows stay uniform.
  expect(Math.round((await extraLines(page).nth(1).boundingBox())!.height)).toBe(68);

  await page.screenshot({ path: "test-results/second-line.png" });
});
