import { expect, test, type Page } from "@playwright/test";
import {
  chooseExportScope,
  clickColumnAction,
  exportCsvLines,
  loadWithProfile,
  mainRows,
  searchFor,
  type WizardChoices,
} from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const FILE = "json-cell-pipe.log"; // timestamp | host | payload | level; levels: error x4, info, warning, debug...
const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

const pills = (page: Page) => page.getByTestId("filter-pill");

/** Hovers the cell of a row in a column and clicks one of its two filter buttons. */
async function filterCell(page: Page, rowIndex: number, columnIndex: number, button: "Filter for value" | "Filter out value") {
  const cell = page.locator("main tbody tr:not([data-spacer]):not([data-extra])").nth(rowIndex).locator("td").nth(columnIndex + 1);
  await cell.hover();
  await cell.getByRole("button", { name: button }).click();
}

test("'filter for' a cell keeps the rows with that exact value, and lists it as a pill", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  const before = await mainRows(page);
  const level = before[0][3];
  const expected = before.filter((row) => row[3] === level);
  expect(expected.length).toBeLessThan(before.length);

  await filterCell(page, 0, 3, "Filter for value");

  await expect(pills(page)).toHaveCount(1);
  await expect(pills(page).first()).toHaveText(`level: ${level}`);
  await expect(pills(page).first()).toHaveAttribute("data-negated", "false");
  expect(await mainRows(page)).toEqual(expected);
  // Clicking the button did not select the row.
  await expect(page.getByText(/selected/)).toHaveCount(0);
});

test("'filter out' removes the rows with that value, and its pill reads NOT", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  const before = await mainRows(page);
  const level = before[0][3];

  await filterCell(page, 0, 3, "Filter out value");

  await expect(pills(page).first()).toHaveText(`NOT level: ${level}`);
  await expect(pills(page).first()).toHaveAttribute("data-negated", "true");
  expect(await mainRows(page)).toEqual(before.filter((row) => row[3] !== level));
});

test("it is the exact value in that column, not a text search", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  // "host-01" is a substring of nothing else, but "host-0" would match every host in a search.
  await filterCell(page, 0, 1, "Filter for value");
  const rows = await mainRows(page);
  expect(rows).toHaveLength(1);
  expect(rows[0][1]).toBe("host-01");
});

test("several filters combine, and a pill can be flipped, disabled and removed", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  const all = await mainRows(page);
  const level = all[0][3];

  await filterCell(page, 0, 3, "Filter for value");
  const withLevel = await mainRows(page);
  await filterCell(page, 0, 1, "Filter out value"); // and not the first row's host
  await expect(pills(page)).toHaveCount(2);
  expect(await mainRows(page)).toEqual(withLevel.filter((row) => row[1] !== all[0][1]));

  // Flip the level pill to "exclude".
  await pills(page).first().getByRole("button", { name: /^Filter / }).click();
  await page.getByRole("menuitem", { name: "Exclude results" }).click();
  await expect(pills(page).first()).toHaveText(`NOT level: ${level}`);
  expect(await mainRows(page)).toEqual(all.filter((row) => row[3] !== level && row[1] !== all[0][1]));

  // Disable it: the rows come back, the pill stays.
  await pills(page).first().getByRole("button", { name: /^Filter / }).click();
  await page.getByRole("menuitem", { name: "Temporarily disable" }).click();
  await expect(pills(page).first()).toHaveAttribute("data-disabled", "true");
  expect(await mainRows(page)).toEqual(all.filter((row) => row[1] !== all[0][1]));

  // Remove it with its x, then clear the rest.
  await pills(page).first().getByRole("button", { name: /^Remove filter/ }).click();
  await expect(pills(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(pills(page)).toHaveCount(0);
  expect(await mainRows(page)).toEqual(all);
});

test("filtering for a value and then out of the same value flips the one pill instead of adding a second", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  const all = await mainRows(page);

  await filterCell(page, 0, 1, "Filter for value"); // host-01: one row left
  expect(await mainRows(page)).toHaveLength(1);
  await filterCell(page, 0, 1, "Filter out value"); // the same cell, the opposite way

  await expect(pills(page)).toHaveCount(1);
  await expect(pills(page).first()).toHaveAttribute("data-negated", "true");
  expect(await mainRows(page)).toEqual(all.filter((row) => row[1] !== "host-01"));
});

test("filters work together with the search, and 'Matching filter' exports exactly what they leave", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  const all = await mainRows(page);
  const level = all[0][3];

  await filterCell(page, 0, 3, "Filter for value");
  await searchFor(page, "host-0", "Filter");
  const shown = await mainRows(page);
  expect(shown.every((row) => row[3] === level && row[1].includes("host-0"))).toBe(true);

  await chooseExportScope(page, "Matching filter");
  const lines = await exportCsvLines(page);
  expect(lines).toHaveLength(shown.length + 1);

  await chooseExportScope(page, "All records");
  expect(await exportCsvLines(page)).toHaveLength(all.length + 1);
});

test("filters that leave nothing say so, and the pills can still be removed", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  const all = await mainRows(page);

  await filterCell(page, 0, 1, "Filter for value"); // host-01: one row
  await filterCell(page, 0, 3, "Filter out value"); // ...but not its own level
  await expect(page.getByText("No records match the filters.")).toBeVisible();
  await expect(pills(page)).toHaveCount(2);

  await pills(page).nth(1).getByRole("button", { name: /^Remove filter/ }).click();
  expect(await mainRows(page)).toHaveLength(1);
  await page.getByRole("button", { name: "Clear all" }).click();
  expect(await mainRows(page)).toEqual(all);
});

test("a hidden column's pill stays, and column actions still work next to the pills", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  await filterCell(page, 0, 3, "Filter for value");
  await clickColumnAction(page, 3, "Hide column");
  await expect(pills(page)).toHaveCount(1);
  await expect(pills(page).first()).toContainText("level:");
});

test("the column's current name is used on the pill", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  await filterCell(page, 0, 1, "Filter for value");
  await expect(pills(page).first()).toHaveText("host: host-01");
});
