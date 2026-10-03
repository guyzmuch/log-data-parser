import { expect, test, type Page } from "@playwright/test";
import { clickColumnAction, loadWithProfile, mainRows, searchFor, type WizardChoices } from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

const rowCount = (page: Page) => page.locator("main table tbody tr");
const hostsShown = async (page: Page) => (await mainRows(page)).map((row) => row[1]);

test.describe("Highlight mode", () => {
  test("keeps every row and marks the matches, whatever the case", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await searchFor(page, "HOST-0", "Highlight");

    await expect(rowCount(page)).toHaveCount(8);
    const marks = page.locator("main mark");
    await expect(marks).toHaveCount(8);
    // The mark keeps the cell's own casing.
    await expect(marks.first()).toHaveText("host-0");
  });

  test("marks matches in several columns, and nothing when there is no search", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await expect(page.locator("main mark")).toHaveCount(0);

    await searchFor(page, "error", "Highlight");
    await expect(page.locator("main mark")).toHaveCount(4);
    await expect(rowCount(page)).toHaveCount(8);

    await searchFor(page, "", "Highlight");
    await expect(page.locator("main mark")).toHaveCount(0);
  });
});

test.describe("Filter mode", () => {
  test("shows only the rows with a match, case-insensitively", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);

    await searchFor(page, "bob", "Filter");
    expect(await hostsShown(page)).toEqual(["host-02"]);

    await searchFor(page, "ERROR", "Filter");
    expect(await hostsShown(page)).toEqual(["host-01", "host-02", "host-04", "host-06"]);

    await searchFor(page, "", "Filter");
    await expect(rowCount(page)).toHaveCount(8);
  });

  test("says so when nothing matches", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await searchFor(page, "no such value", "Filter");

    await expect(page.getByText("No records match your search.")).toBeVisible();
    await expect(page.locator("main table")).toHaveCount(0);

    await searchFor(page, "", "Filter");
    await expect(rowCount(page)).toHaveCount(8);
  });

  test("a blank term is no search at all", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await searchFor(page, "   ", "Filter");
    await expect(rowCount(page)).toHaveCount(8);
  });

  test("switching between Highlight and Filter keeps the term", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);

    await searchFor(page, "error", "Filter");
    await expect(rowCount(page)).toHaveCount(4);

    await page.getByRole("radio", { name: "Highlight" }).click();
    await expect(rowCount(page)).toHaveCount(8);
    await expect(page.getByPlaceholder("Search visible columns…")).toHaveValue("error");

    await page.getByRole("radio", { name: "Filter" }).click();
    await expect(rowCount(page)).toHaveCount(4);
  });
});

test.describe("what is searched", () => {
  test("only the columns that are shown", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);

    await searchFor(page, "alice", "Filter");
    await expect(rowCount(page)).toHaveCount(1);

    await clickColumnAction(page, 2, "Hide column"); // payload holds "alice"
    await expect(page.getByText("No records match your search.")).toBeVisible();

    await page.getByRole("button", { name: /^Columns/ }).click();
    await page.getByRole("button", { name: "Show column payload" }).click();
    await expect(rowCount(page)).toHaveCount(1);
  });

  test("derived columns too", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);

    // "12:30:48 PM" only exists in the derived local-time column, not in the raw timestamp.
    await searchFor(page, "12:30:48 PM", "Filter");
    await expect(page.getByText("No records match your search.")).toBeVisible();

    // (With no matches the table isn't rendered, so clear the search to reach the column menu.)
    await searchFor(page, "", "Filter");
    await clickColumnAction(page, 0, "Parse as date");
    await searchFor(page, "12:30:48 PM", "Filter");
    expect(await hostsShown(page)).toEqual(["host-02"]);
  });
});
