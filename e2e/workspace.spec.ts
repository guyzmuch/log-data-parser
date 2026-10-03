import { expect, test } from "@playwright/test";
import {
  clickColumnAction,
  headerCell,
  loadWithProfile,
  mainHeaders,
  mainRows,
  renameColumn,
  uploadSample,
  type WizardChoices,
} from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

test.describe("empty state and top bar", () => {
  test("a sample loads in one click and shows up in the top bar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /CSV with header/ }).click();

    await expect(page.getByRole("heading", { name: "Choose how to split this data" })).toBeVisible();
    await expect(page.locator("header")).toContainText("csv-with-header.csv");
    await expect(page.locator("header")).toContainText("4 lines");
  });

  test("Replace… opens the file screen without losing the current data, and Back returns to it", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await clickColumnAction(page, 0, "Parse as date");
    await renameColumn(page, 1, "Host");
    const headers = await mainHeaders(page);
    const rows = await mainRows(page);

    await page.getByRole("button", { name: "Replace…" }).click();
    await expect(page.getByRole("heading", { name: "Open a log or CSV to start" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Replace…" })).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("json-cell-pipe.log is still open");

    await page.getByRole("button", { name: "Back to json-cell-pipe.log" }).click();
    expect(await mainHeaders(page)).toEqual(headers);
    expect(await mainRows(page)).toEqual(rows);
    await expect(page.getByRole("button", { name: "Replace…" })).toBeVisible();
  });

  test("loading something new while replacing swaps the data", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await page.getByRole("button", { name: "Replace…" }).click();
    await page.getByRole("button", { name: /CSV with header/ }).click();

    await expect(page.getByRole("heading", { name: "Choose how to split this data" })).toBeVisible();
    await expect(page.locator("header")).toContainText("csv-with-header.csv");
    await expect(page.getByRole("button", { name: /^Back to/ })).toHaveCount(0);
  });

  test("a plain first visit has no Back button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /^Back to/ })).toHaveCount(0);
  });

  test("the top bar shows the loaded file with its line and column counts", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);

    await expect(page.locator("header")).toContainText("json-cell-pipe.log");
    await expect(page.locator("header")).toContainText("9 lines");
    await expect(page.locator("header")).toContainText("4 columns");
  });
});

test.describe("column header menu", () => {
  test("moves and hides a column", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);

    await clickColumnAction(page, 1, "Move left");
    expect(await mainHeaders(page)).toEqual(["host", "timestamp", "payload", "level"]);

    await clickColumnAction(page, 2, "Move right");
    expect(await mainHeaders(page)).toEqual(["host", "timestamp", "level", "payload"]);

    await clickColumnAction(page, 3, "Hide column");
    expect(await mainHeaders(page)).toEqual(["host", "timestamp", "level"]);
  });

  test("offers the detected derivation first, marked as detected", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);

    await headerCell(page, 0).getByRole("button", { name: /Column options/ }).click();
    await expect(page.getByRole("menuitem", { name: /Parse as date.*detected/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Extract JSON keys.*detected/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await headerCell(page, 2).getByRole("button", { name: /Column options/ }).click();
    await expect(page.getByRole("menuitem", { name: /Extract JSON keys.*detected/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Parse as date.*detected/ })).toHaveCount(0);
  });

  test("Rename column focuses the input with its text selected, so typing replaces the name", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await clickColumnAction(page, 1, "Rename column");

    const input = headerCell(page, 1).getByRole("textbox", { name: "Column name" });
    await expect(input).toBeFocused();
    await page.keyboard.type("machine");
    await page.keyboard.press("Enter");
    await expect(headerCell(page, 1).getByTestId("column-label")).toHaveText("machine");
  });

  test("a derived column has no derive actions and names its source", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await clickColumnAction(page, 0, "Parse as date");

    await expect(headerCell(page, 1)).toContainText("from timestamp · date");
    await headerCell(page, 1).getByRole("button", { name: /Column options/ }).click();
    await expect(page.getByRole("menuitem", { name: "Rename column" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Parse as date/ })).toHaveCount(0);
  });
});

test.describe("columns popover", () => {
  test("hides and shows columns, and finds one by name", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await page.getByRole("button", { name: /^Columns/ }).click();
    await expect(page.getByRole("button", { name: /^Columns/ })).toContainText("4 of 4");

    await page.getByRole("button", { name: "Hide column host" }).click();
    expect(await mainHeaders(page)).toEqual(["timestamp", "payload", "level"]);
    await expect(page.getByRole("button", { name: /^Columns/ })).toContainText("3 of 4");

    // The hidden column stays in the list, in place, and comes back to its place in the table.
    const list = page.getByRole("list", { name: "Columns" });
    expect(await list.getByRole("listitem").allInnerTexts()).toEqual(["timestamp", "host", "payload", "level"]);
    await page.getByRole("button", { name: "Show column host" }).click();
    expect(await mainHeaders(page)).toEqual(["timestamp", "host", "payload", "level"]);

    await page.getByRole("button", { name: "Hide column host" }).click();
    await page.getByRole("button", { name: "Show all" }).click();
    expect(await mainHeaders(page)).toEqual(["timestamp", "host", "payload", "level"]);

    await page.getByRole("button", { name: "Reset order" }).click();
    expect(await mainHeaders(page)).toEqual(["timestamp", "host", "payload", "level"]);

    await page.getByRole("textbox", { name: "Find a column" }).fill("lev");
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(list).toContainText("level");

    await page.getByRole("textbox", { name: "Find a column" }).fill("zzz");
    await expect(list).toContainText("No column matches");
  });

  test("Hide all empties the table until columns are shown again", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await page.getByRole("button", { name: /^Columns/ }).click();

    await page.getByRole("button", { name: "Hide all" }).click();
    await expect(page.getByText("No columns are shown")).toBeVisible();

    await page.getByRole("button", { name: "Show all" }).click();
    expect(await mainHeaders(page)).toEqual(["timestamp", "host", "payload", "level"]);
  });

  test("drag and drop reorders the shown columns", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await page.getByRole("button", { name: /^Columns/ }).click();

    const list = page.getByRole("list", { name: "Columns" });
    await list.getByRole("listitem").filter({ hasText: /^level$/ }).dragTo(
      list.getByRole("listitem").filter({ hasText: /^timestamp$/ }),
    );

    expect(await mainHeaders(page)).toEqual(["level", "timestamp", "host", "payload"]);
    expect((await mainRows(page))[0].slice(0, 2)).toEqual(["error", "2026-01-15T12:30:00.000Z"]);
  });

});

test.describe("profile menu", () => {
  test("a hidden profile leaves the menu and comes back when unhidden", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, "csv-with-header.csv");
    const builtIn = "CSV with header (built-in)";

    await page.getByRole("button", { name: /^Profile/ }).click();
    await expect(page.getByRole("menuitemradio", { name: builtIn, exact: true })).toHaveCount(1);
    await page.getByRole("menuitem", { name: /Manage profiles/ }).click();
    await page.getByRole("button", { name: `Hide ${builtIn}` }).click();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /^Profile/ }).click();
    await expect(page.getByRole("menuitemradio", { name: builtIn, exact: true })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: /Manage profiles/ })).toContainText("1 hidden");
    // The chooser agrees.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: builtIn, exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: /^Profile/ }).click();
    await page.getByRole("menuitem", { name: /Manage profiles/ }).click();
    await page.getByRole("button", { name: `Unhide ${builtIn}` }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: builtIn, exact: true })).toHaveCount(1);
  });
});

test.describe("export", () => {
  test("the scope menu changes how many rows will be exported", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    const exportButton = page.getByRole("button", { name: /^Export CSV/ });
    await expect(exportButton).toContainText("8 rows");

    // Hide two rows: "All records" still exports everything, "Excluding hidden" doesn't.
    const rowCheckboxes = page.getByRole("checkbox", { name: /^Select row/ });
    await rowCheckboxes.nth(0).click();
    await rowCheckboxes.nth(1).click();
    await page.getByRole("button", { name: "Hide selected" }).click();
    await expect(exportButton).toContainText("8 rows");

    await page.getByRole("button", { name: "Export scope" }).click();
    await page.getByRole("menuitemradio", { name: /Excluding hidden/ }).click();
    await expect(exportButton).toContainText("6 rows");

    await page.getByRole("button", { name: "Export scope" }).click();
    await page.getByRole("menuitemradio", { name: /All records/ }).click();
    await expect(exportButton).toContainText("8 rows");
  });
});
