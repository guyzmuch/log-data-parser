import { expect, test } from "@playwright/test";
import {
  addTimezone,
  chooseProfile,
  clickColumnAction,
  loadWithProfile,
  mainHeaders,
  mainRows,
  openWizard,
  renameColumn,
  uploadSample,
  type WizardChoices,
} from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

test("Edit parsing keeps the labels and Derived Fields already set up on the Profile", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
  await clickColumnAction(page, 0, "Parse as date");
  // The date columns replace "timestamp", so host is now the third column and payload the fourth.
  await clickColumnAction(page, 3, "Extract JSON keys");
  await renameColumn(page, 2, "Host");

  const headersBefore = await mainHeaders(page);
  expect(headersBefore).toContain("Host");
  expect(headersBefore).toContain("timestamp (ISO)");
  expect(headersBefore).toContain("payload.user");

  // Re-open the wizard on the active Profile and just save it (renaming the profile).
  await page.getByRole("button", { name: /Edit parsing/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("textbox").first().fill("Renamed profile");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  expect(await mainHeaders(page)).toEqual(headersBefore);
  expect((await mainRows(page))[0]).toContain("alice");
});

test("Edit parsing keeps a built-in's field names for data without a header row", async ({ page }) => {
  await page.goto("/");
  await uploadSample(page, "linux-syslog.log");
  await chooseProfile(page, "Linux syslog (approximate, built-in)");

  const headersBefore = await mainHeaders(page);
  expect(headersBefore.slice(0, 5)).toEqual(["month", "day", "time", "host", "process"]);

  await page.getByRole("button", { name: /Edit parsing/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  expect((await mainHeaders(page)).slice(0, 5)).toEqual(["month", "day", "time", "host", "process"]);
});

test("Save view on a built-in forks a copy instead of duplicating the built-in", async ({ page }) => {
  await page.goto("/");
  await uploadSample(page, "csv-with-header.csv");
  await chooseProfile(page, "CSV with header (built-in)");

  await page.getByRole("button", { name: "Save view" }).click();

  // The built-in is still there exactly once, next to a user copy that is now the active profile.
  await page.getByRole("button", { name: /^Profile/ }).click();
  await expect(page.getByRole("menuitemradio", { name: "CSV with header (built-in)", exact: true })).toHaveCount(1);
  await expect(page.getByRole("menuitemradio", { name: "CSV with header (built-in) (copy)", exact: true })).toHaveCount(1);
  await expect(page.getByRole("menuitemradio", { name: "CSV with header (built-in) (copy)", exact: true })).toBeChecked();
  await page.keyboard.press("Escape");

  // It survives a reload (it really is in localStorage under its own id).
  await page.reload();
  await uploadSample(page, "csv-with-header.csv");
  await expect(page.getByRole("button", { name: "CSV with header (built-in) (copy)", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "CSV with header (built-in)", exact: true })).toHaveCount(1);
});

test("an unknown timezone is rejected with a message instead of making every row 'Invalid parse'", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
  await clickColumnAction(page, 0, "Parse as date");
  const headersBefore = await mainHeaders(page);

  await addTimezone(page, 0, "Paris");

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/not a known timezone/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect(await mainHeaders(page)).toEqual(headersBefore);
  await expect(page.getByText("Invalid parse")).toHaveCount(0);

  // A real zone works, and typing again clears the message.
  await addTimezone(page, 0, "Europe/Paris");
  await expect(dialog).toBeHidden();
  expect((await mainHeaders(page)).slice(0, 3)).toEqual(["timestamp (ISO)", "timestamp (local time)", "timestamp (Europe/Paris)"]);
});

test("'Hide selected' only acts on rows the filter currently shows", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
  const rowCheckboxes = page.getByRole("checkbox", { name: /^Select row/ });
  await expect(rowCheckboxes).toHaveCount(8);

  // Select the first three rows, then filter down to a row that isn't one of them.
  for (const i of [0, 1, 2]) await rowCheckboxes.nth(i).click();
  await expect(page.getByText("3 selected")).toBeVisible();
  await page.getByPlaceholder("Search visible columns…").fill("host-08");
  await page.getByRole("radio", { name: "Filter" }).click();

  await expect(page.locator("main table tbody tr")).toHaveCount(1);
  // None of the selected rows is visible, so there is nothing to act on and no selection chip.
  await expect(page.getByRole("button", { name: "Hide selected" })).toHaveCount(0);

  // Clearing the filter brings the selection back into view — and now it can be hidden.
  await page.getByPlaceholder("Search visible columns…").fill("");
  await expect(page.getByText("3 selected")).toBeVisible();
  await page.getByRole("button", { name: "Hide selected" }).click();
  await expect(page.locator("main table tbody tr")).toHaveCount(5);
  await expect(page.getByText("3 rows hidden")).toBeVisible();
  await expect(page.getByText("3 selected")).toHaveCount(0);

  await page.getByRole("button", { name: "Unhide" }).click();
  await expect(page.locator("main table tbody tr")).toHaveCount(8);
  await expect(page.getByText(/rows? hidden/)).toHaveCount(0);
});

test("a new profile's wizard starts from its defaults, whatever the last profile used", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", { ...CHOICES, trimCells: false });

  await openWizard(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("checkbox", { name: "First row is a header" })).not.toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Strip surrounding quotes" })).not.toBeChecked();
  // Cells are trimmed unless the user turns it off.
  await expect(dialog.getByRole("checkbox", { name: "Trim cells" })).toBeChecked();
});
